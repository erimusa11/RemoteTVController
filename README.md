# Remote TV

A mobile remote control for Android TV / Google TV, built with Expo and React Native. It pairs directly with a TV on the local network and drives it using the same protocol the official Android TV Remote app uses — no casting, no third-party cloud service.

## Features

- **Discovery** — finds Android TVs on the LAN via mDNS (`_androidtvremote2._tcp`).
- **Pairing** — pairs over TLS and stores the certificate on-device, so you only enter the 6-digit code once per TV.
- **D-Pad & navigation** — directional pad, OK/back/home, volume and mute, power.
- **App shortcuts** — one-tap launch tiles for YouTube, Netflix, Prime Video, Disney+, Spotify, Plex, Twitch, DAZN.
- **Keyboard input** — send free-text input to the TV (e.g. search fields).
- **Haptics** — tactile feedback on button presses (native only).
- **Web fallback** — a simulated TV backend so the UI can be developed and previewed in a browser, where raw TLS sockets aren't available.

## Tech stack

- [Expo](https://expo.dev) (SDK 57) + React Native 0.86
- TypeScript
- React Native SVG, Safe Area Context, Async Storage
- Android TV Remote Service v2 protocol (TLS, ports `6466`/`6467`) for native pairing/control

## Project structure

```
src/
  screens/       Connect, Pair, and Remote screens
  components/    DPad, RemoteButton, VolumeHud, Icons, Logo, ScanRadar, Backdrop
  transport/     AtvRemote interface + native/web implementations, key codes, app shortcuts
  lib/           haptics, local storage helpers
  RemoteContext.tsx   app-wide connection state
```

`transport/remote.native.ts` bridges to the real Android TV Remote Service v2 protocol; `transport/remote.web.ts` simulates a TV so the app runs in a browser during development. Both implement the same `AtvRemote` interface (`transport/types.ts`).

## Getting started

```bash
npm install
npm run android   # or: npm run ios / npm run web
```

Requires a physical Android TV / Google TV on the same network for real pairing and control; the web target uses the simulated backend.

## License

MIT
