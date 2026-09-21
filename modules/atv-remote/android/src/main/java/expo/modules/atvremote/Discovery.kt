package expo.modules.atvremote

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager

/**
 * Finds Google TV devices advertising `_androidtvremote2._tcp` on the LAN.
 *
 * The service name is the stable identity here — a TV's IP address is a DHCP
 * lease that changes when the router or the TV reboots, so the JS side keys
 * pairings off this name and re-resolves the address before each connect.
 */
class Discovery(
  private val context: Context,
  private val onFound: (Map<String, Any?>) -> Unit,
) {
  private val nsd by lazy {
    context.applicationContext.getSystemService(Context.NSD_SERVICE) as NsdManager
  }

  private var listener: NsdManager.DiscoveryListener? = null
  private var multicastLock: WifiManager.MulticastLock? = null

  // NsdManager historically blows up with "listener already in use" when more
  // than one resolve is in flight, so they are queued and run one at a time.
  private val queue = ArrayDeque<NsdServiceInfo>()
  private var resolving = false

  fun start() {
    stop()
    acquireMulticastLock()

    val discoveryListener = object : NsdManager.DiscoveryListener {
      override fun onStartDiscoveryFailed(serviceType: String?, errorCode: Int) = Unit
      override fun onStopDiscoveryFailed(serviceType: String?, errorCode: Int) = Unit
      override fun onDiscoveryStarted(serviceType: String?) = Unit
      override fun onDiscoveryStopped(serviceType: String?) = Unit
      override fun onServiceLost(serviceInfo: NsdServiceInfo?) = Unit

      override fun onServiceFound(serviceInfo: NsdServiceInfo?) {
        if (serviceInfo == null) return
        synchronized(queue) { queue.addLast(serviceInfo) }
        pump()
      }
    }

    listener = discoveryListener
    nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
  }

  fun stop() {
    listener?.let {
      try {
        nsd.stopServiceDiscovery(it)
      } catch (_: Exception) {
        // Not running; nothing to stop.
      }
    }
    listener = null
    synchronized(queue) {
      queue.clear()
      resolving = false
    }
    releaseMulticastLock()
  }

  private fun pump() {
    val next = synchronized(queue) {
      if (resolving) return
      val candidate = queue.removeFirstOrNull() ?: return
      resolving = true
      candidate
    }

    @Suppress("DEPRECATION") // registerServiceInfoCallback is API 34+ only
    nsd.resolveService(
      next,
      object : NsdManager.ResolveListener {
        override fun onResolveFailed(serviceInfo: NsdServiceInfo?, errorCode: Int) = finish()

        override fun onServiceResolved(serviceInfo: NsdServiceInfo?) {
          val host = serviceInfo?.host?.hostAddress
          val name = serviceInfo?.serviceName
          if (host != null && name != null) {
            onFound(
              mapOf(
                "id" to name,
                "name" to name,
                "host" to host,
                "port" to serviceInfo.port,
              ),
            )
          }
          finish()
        }

        private fun finish() {
          synchronized(queue) { resolving = false }
          pump()
        }
      },
    )
  }

  /**
   * Multicast packets are filtered out by the Wi-Fi chip on many devices to
   * save power, which makes mDNS silently find nothing without this.
   */
  private fun acquireMulticastLock() {
    try {
      val wifi = context.applicationContext
        .getSystemService(Context.WIFI_SERVICE) as WifiManager
      multicastLock = wifi.createMulticastLock("remotetv-mdns").apply {
        setReferenceCounted(true)
        acquire()
      }
    } catch (_: Exception) {
      // Discovery may still work; not worth failing the scan over.
    }
  }

  private fun releaseMulticastLock() {
    try {
      multicastLock?.takeIf { it.isHeld }?.release()
    } catch (_: Exception) {
      // Nothing to release.
    }
    multicastLock = null
  }

  companion object {
    private const val SERVICE_TYPE = "_androidtvremote2._tcp."
  }
}
