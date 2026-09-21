import { requireOptionalNativeModule } from 'expo';

import { StateEmitter } from './emitter';
import simulated from './remote.web';
import type { AtvRemote, KeyPressKind, TvDevice, TvState } from './types';

/**
 * Bridge to the Kotlin module in `modules/atv-remote`, which owns the client
 * certificate and the two TLS sockets (pairing on :6467, remote on :6466).
 *
 * When the module isn't in the binary — Expo Go, or a build made before the
 * module existed — we fall back to the simulator so the UI still runs. The
 * connect screen reads `isReal` to warn that the listed TVs are fake.
 *
 * SECURITY: the native side of this bridge is the one place a shortcut turns
 * into a LAN-wide MITM hole — see ../../SECURITY.md. In short: certificate-pin
 * the TV on first pairing (TOFU) and reject any later handshake presenting a
 * different certificate; keep the client keypair in Android Keystore; never
 * log pairing codes, certs, or key material.
 */

type NativeAtvRemote = {
  discover(): Promise<void>;
  stopDiscovery(): Promise<void>;
  startPairing(host: string, port: number, deviceId: string): Promise<void>;
  submitCode(code: string): Promise<void>;
  connect(host: string, port: number, deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  sendKey(keyCode: number, direction: number): Promise<void>;
  sendText(text: string): Promise<void>;
  launchApp(uri: string): Promise<void>;
  hasPairing(deviceId: string): Promise<boolean>;
  forgetPairing(deviceId: string): Promise<void>;
  addListener(event: 'onState', listener: (patch: Partial<TvState>) => void): { remove(): void };
  addListener(event: 'onDevice', listener: (device: TvDevice) => void): { remove(): void };
};

const native = requireOptionalNativeModule<NativeAtvRemote>('AtvRemote');

/** Mirrors RemoteDirection in remotemessage.proto. */
const DIRECTION: Record<KeyPressKind, number> = {
  'long-start': 1,
  'long-end': 2,
  short: 3,
};

/**
 * mDNS answers trickle in, so a scan is a window rather than a request with
 * a reply. Long enough for a TV that's slow to respond, short enough that the
 * spinner doesn't feel stuck.
 */
const SCAN_WINDOW_MS = 8000;

class NativeRemote implements AtvRemote {
  readonly isReal = true;

  private emitter = new StateEmitter();

  constructor(private readonly mod: NativeAtvRemote) {
    this.mod.addListener('onState', (patch) => this.emitter.emit(patch));
  }

  async discover(onFound: (device: TvDevice) => void) {
    const sub = this.mod.addListener('onDevice', onFound);
    try {
      await this.mod.discover();
      await new Promise((resolve) => setTimeout(resolve, SCAN_WINDOW_MS));
    } finally {
      sub.remove();
      await this.mod.stopDiscovery().catch(() => {});
    }
  }

  stopDiscovery() {
    return this.mod.stopDiscovery();
  }

  startPairing(device: TvDevice) {
    return this.mod.startPairing(device.host, 6467, device.id);
  }

  submitCode(code: string) {
    return this.mod.submitCode(code);
  }

  connect(device: TvDevice) {
    return this.mod.connect(device.host, device.port || 6466, device.id);
  }

  disconnect() {
    return this.mod.disconnect();
  }

  sendKey(keyCode: number, kind: KeyPressKind = 'short') {
    return this.mod.sendKey(keyCode, DIRECTION[kind]);
  }

  sendText(text: string) {
    return this.mod.sendText(text);
  }

  launchApp(uri: string) {
    return this.mod.launchApp(uri);
  }

  hasPairing(deviceId: string) {
    return this.mod.hasPairing(deviceId);
  }

  forgetPairing(deviceId: string) {
    return this.mod.forgetPairing(deviceId);
  }

  subscribe(listener: Parameters<AtvRemote['subscribe']>[0]) {
    return this.emitter.subscribe(listener);
  }
}

export default (native ? new NativeRemote(native) : simulated) as AtvRemote;
