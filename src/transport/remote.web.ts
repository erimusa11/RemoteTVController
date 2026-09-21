import { StateEmitter } from './emitter';
import { KEY } from './keys';
import type { AtvRemote, KeyPressKind, TvDevice } from './types';

/**
 * A pretend Google TV, so the whole flow — discovery, pairing, the remote
 * itself — is clickable in a browser. Raw TLS sockets don't exist on the web,
 * so this is the only thing that can run there.
 *
 * Any 6-character code is accepted. Volume and the "current app" readout are
 * tracked locally so the UI has something real to reflect.
 */
class SimulatedRemote implements AtvRemote {
  readonly isReal = false;

  private emitter = new StateEmitter();
  private discovering = false;
  private paired = new Set<string>();
  private volume = 18;
  private muted = false;
  private device: TvDevice | null = null;

  /**
   * Bumped by disconnect() and by starting a new handshake. A delayed emit
   * checks its captured token against the current value before firing, so
   * backing out mid-handshake can't be overridden by a stale timer that
   * resolves afterwards and silently re-opens the pairing screen.
   */
  private session = 0;

  private static readonly FAKE_TVS: TvDevice[] = [
    {
      id: 'sim-grundig',
      name: 'Grundig 55 GHU 7970',
      host: '192.168.1.42',
      port: 6466,
      model: 'Google TV',
    },
    {
      id: 'sim-chromecast',
      name: 'Chromecast in salotto',
      host: '192.168.1.57',
      port: 6466,
      model: 'Google TV',
    },
  ];

  async discover(onFound: (device: TvDevice) => void) {
    this.discovering = true;
    for (const [index, tv] of SimulatedRemote.FAKE_TVS.entries()) {
      await delay(700 + index * 900);
      if (!this.discovering) return;
      onFound(tv);
    }
  }

  async stopDiscovery() {
    this.discovering = false;
  }

  async startPairing(device: TvDevice) {
    const token = ++this.session;
    this.device = device;
    this.emitter.emit({ status: 'pairing', device, error: null });
    await delay(900);
    if (token !== this.session) return; // backed out while the TV "thought"
    this.emitter.emit({ status: 'awaiting-code' });
  }

  async submitCode(code: string) {
    if (!/^[0-9A-Fa-f]{6}$/.test(code)) {
      throw new Error('The code must be 6 characters (0-9, A-F).');
    }
    const token = this.session; // continuing the pairing session, not starting one
    this.emitter.emit({ status: 'connecting' });
    await delay(800);
    if (token !== this.session) return; // backed out while the code was checked
    if (this.device) this.paired.add(this.device.id);
    this.emitter.emit({
      status: 'connected',
      volume: this.volume,
      muted: this.muted,
      currentApp: 'com.google.android.tvlauncher',
    });
  }

  async connect(device: TvDevice) {
    const token = ++this.session;
    this.device = device;
    this.emitter.emit({ status: 'connecting', device, error: null });
    await delay(600);
    if (token !== this.session) return; // disconnected while the session opened
    this.emitter.emit({
      status: 'connected',
      volume: this.volume,
      muted: this.muted,
      currentApp: 'com.google.android.tvlauncher',
    });
  }

  async disconnect() {
    this.session++; // invalidates any in-flight handshake's delayed emit
    this.device = null;
    this.emitter.emit({ status: 'idle', device: null, currentApp: null });
  }

  async sendKey(keyCode: number, kind: KeyPressKind = 'short') {
    if (kind === 'long-end') return;

    if (keyCode === KEY.VOLUME_UP) {
      this.volume = Math.min(100, this.volume + 1);
      this.muted = false;
    } else if (keyCode === KEY.VOLUME_DOWN) {
      this.volume = Math.max(0, this.volume - 1);
      this.muted = false;
    } else if (keyCode === KEY.VOLUME_MUTE) {
      this.muted = !this.muted;
    } else if (keyCode === KEY.HOME) {
      this.emitter.emit({ currentApp: 'com.google.android.tvlauncher' });
      return;
    } else {
      return;
    }

    this.emitter.emit({ volume: this.volume, muted: this.muted });
  }

  async sendText(_text: string) {
    /* nothing to type into */
  }

  async launchApp(uri: string) {
    this.emitter.emit({ currentApp: uri });
  }

  async hasPairing(deviceId: string) {
    return this.paired.has(deviceId);
  }

  async forgetPairing(deviceId: string) {
    this.paired.delete(deviceId);
  }

  subscribe(listener: Parameters<AtvRemote['subscribe']>[0]) {
    return this.emitter.subscribe(listener);
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default new SimulatedRemote() as AtvRemote;
