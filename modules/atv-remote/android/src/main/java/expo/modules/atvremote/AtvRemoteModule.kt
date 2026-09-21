package expo.modules.atvremote

import android.content.Context
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AtvRemoteError(message: String) : CodedException(message)

/**
 * JS-facing surface for the Android TV Remote Service v2 protocol.
 *
 * AsyncFunction bodies already run off the JS thread, so the socket work is
 * written as plain blocking IO rather than a callback maze.
 */
class AtvRemoteModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw AtvRemoteError("No Android context available")

  private var pairing: PairingClient? = null
  private var remote: RemoteClient? = null
  private var discovery: Discovery? = null

  /** Shown on the TV while it asks whether to trust this phone. */
  private val clientName: String
    get() = "Remote TV (${Build.MANUFACTURER} ${Build.MODEL})"

  override fun definition() = ModuleDefinition {
    Name("AtvRemote")

    Events("onState", "onDevice")

    AsyncFunction("discover") {
      discovery?.stop()
      discovery = Discovery(context) { device -> sendEvent("onDevice", device) }.also { it.start() }
    }

    AsyncFunction("stopDiscovery") {
      discovery?.stop()
      discovery = null
    }

    AsyncFunction("startPairing") { host: String, port: Int, deviceId: String ->
      val client = PairingClient(context)
      pairing = client
      try {
        client.start(host, if (port > 0) port else PairingClient.PORT, deviceId, clientName)
      } catch (e: Exception) {
        pairing = null
        client.close()
        throw AtvRemoteError(friendly(e))
      }
    }

    AsyncFunction("submitCode") { code: String ->
      val client = pairing ?: throw AtvRemoteError("Start pairing with a TV first")
      try {
        client.submitCode(code)
      } catch (e: Exception) {
        throw AtvRemoteError(friendly(e))
      } finally {
        pairing = null
      }
    }

    AsyncFunction("connect") { host: String, port: Int, deviceId: String ->
      val client = RemoteClient(context) { patch -> sendEvent("onState", patch) }
      try {
        client.connect(host, if (port > 0) port else RemoteClient.PORT, deviceId)
      } catch (e: Exception) {
        throw AtvRemoteError(friendly(e))
      }
      remote?.disconnect()
      remote = client
    }

    AsyncFunction("disconnect") {
      remote?.disconnect()
      remote = null
      pairing?.close()
      pairing = null
    }

    AsyncFunction("sendKey") { keyCode: Int, direction: Int ->
      val client = remote ?: throw AtvRemoteError("Not connected to a TV")
      try {
        client.sendKey(keyCode, direction)
      } catch (e: Exception) {
        throw AtvRemoteError(friendly(e))
      }
    }

    AsyncFunction("sendText") { text: String ->
      val client = remote ?: throw AtvRemoteError("Not connected to a TV")
      try {
        client.sendText(text)
      } catch (e: Exception) {
        throw AtvRemoteError(friendly(e))
      }
    }

    AsyncFunction("launchApp") { uri: String ->
      val client = remote ?: throw AtvRemoteError("Not connected to a TV")
      try {
        client.launchApp(uri)
      } catch (e: Exception) {
        throw AtvRemoteError(friendly(e))
      }
    }

    AsyncFunction("hasPairing") { deviceId: String ->
      Certs.isPaired(context, deviceId)
    }

    AsyncFunction("forgetPairing") { deviceId: String ->
      Certs.forgetPin(context, deviceId)
    }

    OnDestroy {
      discovery?.stop()
      remote?.disconnect()
      pairing?.close()
    }
  }

  /**
   * Socket and TLS failures surface as class names and errno strings that
   * mean nothing on a phone screen, so the common ones get rewritten into
   * something a person can act on.
   */
  private fun friendly(e: Exception): String {
    val raw = e.message ?: e.javaClass.simpleName
    return when {
      e is javax.net.ssl.SSLHandshakeException && raw.contains("identity has changed") ->
        "This TV's identity has changed since pairing. Forget it and pair again."
      e is javax.net.ssl.SSLHandshakeException && raw.contains("not been paired") ->
        "This TV isn't paired with your phone yet."
      e is java.net.SocketTimeoutException ->
        "The TV didn't answer. Check it's on and on the same Wi-Fi."
      e is java.net.ConnectException ->
        "Couldn't reach the TV. Check it's on and on the same Wi-Fi."
      e is java.io.EOFException ->
        "The TV closed the connection. Try pairing again."
      else -> raw
    }
  }
}
