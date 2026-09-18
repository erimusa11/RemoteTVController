import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import remote from './transport/remote';
import type { KeyPressKind, TvDevice, TvState } from './transport/types';
import {
  loadKnownDevices,
  loadLastDevice,
  rememberDevice,
  forgetDevice,
} from './lib/storage';

const INITIAL: TvState = {
  status: 'idle',
  device: null,
  volume: null,
  muted: false,
  currentApp: null,
  error: null,
};

/**
 * Caps client-side pairing guesses. The 6-digit code is short-lived and shown
 * on the TV for a human to read, but nothing stops this app from being
 * scripted into throwing codes at a TV's pairing socket unattended — this
 * forces a fresh scan (and a fresh code) after repeated failures instead of
 * allowing an unbounded guess loop.
 */
const MAX_PAIR_ATTEMPTS = 5;

type RemoteContextValue = {
  state: TvState;
  /** True when this build can actually reach a TV (false in the browser). */
  isReal: boolean;
  discovered: TvDevice[];
  known: TvDevice[];
  scanning: boolean;

  /** Codes left before pairing is aborted back to the device list. */
  pairAttemptsRemaining: number;

  scan: () => Promise<void>;
  stopScan: () => Promise<void>;
  choose: (device: TvDevice) => Promise<void>;
  submitCode: (code: string) => Promise<void>;
  disconnect: () => Promise<void>;
  forget: (device: TvDevice) => Promise<void>;
  addManual: (host: string, name?: string) => Promise<void>;

  press: (keyCode: number, kind?: KeyPressKind) => void;
  type: (text: string) => void;
  launch: (uri: string) => void;
  clearError: () => void;
};

const Ctx = createContext<RemoteContextValue | null>(null);

export function RemoteProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TvState>(INITIAL);
  const [discovered, setDiscovered] = useState<TvDevice[]>([]);
  const [known, setKnown] = useState<TvDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pairAttempts, setPairAttempts] = useState(0);
  const pendingDevice = useRef<TvDevice | null>(null);

  useEffect(() => remote.subscribe((patch) => setState((s) => ({ ...s, ...patch }))), []);

  useEffect(() => {
    loadKnownDevices().then(setKnown);
  }, []);

  // A paired TV should just work when the app opens — no scan, no code.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const last = await loadLastDevice();
      if (!last || cancelled) return;
      if (await remote.hasPairing(last.id)) {
        remote.connect(last).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scan = useCallback(async () => {
    setDiscovered([]);
    setScanning(true);
    try {
      await remote.discover((device) =>
        setDiscovered((list) =>
          list.some((d) => d.id === device.id) ? list : [...list, device],
        ),
      );
    } catch (e) {
      setState((s) => ({ ...s, error: errorText(e) }));
    } finally {
      setScanning(false);
    }
  }, []);

  const stopScan = useCallback(async () => {
    await remote.stopDiscovery().catch(() => {});
    setScanning(false);
  }, []);

  const choose = useCallback(async (device: TvDevice) => {
    pendingDevice.current = device;
    setPairAttempts(0);
    await stopScanQuietly();
    setState((s) => ({ ...s, error: null, device }));
    try {
      // Skip the code entirely if we still hold a certificate for this TV.
      if (await remote.hasPairing(device.id)) {
        await remote.connect(device);
      } else {
        await remote.startPairing(device);
      }
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: errorText(e) }));
    }
  }, []);

  const submitCode = useCallback(
    async (code: string) => {
      try {
        await remote.submitCode(code);
        const device = pendingDevice.current;
        if (device) {
          await rememberDevice(device);
          setKnown(await loadKnownDevices());
        }
        setPairAttempts(0);
      } catch (e) {
        const attempts = pairAttempts + 1;
        setPairAttempts(attempts);

        if (attempts >= MAX_PAIR_ATTEMPTS) {
          await remote.disconnect().catch(() => {});
          setState((s) => ({
            ...s,
            status: 'idle',
            device: null,
            error: 'Too many incorrect codes. Scan for the TV again.',
          }));
          throw e;
        }

        setState((s) => ({ ...s, status: 'awaiting-code', error: errorText(e) }));
        throw e;
      }
    },
    [pairAttempts],
  );

  const disconnect = useCallback(async () => {
    await remote.disconnect().catch(() => {});
    setState((s) => ({ ...s, status: 'idle', device: null, currentApp: null }));
  }, []);

  const forget = useCallback(async (device: TvDevice) => {
    await remote.forgetPairing(device.id).catch(() => {});
    await forgetDevice(device.id);
    setKnown(await loadKnownDevices());
  }, []);

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

  const press = useCallback((keyCode: number, kind: KeyPressKind = 'short') => {
    remote.sendKey(keyCode, kind).catch((e) =>
      setState((s) => ({ ...s, error: errorText(e) })),
    );
  }, []);

  const type = useCallback((text: string) => {
    remote.sendText(text).catch(() => {});
  }, []);

  const launch = useCallback((uri: string) => {
    remote.launchApp(uri).catch((e) =>
      setState((s) => ({ ...s, error: errorText(e) })),
    );
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const value = useMemo<RemoteContextValue>(
    () => ({
      state,
      isReal: remote.isReal,
      discovered,
      known,
      scanning,
      pairAttemptsRemaining: Math.max(0, MAX_PAIR_ATTEMPTS - pairAttempts),
      scan,
      stopScan,
      choose,
      submitCode,
      disconnect,
      forget,
      addManual,
      press,
      type,
      launch,
      clearError,
    }),
    [
      state, discovered, known, scanning, pairAttempts, scan, stopScan, choose, submitCode,
      disconnect, forget, addManual, press, type, launch, clearError,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRemote() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRemote must be used inside <RemoteProvider>');
  return ctx;
}

const stopScanQuietly = () => remote.stopDiscovery().catch(() => {});

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong';
