package expo.modules.atvremote

import android.content.Context
import android.os.Build
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class RemoteException(message: String) : Exception(message)

/**
 * The control session on port 6466.
 *
 * Unlike pairing this stays open for as long as the remote is on screen: the
 * TV drives the opening handshake, pings every few seconds to check we are
 * alive, and pushes volume and foreground-app changes at us unprompted.
 *
 * Field numbers come from remotemessage.proto:
 *   RemoteMessage { remote_configure=1, remote_set_active=2, remote_error=3,
 *   remote_ping_request=8, remote_ping_response=9, remote_key_inject=10,
 *   remote_ime_key_inject=20, remote_start=40, remote_set_volume_level=50,
 *   remote_app_link_launch_request=90 }
 */
class RemoteClient(
  private val context: Context,
  private val onState: (Map<String, Any?>) -> Unit,
) {
  private var pinned: Certs.PinnedSocket? = null
  private var input: InputStream? = null
  private var output: OutputStream? = null
  private var reader: Thread? = null

  @Volatile private var running = false
  @Volatile private var ready = CountDownLatch(1)
  @Volatile private var failure: String? = null

  fun connect(host: String, port: Int, deviceId: String) {
    disconnect()

    val p = Certs.connect(context, host, port, deviceId, allowUnknown = false)
    pinned = p
    input = BufferedInputStream(p.socket.inputStream)
    output = BufferedOutputStream(p.socket.outputStream)
    ready = CountDownLatch(1)
    failure = null
    running = true

    reader = Thread({ readLoop() }, "atv-remote-reader").apply {
      isDaemon = true
      start()
    }

    // The TV opens the conversation, so treat "no RemoteStart in time" as a
    // failed connect rather than reporting success on a dead session.
    if (!ready.await(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
      val why = failure ?: "The TV did not finish opening the remote session"
      disconnect()
      throw RemoteException(why)
    }
    failure?.let {
      disconnect()
      throw RemoteException(it)
    }
  }

  fun disconnect() {
    running = false
    try {
      pinned?.socket?.close()
    } catch (_: Exception) {
      // Already closed.
    }
    reader?.interrupt()
    reader = null
    pinned = null
    input = null
    output = null
  }

  fun sendKey(keyCode: Int, direction: Int) = send {
    message(10) {
      varint(1, keyCode)
      varint(2, direction)
    }
  }

  fun launchApp(uri: String) = send {
    message(90) { string(1, uri) }
  }

  /**
   * The protocol has no "type this string" message that TVs reliably honour,
   * so text goes in as individual key events — the same thing that happens
   * when you press letters on a physical remote.
   */
  fun sendText(text: String) {
    for (ch in text) {
      val keyCode = when (ch) {
        in 'a'..'z' -> KEYCODE_A + (ch - 'a')
        in 'A'..'Z' -> KEYCODE_A + (ch - 'A')
        in '0'..'9' -> KEYCODE_0 + (ch - '0')
        ' ' -> KEYCODE_SPACE
        else -> continue // punctuation has no portable keycode mapping
      }
      sendKey(keyCode, DIRECTION_SHORT)
      // The TV's IME drops events that arrive faster than it can consume.
      Thread.sleep(30)
    }
  }

  private fun readLoop() {
    try {
      while (running) {
        val stream = input ?: break
        val message = parseProto(readDelimited(stream))

        when {
          // The TV asks us to describe ourselves before anything else.
          message.has(1) -> send {
            message(1) {
              varint(1, CONFIGURE_CODE)
              message(2) {
                string(1, Build.MODEL)
                string(2, Build.MANUFACTURER)
                varint(3, 1)
                string(4, "1")
                string(5, PACKAGE_NAME)
                string(6, APP_VERSION)
              }
            }
          }

          message.has(2) -> send { message(2) { varint(1, CONFIGURE_CODE) } }

          message.has(8) -> {
            val ping = message.nested(8)
            send { message(9) { varint(1, ping?.int(1) ?: 0) } }
          }

          message.has(40) -> {
            onState(mapOf("status" to "connected", "error" to null))
            ready.countDown()
          }

          message.has(50) -> {
            val volume = message.nested(50)
            if (volume != null) {
              onState(
                mapOf(
                  "volume" to volume.int(7),
                  "muted" to volume.bool(8),
                ),
              )
            }
          }

          message.has(20) -> {
            val app = message.nested(20)?.nested(1)?.str(12)
            if (app != null) onState(mapOf("currentApp" to app))
          }

          message.has(3) -> {
            failure = "The TV reported an error"
            ready.countDown()
          }
        }
      }
    } catch (e: Exception) {
      if (running) {
        failure = e.message ?: "Lost the connection to the TV"
        onState(mapOf("status" to "idle", "error" to failure))
      }
      ready.countDown()
    }
  }

  private fun send(block: ProtoWriter.() -> Unit) {
    val out = output ?: throw RemoteException("Not connected to a TV")
    synchronized(this) {
      writeDelimited(out, ProtoWriter().apply(block).toByteArray())
    }
  }

  companion object {
    const val PORT = 6466

    private const val CONNECT_TIMEOUT_SECONDS = 12L

    /** Value the reference implementations send; the TV only checks presence. */
    private const val CONFIGURE_CODE = 622

    private const val PACKAGE_NAME = "it.eri.remotetv"
    private const val APP_VERSION = "1.0.0"

    private const val KEYCODE_0 = 7
    private const val KEYCODE_A = 29
    private const val KEYCODE_SPACE = 62
    private const val DIRECTION_SHORT = 3
  }
}
