import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import remote from './transport/remote';
import type { KeyPressKind, TvDevice, TvState } from './transport/types';
import {
  forgetDevice,
  loadKnownDevices,
  loadLastDevice,
  loadPrefs,
  rememberDevice,
  savePrefs,
  updateKnownDevice,
  type Prefs,
} from './lib/storage';

const INITIAL: TvState = {
  status: 'idle',
  device: null,
  volume: null,
  volumeMax: null,
  muted: false,
  isOn: null,
  currentApp: null,
  error: null,
};

/** What a TV looks like once nothing is connected any more. */
const DISCONNECTED: Partial<TvState> = {
  status: 'idle',
  device: null,
  volume: null,
  volumeMax: null,
  muted: false,
  isOn: null,
  currentApp: null,
};

/**
 * Caps client-side pairing guesses. The 6-digit code is short-lived and shown
 * on the TV for a human to read, but nothing stops this app from being
 * scripted into throwing codes at a TV's pairing socket unattended — this
 * forces a fresh scan (and a fresh code) after repeated failures instead of
 * allowing an unbounded guess loop.
 */
const MAX_PAIR_ATTEMPTS = 5;

/** Back-off between attempts to revive a session that dropped mid-use. */
const RECONNECT_DELAYS_MS = [400, 1500, 3000, 6000];

type RemoteContextValue = {
  state: TvState;
  /** True when this build can actually reach a TV (false in the browser). */
  isReal: boolean;
  discovered: TvDevice[];
  known: TvDevice[];
  scanning: boolean;
  prefs: Prefs;

  /** Codes left before pairing is aborted back to the device list. */
  pairAttemptsRemaining: number;

  scan: () => Promise<void>;
  stopScan: () => Promise<void>;
  choose: (device: TvDevice) => Promise<void>;
  submitCode: (code: string) => Promise<void>;
  disconnect: () => Promise<void>;
  forget: (device: TvDevice) => Promise<void>;
  addManual: (host: string, name?: string) => Promise<void>;
  setPrefs: (patch: Partial<Prefs>) => void;

  press: (keyCode: number, kind?: KeyPressKind) => void;
  type: (text: string) => void;
  launch: (uri: string) => void;
  clearError: () => void;
};

const Ctx = createContext<RemoteContextValue | null>(null);

/**
 * Owns the connection lifecycle. Status is driven from here rather than by the
 * transports: the native module only reports what the TV says (connected,
 * volume, power, dropped), so pairing/connecting/reconnecting are ours to set.
 */
export function RemoteProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TvState>(INITIAL);
  const [discovered, setDiscovered] = useState<TvDevice[]>([]);
  const [known, setKnown] = useState<TvDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pairAttempts, setPairAttempts] = useState(0);
  const [prefs, setPrefsState] = useState<Prefs>({ navMode: 'dpad' });

  const patch = useCallback((p: Partial<TvState>) => setState((s) => ({ ...s, ...p })), []);

  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  /** The TV we are pairing with or connecting to. */
  const pendingDevice = useRef<TvDevice | null>(null);
  /** The TV the user wants to stay connected to; null once they disconnect. */
  const session = useRef<TvDevice | null>(null);
  /** Bumped whenever the user starts or abandons a flow, to discard stale results. */
  const attempt = useRef(0);
  const reconnecting = useRef(false);

  const refreshKnown = useCallback(async () => setKnown(await loadKnownDevices()), []);

  const reconnect = useCallback(async () => {
    const device = session.current;
    if (!device || reconnecting.current) return;
    reconnecting.current = true;
    patch({ status: 'reconnecting', error: null });

    try {
      for (const wait of RECONNECT_DELAYS_MS) {
        await delay(wait);
        if (session.current !== device) return;
        // A phone in a pocket must not snatch the TV back from the one in
        // someone's hand, and its retries would only fail on frozen Wi-Fi and
        // drop the session for good. Stay "reconnecting"; the AppState
        // listener below picks it up again when the app is opened.
        if (AppState.currentState === 'background') return;
        try {
          const fresh = await withCurrentAddress(device);
          if (session.current !== device) return;
          await remote.connect(fresh);
          if (session.current !== device) {
            await remote.disconnect().catch(() => {});
            return;
          }
          session.current = fresh;
          patch({ status: 'connected', device: fresh, error: null });
          if (fresh.host !== device.host) updateKnownDevice(fresh).then(refreshKnown);
          return;
        } catch {
          // Try again after the next back-off step.
        }
      }
      if (session.current === device) {
        session.current = null;
        patch({
          ...DISCONNECTED,
          error: `Lost the connection to ${device.name}. Check it's switched on and on the same Wi-Fi.`,
        });
      }
    } finally {
      reconnecting.current = false;
    }
  }, [patch, refreshKnown]);

  useEffect(
    () =>
      remote.subscribe((p) => {
        // The transport reports a dropped session as a plain "idle". If the
        // user didn't ask for that, revive it instead of dumping them back on
        // the device list mid-show.
        if (p.status === 'idle' && session.current) {
          const { status: _status, error: _error, ...rest } = p;
          patch(rest);
          reconnect();
          return;
        }
        patch(p);
      }),
    [patch, reconnect],
  );

  // Phones freeze background sockets; coming back should just work.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && session.current && statusRef.current !== 'connected') {
        reconnect();
      }
    });
    return () => sub.remove();
  }, [reconnect]);

  useEffect(() => {
    refreshKnown();
    loadPrefs().then(setPrefsState);
  }, [refreshKnown]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((current) => {
      const next = { ...current, ...p };
      savePrefs(next);
      return next;
    });
  }, []);

  /** Open the remote session with a TV we hold a pairing for. */
  const connectTo = useCallback(
    async (device: TvDevice, { resolveAddress = true } = {}) => {
      const token = ++attempt.current;
      pendingDevice.current = device;
      patch({ status: 'connecting', device, error: null });

      try {
        const fresh = resolveAddress ? await withCurrentAddress(device) : device;
        if (token !== attempt.current) return;
        if (fresh.host !== device.host) patch({ device: fresh });

        await remote.connect(fresh);
        if (token !== attempt.current) return;

        session.current = fresh;
        patch({ status: 'connected', device: fresh, error: null });
        await rememberDevice(fresh);
        await refreshKnown();
      } catch (e) {
        if (token !== attempt.current) return;
        patch({ ...DISCONNECTED, status: 'error', error: errorText(e) });
      }
    },
    [patch, refreshKnown],
  );

  /** Ask the TV to put a pairing code on screen. */
  const beginPairing = useCallback(
    async (device: TvDevice) => {
      const token = ++attempt.current;
      pendingDevice.current = device;
      patch({ status: 'pairing', device, error: null });
      try {
        await remote.startPairing(device);
        if (token !== attempt.current) return false;
        patch({ status: 'awaiting-code' });
        return true;
      } catch (e) {
        if (token === attempt.current) {
          patch({ ...DISCONNECTED, status: 'error', error: errorText(e) });
        }
        return false;
      }
    },
    [patch],
  );

  // A paired TV should just work when the app opens — no scan, no code.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const last = await loadLastDevice();
      if (!last || cancelled) return;
      if (!(await remote.hasPairing(last.id)) || cancelled) return;
      if (statusRef.current !== 'idle') return; // the user already picked something
      connectTo(last);
    })();
    return () => {
      cancelled = true;
    };
  }, [connectTo]);

  const scan = useCallback(async () => {
    setDiscovered([]);
    setScanning(true);
    try {
      await remote.discover((device) => {
        setDiscovered((list) =>
          list.some((d) => d.id === device.id) ? list : [...list, device],
        );
        // A known TV that moved to a new DHCP lease: keep its card current.
        setKnown((list) => {
          const match = list.find((d) => d.id === device.id);
          if (!match || match.host === device.host) return list;
          const moved = { ...match, host: device.host, port: device.port };
          updateKnownDevice(moved);
          return list.map((d) => (d.id === device.id ? moved : d));
        });
      });
    } catch (e) {
      patch({ error: errorText(e) });
    } finally {
      setScanning(false);
    }
  }, [patch]);

  const stopScan = useCallback(async () => {
    await remote.stopDiscovery().catch(() => {});
    setScanning(false);
  }, []);

  const choose = useCallback(
    async (device: TvDevice) => {
      setPairAttempts(0);
      await remote.stopDiscovery().catch(() => {});
      setScanning(false);
      if (await remote.hasPairing(device.id)) {
        // Tapping a remembered TV skips the scan, so its stored address may
        // be stale after a DHCP change — connectTo re-resolves before dialling.
        await connectTo(device);
      } else {
        await beginPairing(device);
      }
    },
    [beginPairing, connectTo],
  );

  const submitCode = useCallback(
    async (code: string) => {
      const device = pendingDevice.current;
      if (!device) throw new Error('Pick a TV first.');
      const token = attempt.current;

      try {
        await remote.submitCode(code);
      } catch (e) {
        if (token !== attempt.current) throw e;
        const attempts = pairAttempts + 1;
        setPairAttempts(attempts);

        if (attempts >= MAX_PAIR_ATTEMPTS) {
          attempt.current++;
          await remote.disconnect().catch(() => {});
          patch({ ...DISCONNECTED, error: 'Too many incorrect codes. Scan for the TV again.' });
          throw e;
        }

        if (errorCode(e) === 'ERR_PAIRING_RESTART') {
          // The TV hung up on that code; ask it for a fresh one.
          if (await beginPairing(device)) {
            patch({ error: 'That code didn’t work. Your TV is now showing a new one.' });
          }
        } else {
          patch({ status: 'awaiting-code', error: errorText(e) });
        }
        throw e;
      }

      if (token !== attempt.current) return;
      setPairAttempts(0);
      // Just proven over the pairing socket, so the address is known-good.
      await connectTo(device, { resolveAddress: false });
    },
    [beginPairing, connectTo, pairAttempts, patch],
  );

  const disconnect = useCallback(async () => {
    attempt.current++;
    session.current = null;
    pendingDevice.current = null;
    await remote.disconnect().catch(() => {});
    patch({ ...DISCONNECTED, error: null });
  }, [patch]);

  const forget = useCallback(
    async (device: TvDevice) => {
      await remote.forgetPairing(device.id).catch(() => {});
      await forgetDevice(device.id);
      await refreshKnown();
    },
    [refreshKnown],
  );

  const addManual = useCallback(
    async (host: string, name?: string) => {
      const cleanHost = host.trim();
      const device: TvDevice = {
        id: `manual-${cleanHost}`,
        name: name?.trim() || `TV ${cleanHost}`,
        host: cleanHost,
        port: 6466,
      };
      await choose(device);
    },
    [choose],
  );

  const press = useCallback(
    (keyCode: number, kind: KeyPressKind = 'short') => {
      // While a dropped session is being revived, presses would only fail.
      if (statusRef.current !== 'connected') return;
      remote.sendKey(keyCode, kind).catch((e) => patch({ error: errorText(e) }));
    },
    [patch],
  );

  const type = useCallback(
    (text: string) => {
      if (statusRef.current !== 'connected') return;
      remote.sendText(text).catch((e) => patch({ error: errorText(e) }));
    },
    [patch],
  );

  const launch = useCallback(
    (uri: string) => {
      if (statusRef.current !== 'connected') return;
      remote.launchApp(uri).catch((e) => patch({ error: errorText(e) }));
    },
    [patch],
  );

  const clearError = useCallback(() => patch({ error: null }), [patch]);

  const value = useMemo<RemoteContextValue>(
    () => ({
      state,
      isReal: remote.isReal,
      discovered,
      known,
      scanning,
      prefs,
      pairAttemptsRemaining: Math.max(0, MAX_PAIR_ATTEMPTS - pairAttempts),
      scan,
      stopScan,
      choose,
      submitCode,
      disconnect,
      forget,
      addManual,
      setPrefs,
      press,
      type,
      launch,
      clearError,
    }),
    [
      state, discovered, known, scanning, prefs, pairAttempts, scan, stopScan, choose,
      submitCode, disconnect, forget, addManual, setPrefs, press, type, launch, clearError,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRemote() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRemote must be used inside <RemoteProvider>');
  return ctx;
}

/** How long to hunt for a moved TV before falling back to its last address. */
const REDISCOVER_TIMEOUT_MS = 2500;

/**
 * Almost every home network hands out addresses over DHCP, so a TV's IP is a
 * cache — not its identity. It changes when the lease turns over, when the TV
 * reboots, or when the router does. The stable identifier is the mDNS service
 * name (`TvDevice.id`), so before reconnecting we re-resolve that name to
 * whatever address the TV has right now.
 *
 * If mDNS finds nothing in time — some routers block multicast, and manually
 * added devices were never discoverable to begin with — we fall back to the
 * stored address rather than refusing to connect.
 */
async function withCurrentAddress(device: TvDevice): Promise<TvDevice> {
  // A hand-typed address has no service name to resolve, so leave it alone.
  if (device.id.startsWith('manual-')) return device;

  return new Promise<TvDevice>((resolve) => {
    let settled = false;
    const finish = (result: TvDevice) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      remote.stopDiscovery().catch(() => {});
      resolve(result);
    };

    const timer = setTimeout(() => finish(device), REDISCOVER_TIMEOUT_MS);

    remote
      .discover((found) => {
        if (found.id !== device.id) return;
        finish({ ...device, host: found.host, port: found.port });
      })
      .then(() => finish(device))
      .catch(() => finish(device));
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong';

const errorCode = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : null;
