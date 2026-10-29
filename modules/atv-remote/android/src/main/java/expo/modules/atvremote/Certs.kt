package expo.modules.atvremote

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.math.BigInteger
import java.net.InetSocketAddress
import java.net.Socket
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Principal
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.Calendar
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509ExtendedKeyManager
import javax.net.ssl.X509TrustManager
import javax.security.auth.x500.X500Principal

/**
 * Identity and transport security for the TV connection. See SECURITY.md —
 * this file is where a shortcut would turn the app into a LAN-wide MITM hole.
 *
 * Two things matter here:
 *  - The client's RSA key is generated inside AndroidKeyStore and is never
 *    exportable, so it cannot be lifted off the device even with root.
 *  - The TV's certificate is self-signed, so there is no CA to check it
 *    against. We pin instead: the first successful pairing records its
 *    SHA-256, and every later connection must present that exact
 *    certificate.
 */
object Certs {
  // v4: every earlier key's certificate had the same subject and serial
  // number on every phone, so the TV could not tell two phones apart and
  // pairing the second one silently unpaired the first (see generateClientKey).
  // v3 before it: the v1 and v2 keys were never authorised for raw RSA, the
  // one signing operation Conscrypt asks the keystore for in an RSA-PSS
  // handshake, so on Android 10+ they failed against any TV offering PSS.
  // A key's certificate and authorisations are fixed when it is generated,
  // hence a new alias — as any future change to the spec will need, with the
  // old alias moved to RETIRED_ALIASES.
  private const val ALIAS = "remotetv.client.key.v4"
  private val RETIRED_ALIASES =
    listOf("remotetv.client.key", "remotetv.client.key.v2", "remotetv.client.key.v3")
  private const val PROVIDER = "AndroidKeyStore"
  private const val PIN_PREFS = "remotetv.pins"

  class PinnedSocket(val socket: SSLSocket, val trust: PinningTrustManager)

  private fun keyStore(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

  /**
   * AndroidKeyStore mints a self-signed certificate alongside the key pair,
   * which is exactly what this protocol wants — there is no CA anywhere in
   * it, both sides just present self-signed certs and bind them to the
   * pairing code.
   */
  private fun generateClientKey() {
    val notBefore = Calendar.getInstance()
    val notAfter = Calendar.getInstance().apply { add(Calendar.YEAR, 25) }
    // Issuer plus serial number is what names a certificate, and a self-signed
    // one is its own issuer. Both must differ per phone, or the TV files every
    // install under one entry and each new pairing evicts the last.
    val serial = BigInteger(63, SecureRandom()).add(BigInteger.ONE)

    val spec = KeyGenParameterSpec.Builder(
      ALIAS,
      KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
    )
      .setKeySize(2048)
      .setCertificateSubject(X500Principal("CN=Remote TV by ERI ${serial.toString(16)}"))
      .setCertificateSerialNumber(serial)
      .setCertificateNotBefore(notBefore.time)
      .setCertificateNotAfter(notAfter.time)
      // TLS hashes inside BoringSSL, so the handshake only ever asks for
      // DIGEST_NONE; the real digests let older Android versions sign the
      // self-signed certificate properly instead of with a placeholder.
      .setDigests(
        KeyProperties.DIGEST_NONE,
        KeyProperties.DIGEST_SHA1,
        KeyProperties.DIGEST_SHA256,
        KeyProperties.DIGEST_SHA384,
        KeyProperties.DIGEST_SHA512,
      )
      .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
      // Conscrypt hashes the handshake itself and hands the keystore only the
      // RSA step. PKCS#1 arrives as "RSA/ECB/PKCS1Padding", covered by the
      // signature padding above. RSA-PSS — which on Android 10+ BoringSSL
      // picks over PKCS#1 whenever the TV offers both, TLS 1.2 included — is
      // padded in-process and arrives as "RSA/ECB/NoPadding", which the
      // keystore performs only for keys authorised for no padding. Without
      // this the handshake fails with "RSA routines:OPENSSL_internal:internal
      // error" (Conscrypt issue #718), whether or not PSS is listed above.
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .build()

    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, PROVIDER).run {
      initialize(spec)
      generateKeyPair()
    }
  }

  // Expo runs module calls one at a time, but a JS reload can leave an old
  // call running beside a new one. Synchronized so two first connections
  // can't each mint a key, the second replacing the one the first paired with.
  @Synchronized
  private fun ensureClientKey(context: Context): Pair<X509Certificate, PrivateKey> {
    val ks = keyStore()
    if (!ks.containsAlias(ALIAS)) {
      // Pairing binds the TV to our certificate as much as us to its, so any
      // pin recorded before this key existed belongs to a TV that will now
      // refuse us. Committed, not applied: it must land before the new key.
      pins(context).edit().clear().commit()
      // Housekeeping only; a stale key that won't delete mustn't block pairing.
      RETIRED_ALIASES.forEach { runCatching { ks.deleteEntry(it) } }
      generateClientKey()
    }
    val cert = keyStore().getCertificate(ALIAS) as X509Certificate
    val key = keyStore().getKey(ALIAS, null) as PrivateKey
    return cert to key
  }

  fun clientCertificate(context: Context): X509Certificate = ensureClientKey(context).first

  fun fingerprint(cert: X509Certificate): String =
    MessageDigest.getInstance("SHA-256").digest(cert.encoded)
      .joinToString("") { String.format("%02x", it) }

  // The pin is a hash of a public certificate — its confidentiality buys
  // nothing, its integrity is what matters, and app-private storage already
  // provides that. The secret that must never leak is the private key, and
  // that lives in AndroidKeyStore above, not here.
  private fun pins(context: Context) =
    context.getSharedPreferences(PIN_PREFS, Context.MODE_PRIVATE)

  fun pinFor(context: Context, deviceId: String): String? =
    pins(context).getString(deviceId, null)

  fun savePin(context: Context, deviceId: String, pin: String) {
    pins(context).edit().putString(deviceId, pin).apply()
  }

  fun forgetPin(context: Context, deviceId: String) {
    pins(context).edit().remove(deviceId).apply()
  }

  /**
   * Without our key no TV will take us back, whatever the pins say — true
   * after an update from a v1/v2 key, or when pins come back from a backup
   * onto a phone that never had the key. Saying "not paired" sends the user
   * to pairing instead of a connection the TV is bound to refuse. A keystore
   * that can't be read counts as no key: pairing then shows the real error.
   */
  fun isPaired(context: Context, deviceId: String): Boolean =
    runCatching { keyStore().containsAlias(ALIAS) }.getOrDefault(false) &&
      pinFor(context, deviceId) != null

  /**
   * @param allowUnknown true only during pairing, when we have not yet seen
   *   this TV's certificate and the pairing code is what proves its identity.
   *   Always false for ordinary reconnects.
   */
  fun connect(
    context: Context,
    host: String,
    port: Int,
    deviceId: String,
    allowUnknown: Boolean,
    timeoutMs: Int = 10_000,
  ): PinnedSocket {
    // Key first: generating one clears the pins, so read the pin after it.
    val (cert, key) = ensureClientKey(context)
    val trust = PinningTrustManager(pinFor(context, deviceId), allowUnknown)

    val ssl = SSLContext.getInstance("TLSv1.2")
    ssl.init(
      arrayOf(KeystoreKeyManager(ALIAS, arrayOf(cert), key)),
      arrayOf<javax.net.ssl.TrustManager>(trust),
      SecureRandom(),
    )

    // Connect the plain socket first so the dial honours a timeout; wrapping
    // an already-connected socket is the only way to get one with SSLSocket.
    val plain = Socket()
    plain.connect(InetSocketAddress(host, port), timeoutMs)
    plain.tcpNoDelay = true
    // Without a read timeout a TV that accepts the TCP connection but never
    // answers would hang the handshake (and every queued module call) forever.
    plain.soTimeout = timeoutMs

    val socket = ssl.socketFactory.createSocket(plain, host, port, true) as SSLSocket
    socket.startHandshake()
    return PinnedSocket(socket, trust)
  }

  /** Unsigned big-endian bytes — how the protocol hashes the RSA parameters. */
  fun unsigned(value: BigInteger): ByteArray {
    val raw = value.toByteArray()
    return if (raw.size > 1 && raw[0].toInt() == 0) raw.copyOfRange(1, raw.size) else raw
  }
}

/**
 * Presents our AndroidKeyStore certificate for client authentication. The
 * private key never leaves the keystore; signing is delegated to it.
 */
private class KeystoreKeyManager(
  private val alias: String,
  private val chain: Array<X509Certificate>,
  private val key: PrivateKey,
) : X509ExtendedKeyManager() {
  override fun getClientAliases(keyType: String?, issuers: Array<out Principal>?): Array<String> =
    arrayOf(alias)

  override fun chooseClientAlias(
    keyType: Array<out String>?,
    issuers: Array<out Principal>?,
    socket: Socket?,
  ): String = alias

  override fun getServerAliases(keyType: String?, issuers: Array<out Principal>?): Array<String>? = null

  override fun chooseServerAlias(
    keyType: String?,
    issuers: Array<out Principal>?,
    socket: Socket?,
  ): String? = null

  override fun getCertificateChain(alias: String?): Array<X509Certificate> = chain

  override fun getPrivateKey(alias: String?): PrivateKey = key
}

/**
 * Trust-on-first-use pinning. The platform default trust manager would
 * reject the TV outright (self-signed, no CA), and blanket-accepting any
 * certificate would let anything on the Wi-Fi impersonate the TV — so the
 * certificate seen at pairing time becomes the only one accepted afterwards.
 */
class PinningTrustManager(
  private val expectedPin: String?,
  private val allowUnknown: Boolean,
) : X509TrustManager {

  @Volatile
  var peerCertificate: X509Certificate? = null
    private set

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    val leaf = chain?.firstOrNull() ?: throw CertificateException("The TV presented no certificate")
    peerCertificate = leaf
    val actual = Certs.fingerprint(leaf)

    when {
      expectedPin == null && allowUnknown -> Unit // first pairing; pinned on success
      expectedPin == null ->
        throw CertificateException("This TV has not been paired yet")
      actual != expectedPin ->
        throw CertificateException(
          "This TV's identity has changed since pairing. Forget it and pair again.",
        )
    }
  }

  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit

  override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
}
