/**
 * Shared vocabulary between the JS app and whatever actually talks to the TV.
 *
 * Two implementations satisfy `AtvRemote`:
 *   - `AtvRemote.native.ts` — bridges to the Kotlin module that speaks the real
 *     Android TV Remote Service v2 protocol (TLS on :6467 / :6466).
 *   - `AtvRemote.web.ts`   — a simulated TV so the UI can be developed in a
 *     browser, where raw TLS sockets don't exist.
 */

export type TvDevice = {
  /** Stable id; the mDNS service name on Android, a synthetic id on web. */
  id: string;
  name: string;
  host: string;
  port: number;
  model?: string;
};

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'pairing'
  | 'awaiting-code'
  | 'connected'
  | 'error';

export type TvState = {
  status: ConnectionStatus;
  device: TvDevice | null;
  /** 0-100, or null when the TV hasn't reported one yet. */
  volume: number | null;
  muted: boolean;
  /** Package name of whatever is on screen, when the TV reports it. */
  currentApp: string | null;
  error: string | null;
};

/** Android `KEYCODE_*` values. */
export type KeyCode = number;

export type KeyPressKind = 'short' | 'long-start' | 'long-end';

export interface AtvRemote {
  /** True when this build can really reach a TV (false in the browser). */
  readonly isReal: boolean;

  /** Look for TVs advertising `_androidtvremote2._tcp` on the LAN. */
  discover(onFound: (device: TvDevice) => void): Promise<void>;
  stopDiscovery(): Promise<void>;

  /**
   * Open the pairing socket. Resolves once the TV is showing its 6-digit code;
   * the caller then feeds that code to `submitCode`.
   */
  startPairing(device: TvDevice): Promise<void>;
  submitCode(code: string): Promise<void>;

  /** Reconnect using a certificate we already paired with. */
  connect(device: TvDevice): Promise<void>;
  disconnect(): Promise<void>;

  sendKey(keyCode: KeyCode, kind?: KeyPressKind): Promise<void>;
  sendText(text: string): Promise<void>;
  launchApp(uri: string): Promise<void>;

  /** Whether we hold a certificate already paired with this device. */
  hasPairing(deviceId: string): Promise<boolean>;
  forgetPairing(deviceId: string): Promise<void>;

  subscribe(listener: (state: Partial<TvState>) => void): () => void;
}
