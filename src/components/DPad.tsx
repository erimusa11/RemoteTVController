import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';
import { tap, bump } from '../lib/haptics';

type Sector = 'up' | 'right' | 'down' | 'left' | 'ok' | null;

type Props = {
  size?: number;
  onPress: (sector: Exclude<Sector, null>) => void;
  /** Repeat rate while a direction is held down, in ms. */
  repeatInterval?: number;
};

/**
 * Hit testing is done by polar coordinates rather than a grid of rectangles:
 * the touch's angle from centre picks the wedge and its radius picks OK vs
 * ring. That means the whole circle is live — no dead diagonals — and the
 * highlighted wedge always matches exactly what the finger is over.
 */
export function DPad({ size = 264, onPress, repeatInterval = 130 }: Props) {
  const [active, setActive] = useState<Sector>(null);
  const activeRef = useRef<Sector>(null);
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({});

  const clearTimers = useCallback(() => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.interval) clearInterval(timers.current.interval);
    timers.current = {};
  }, []);

  // onPanResponderRelease/Terminate never fires if the pad unmounts mid-hold
  // (switching tabs, disconnecting) — without this the repeat interval keeps
  // firing onPress against a detached component forever.
  useEffect(() => clearTimers, [clearTimers]);

  const sectorAt = useCallback(
    (x: number, y: number): Sector => {
      const c = size / 2;
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > c) return null;
      if (r < size * 0.19) return 'ok';

      // atan2 gives -180..180 with 0 pointing right and positive going down.
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg >= -45 && deg < 45) return 'right';
      if (deg >= 45 && deg < 135) return 'down';
      if (deg >= -135 && deg < -45) return 'up';
      return 'left';
    },
    [size],
  );

  const engage = useCallback(
    (sector: Sector) => {
      if (!sector) return;
      activeRef.current = sector;
      setActive(sector);
      sector === 'ok' ? bump() : tap();
      onPress(sector);

      clearTimers();
      if (sector === 'ok') return;
      timers.current.delay = setTimeout(() => {
        timers.current.interval = setInterval(() => {
          const held = activeRef.current;
          if (held && held !== 'ok') {
            tap();
            onPress(held);
          }
        }, repeatInterval);
      }, 450);
    },
    [clearTimers, onPress, repeatInterval],
  );

  const release = useCallback(() => {
    activeRef.current = null;
    setActive(null);
    clearTimers();
  }, [clearTimers]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          engage(sectorAt(e.nativeEvent.locationX, e.nativeEvent.locationY));
        },
        onPanResponderMove: (e) => {
          // Sliding onto a different wedge re-triggers, like a physical rocker.
          const next = sectorAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (next && next !== activeRef.current) engage(next);
        },
        onPanResponderRelease: release,
        onPanResponderTerminate: release,
      }),
    [engage, release, sectorAt],
  );

  const fillFor = (s: Sector) => (active === s ? colors.coralDim : 'transparent');

  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}
      {...responder.panHandlers}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
        <Circle cx="50" cy="50" r="49" fill={colors.surface} />
        <Circle cx="50" cy="50" r="49" fill="none" stroke={colors.hairline} strokeWidth={1} />

        <Path d={WEDGE.up} fill={fillFor('up')} />
        <Path d={WEDGE.right} fill={fillFor('right')} />
        <Path d={WEDGE.down} fill={fillFor('down')} />
        <Path d={WEDGE.left} fill={fillFor('left')} />

        {CHEVRON.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={active === (['up', 'right', 'down', 'left'] as const)[i] ? colors.coral : colors.textMuted}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}

        <Circle
          cx="50"
          cy="50"
          r="19"
          fill={active === 'ok' ? colors.coral : colors.surfaceHigh}
          stroke={colors.hairline}
          strokeWidth={1}
        />
      </Svg>

      <View style={styles.okLabel} pointerEvents="none">
        <Text style={[styles.okText, active === 'ok' && { color: '#fff' }]}>OK</Text>
      </View>
    </View>
  );
}

/** Annulus sectors between r=17 and r=48, one per direction. */
const WEDGE = {
  up: 'M16.06 16.06 A48 48 0 0 1 83.94 16.06 L62.02 37.98 A17 17 0 0 0 37.98 37.98 Z',
  right: 'M83.94 16.06 A48 48 0 0 1 83.94 83.94 L62.02 62.02 A17 17 0 0 0 62.02 37.98 Z',
  down: 'M83.94 83.94 A48 48 0 0 1 16.06 83.94 L37.98 62.02 A17 17 0 0 0 62.02 62.02 Z',
  left: 'M16.06 83.94 A48 48 0 0 1 16.06 16.06 L37.98 37.98 A17 17 0 0 0 37.98 62.02 Z',
} as const;

const CHEVRON = [
  'M44 25 L50 18 L56 25', // up
  'M75 44 L82 50 L75 56', // right
  'M44 75 L50 82 L56 75', // down
  'M25 44 L18 50 L25 56', // left
];

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  okLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: { color: colors.text, fontWeight: '700', fontSize: 17, letterSpacing: 1 },
});
