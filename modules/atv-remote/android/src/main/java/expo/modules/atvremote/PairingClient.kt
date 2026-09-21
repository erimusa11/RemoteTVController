package expo.modules.atvremote

import android.content.Context
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.security.interfaces.RSAPublicKey

class PairingException(message: String) : Exception(message)

/**
 * The pairing handshake on port 6467.
 *
 * The session is held open between [start] and [submitCode]: the TV only
 * puts its code on screen after acking the configuration, and the derived
 * secret has to travel back over that same TLS session for the certificates
 * in the hash to mean anything.
 *
 * Field numbers come from pairingmessage.proto:
 *   PairingMessage { protocol_version=1, status=2, pairing_request=10,
 *   pairing_request_ack=11, pairing_option=20, pairing_configuration=30,
 *   pairing_configuration_ack=31, pairing_secret=40, pairing_secret_ack=41 }
 */
class PairingClient(private val context: Context) {

  private var pinned: Certs.PinnedSocket? = null
  private var input: InputStream? = null
  private var output: OutputStream? = null
  private var deviceId: String? = null

  fun start(host: String, port: Int, deviceId: String, clientName: String) {
    close()
    this.deviceId = deviceId

    val p = Certs.connect(context, host, port, deviceId, allowUnknown = true)
    pinned = p
    input = BufferedInputStream(p.socket.inputStream)
    output = BufferedOutputStream(p.socket.outputStream)

    send {
      varint(1, PROTOCOL_VERSION)
      varint(2, STATUS_OK)
      message(10) {
        string(1, SERVICE_NAME)
        string(2, clientName)
      }
    }
    expect(11, "the pairing request")

    send {
      varint(1, PROTOCOL_VERSION)
      varint(2, STATUS_OK)
      message(20) {
        message(1) { // input_encodings
          varint(1, ENCODING_HEXADECIMAL)
          varint(2, CODE_LENGTH)
        }
        varint(3, ROLE_INPUT) // preferred_role
      }
    }
    expect(20, "the pairing options")

    send {
      varint(1, PROTOCOL_VERSION)
      varint(2, STATUS_OK)
      message(30) {
        message(1) { // encoding
          varint(1, ENCODING_HEXADECIMAL)
          varint(2, CODE_LENGTH)
        }
        varint(2, ROLE_INPUT) // client_role
      }
    }
    expect(31, "the pairing configuration")
    // The TV is now showing its code.
  }

  /**
   * The code is 6 hex characters: one check byte followed by a two-byte
   * nonce. The secret is SHA-256 over both certificates' RSA modulus and
   * exponent plus that nonce — so it can only be derived by something that
   * both saw the real TV's certificate and can read its screen.
   */
  fun submitCode(rawCode: String) {
    val p = pinned ?: throw PairingException("The pairing session is no longer open")
    val id = deviceId ?: throw PairingException("The pairing session is no longer open")

    val code = rawCode.trim().uppercase()
    if (!Regex("^[0-9A-F]{6}$").matches(code)) {
      throw PairingException("The code is 6 characters — digits and the letters A to F.")
    }

    val codeBytes = hexToBytes(code)
    val clientKey = Certs.clientCertificate().publicKey as RSAPublicKey
    val serverCert = p.trust.peerCertificate
      ?: throw PairingException("The TV never presented a certificate")
    val serverKey = serverCert.publicKey as RSAPublicKey

    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(Certs.unsigned(clientKey.modulus))
    digest.update(Certs.unsigned(clientKey.publicExponent))
    digest.update(Certs.unsigned(serverKey.modulus))
    digest.update(Certs.unsigned(serverKey.publicExponent))
    digest.update(codeBytes, 1, codeBytes.size - 1)
    val hash = digest.digest()

    // The first code byte is a checksum over the rest, so a typo is caught
    // here without bothering the TV.
    if (hash[0] != codeBytes[0]) {
      throw PairingException("That code doesn't match. Check the characters on the TV.")
    }

    send {
      varint(1, PROTOCOL_VERSION)
      varint(2, STATUS_OK)
      message(40) { bytes(1, hash) }
    }
    expect(41, "the pairing secret")

    // Pin only now: the TV proved it derived the same secret, which means
    // the certificate we just saw really is the one on screen.
    Certs.savePin(context, id, Certs.fingerprint(serverCert))
    close()
  }

  fun close() {
    try {
      pinned?.socket?.close()
    } catch (_: Exception) {
      // Already gone; nothing useful to do.
    }
    pinned = null
    input = null
    output = null
  }

  private fun send(block: ProtoWriter.() -> Unit) {
    val out = output ?: throw PairingException("The pairing session is no longer open")
    writeDelimited(out, ProtoWriter().apply(block).toByteArray())
  }

  private fun expect(field: Int, what: String): ProtoFields {
    val stream = input ?: throw PairingException("The pairing session is no longer open")
    val message = parseProto(readDelimited(stream))

    val status = message.int(2)
    if (status != STATUS_OK) throw PairingException(describe(status, what))
    if (!message.has(field)) {
      throw PairingException("The TV sent an unexpected reply to $what")
    }
    return message
  }

  private fun describe(status: Int, what: String): String = when (status) {
    STATUS_BAD_CONFIGURATION -> "The TV rejected the pairing settings"
    STATUS_BAD_SECRET -> "That code was wrong. Try again with the code on screen."
    else -> "The TV refused $what (status $status)"
  }

  private fun hexToBytes(hex: String): ByteArray =
    ByteArray(hex.length / 2) { i ->
      ((Character.digit(hex[i * 2], 16) shl 4) + Character.digit(hex[i * 2 + 1], 16)).toByte()
    }

  companion object {
    const val PORT = 6467

    private const val PROTOCOL_VERSION = 2
    private const val STATUS_OK = 200
    private const val STATUS_BAD_CONFIGURATION = 401
    private const val STATUS_BAD_SECRET = 402

    private const val ENCODING_HEXADECIMAL = 3
    private const val ROLE_INPUT = 1
    private const val CODE_LENGTH = 6

    private const val SERVICE_NAME = "it.eri.remotetv"
  }
}
