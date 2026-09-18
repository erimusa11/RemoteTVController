# Security notes for Remote TV

This app controls a TV over the local network using the Android TV Remote
Service v2 protocol (the same one Google's own Android TV Remote app uses).
This document is the binding contract for anything that touches that
protocol — written before the native module exists, so the requirements
below aren't optional cleanup added after the fact.

## Threat model

- **Attacker:** another device already on the same Wi-Fi/LAN (a compromised
  IoT gadget, a rogue access point, another phone running packet capture or
  ARP spoofing tools). Not a remote internet attacker — this app makes no
  outbound network calls beyond the LAN.
- **What's at stake:** the TLS session between phone and TV carries every key
  press, including anything typed via the Keyboard tab (which can include
  passwords typed into a TV login/search field). If the handshake can be
  intercepted, an attacker on the LAN can read or inject arbitrary remote
  input.

## Why a naive implementation would be a backdoor

The protocol's certificates are self-signed — there is no CA, so Android's
default `TrustManager` rejects the TV's certificate outright. Implementing
the native module requires a **custom** `TrustManager`. The shortcut version
of that (accept any certificate, skip validation) is a real vulnerability:
it means any device on the LAN can present its own certificate and the app
will treat it as the TV, silently proxying or hijacking the session. This is
exactly the class of bug that turns "my TV remote" into "anyone's remote
into my phone's LAN traffic."

## Required design for `src/transport/remote.native.ts` and its Kotlin module

1. **Trust-On-First-Use (TOFU) certificate pinning.**
   - On a successful pairing (the user confirms the 6-digit code the TV
     shows), compute the SHA-256 fingerprint of the TV's leaf certificate and
     store it keyed by device id.
   - On every subsequent `connect()`, the `TrustManager` must accept **only**
     a certificate matching that stored fingerprint. Any other cert —
     including a technically-valid one from some other source — is a hard
     failure, not a silent fallback.
   - If the fingerprint ever changes for a known device id, surface a clear
     "this TV's identity changed — re-pair it" error. Never auto-trust a
     replacement certificate; that would defeat the pinning entirely.

2. **Keys never leave hardware-backed storage.**
   - Generate the client's keypair with Android Keystore
     (`KeyGenParameterSpec`), so the private key is non-exportable even with
     root, and use StrongBox when the device has it.
   - The pinned server-certificate fingerprint and any pairing state go
     through Android Keystore-backed encrypted storage (e.g. EncryptedFile /
     Keystore-wrapped, not `expo-secure-store`'s plain profile on devices
     without a secure enclave — verify the backing store before shipping).
   - **Never** store certs, private keys, or the pinned fingerprint in
     `AsyncStorage`/`SharedPreferences`. `src/lib/storage.ts` only ever holds
     non-secret device metadata (id, name, host, port) — that boundary is
     deliberate and must stay that way. If a future change needs to persist
     anything security-sensitive from JS, that's a sign it's in the wrong
     layer.

3. **Never log secrets.** No pairing code, certificate bytes, or key
   material in `Log.d`/`println`/exception messages — including in debug
   builds. Debug logs are reachable via `adb logcat` to anything with USB
   access or (on older Android) `READ_LOGS`.

4. **Socket hygiene.** Close and dispose both the pairing (`:6467`) and
   remote (`:6466`) sockets on `disconnect()`; don't leave a background
   socket alive after the user backs out.

## What's already true and must stay true

- **No telemetry, no third-party network calls.** The app makes zero
  outbound HTTP/analytics requests today. If that ever changes, it must be
  disclosed to the user, not added silently via an SDK.
- **Minimum permissions.** Only `INTERNET`, `ACCESS_NETWORK_STATE`,
  `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE` — no location
  permission, which Android's NSD/mDNS discovery doesn't require (unlike raw
  Wi-Fi scan APIs).
- **No WebView, no `eval`, no dynamic `require`/`import`.** TV-supplied
  strings (current app package, model name) are only ever rendered as plain
  text, never interpreted as code or markup.
- **Deep links are inert by design.** `app.json` declares `"scheme":
  "remotetv"` (used by `expo-dev-client`), which registers an Android intent
  filter — but nothing in this app calls `Linking.getInitialURL()` or
  `Linking.addEventListener()`, so external data reaching that intent filter
  is never read. **If a future feature adds a deep-link handler, it must
  allow-list the exact actions it accepts and never let external URI data
  reach `launch()`, `sendKey()`, or any pairing call unvalidated** — that
  would turn an inert intent filter into a real one-tap hijack vector from
  any other app or a web link.

## Client-side pairing lockout

`RemoteContext` caps incorrect pairing-code submissions at 5 attempts before
forcing a fresh scan (`MAX_PAIR_ATTEMPTS` in `src/RemoteContext.tsx`). This
doesn't replace whatever rate-limiting the TV itself does, but it stops this
app from being scriptable into an unattended brute-force loop against a TV's
pairing socket (six digits is only 1,000,000 combinations).
