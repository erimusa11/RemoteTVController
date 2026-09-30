import { StateEmitter } from './emitter';
import { KEY } from './keys';
import type { AtvRemote, KeyPressKind, TvDevice } from './types';

/**
 * A pretend Google TV, so the whole flow — discovery, pairing, the remote
 * itself — is clickable in a browser. Raw TLS sockets don't exist on the web,
 * so this is the only thing that can run there.
 *
 * It behaves like the native transport: pairing only proves the code, the
 * caller then connects, and connection status is driven by RemoteContext.
 * Any 6-character hex code is accepted.
 */
class SimulatedRemote implements AtvRemote {
  readonly isReal = false;

  private emitter = new StateEmitter();
  private discovering = false;
  private paired = new Set<string>();
  private volume = 18;
  private readonly volumeMax = 100;
  private muted = false;
  private isOn = true;

  /**
   * Bumped by disconnect() and by every new handshake, so a delayed step that
   * resolves after the user backed out can tell it is stale.
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
    this.discovering = false;
  }

  async stopDiscovery() {
    this.discovering = false;
  }

  async startPairing(_device: TvDevice) {
    ++this.session;
    await delay(900);
  }

  async submitCode(code: string) {
    if (!/^[0-9A-Fa-f]{6}$/.test(code)) {
      throw codedError('ERR_BAD_CODE', 'The code must be 6 characters (0-9, A-F).');
    }
    await delay(700);
  }

  async connect(device: TvDevice) {
    const token = ++this.session;
    await delay(600);
    if (token !== this.session) throw new Error('Cancelled');
    this.paired.add(device.id);
    this.emitter.emit({
      status: 'connected',
      volume: this.volume,
      volumeMax: this.volumeMax,
      muted: this.muted,
      isOn: this.isOn,
      currentApp: 'com.google.android.tvlauncher',
    });
  }

  async disconnect() {
    this.session++;
  }

  async sendKey(keyCode: number, kind: KeyPressKind = 'short') {
    if (kind === 'long-end') return;

    switch (keyCode) {
      case KEY.VOLUME_UP:
        this.volume = Math.min(this.volumeMax, this.volume + 1);
        this.muted = false;
        break;
      case KEY.VOLUME_DOWN:
        this.volume = Math.max(0, this.volume - 1);
        this.muted = false;
        break;
      case KEY.VOLUME_MUTE:
        this.muted = !this.muted;
        break;
      case KEY.POWER:
        this.isOn = !this.isOn;
        this.emitter.emit({ isOn: this.isOn });
        return;
      case KEY.HOME:
        this.emitter.emit({ currentApp: 'com.google.android.tvlauncher' });
        return;
      default:
        return;
    }

    this.emitter.emit({ volume: this.volume, volumeMax: this.volumeMax, muted: this.muted });
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

const codedError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

export default new SimulatedRemote() as AtvRemote;
