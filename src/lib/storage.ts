import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TvDevice } from '../transport/types';

/**
 * SECURITY: this file only ever persists non-secret device metadata (id,
 * name, host, port). AsyncStorage is plain SharedPreferences on Android —
 * readable on a rooted device or via `adb backup`. Certificates, private
 * keys, and pinned-fingerprint state for the native TLS module belong in
 * Android Keystore-backed storage instead, never here. See SECURITY.md.
 */

const KNOWN_KEY = 'remotetv.knownDevices';
const LAST_KEY = 'remotetv.lastDeviceId';

export async function loadKnownDevices(): Promise<TvDevice[]> {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_KEY);
    return raw ? (JSON.parse(raw) as TvDevice[]) : [];
  } catch {
    return [];
  }
}

export async function rememberDevice(device: TvDevice) {
  const known = await loadKnownDevices();
  const next = [device, ...known.filter((d) => d.id !== device.id)];
  await AsyncStorage.multiSet([
    [KNOWN_KEY, JSON.stringify(next)],
    [LAST_KEY, device.id],
  ]);
}

export async function forgetDevice(deviceId: string) {
  const known = await loadKnownDevices();
  const ops: Promise<unknown>[] = [
    AsyncStorage.setItem(KNOWN_KEY, JSON.stringify(known.filter((d) => d.id !== deviceId))),
  ];
  // Otherwise a forgotten "last device" leaves a dangling pointer that never
  // gets cleaned up — harmless today only because loadLastDevice() falls
  // back to null, but a trap for any future reader of LAST_KEY.
  const lastId = await AsyncStorage.getItem(LAST_KEY);
  if (lastId === deviceId) ops.push(AsyncStorage.removeItem(LAST_KEY));
  await Promise.all(ops);
}

export async function loadLastDevice(): Promise<TvDevice | null> {
  try {
    const [id, known] = await Promise.all([
      AsyncStorage.getItem(LAST_KEY),
      loadKnownDevices(),
    ]);
    return known.find((d) => d.id === id) ?? null;
  } catch {
    return null;
  }
}
