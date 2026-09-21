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
  private const val ALIAS = "remotetv.client.key"
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

    val spec = KeyGenParameterSpec.Builder(
      ALIAS,
      KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
    )
      .setKeySize(2048)
      .setCertificateSubject(X500Principal("CN=Remote TV by ERI"))
      .setCertificateSerialNumber(BigInteger.valueOf(1))
      .setCertificateNotBefore(notBefore.time)
      .setCertificateNotAfter(notAfter.time)
      // TLS picks the digest during the handshake, so allow the ones a
      // 1.2/1.3 client-auth signature might ask for rather than guessing one.
      .setDigests(
        KeyProperties.DIGEST_NONE,
        KeyProperties.DIGEST_SHA1,
        KeyProperties.DIGEST_SHA256,
        KeyProperties.DIGEST_SHA384,
        KeyProperties.DIGEST_SHA512,
      )
      .setSignaturePaddings(
        KeyProperties.SIGNATURE_PADDING_RSA_PKCS1,
        KeyProperties.SIGNATURE_PADDING_RSA_PSS,
      )
      .build()

    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, PROVIDER).run {
      initialize(spec)
      generateKeyPair()
    }
  }

  private fun ensureClientKey(): Pair<X509Certificate, PrivateKey> {
    val ks = keyStore()
    if (!ks.containsAlias(ALIAS)) generateClientKey()
    val cert = keyStore().getCertificate(ALIAS) as X509Certificate
    val key = keyStore().getKey(ALIAS, null) as PrivateKey
    return cert to key
  }

  fun clientCertificate(): X509Certificate = ensureClientKey().first

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

  fun isPaired(context: Context, deviceId: String): Boolean = pinFor(context, deviceId) != null

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
    val (cert, key) = ensureClientKey()
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
