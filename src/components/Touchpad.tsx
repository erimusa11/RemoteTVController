import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { bump, tap } from '../lib/haptics';
import { colors, radius } from '../theme';

type Direction = 'up' | 'down' | 'left' | 'right';

type Props = {
  width: number;
  height: number;
  onMove: (direction: Direction) => void;
  onSelect: () => void;
};

/** Finger travel that counts as one step; dragging further keeps stepping. */
const STEP_PX = 42;
/** A touch shorter and stiller than this is a tap, i.e. OK. */
const TAP_MS = 260;
const TAP_SLOP_PX = 10;

/**
 * Swipe surface, like the trackpad in Google's own remote app. Each STEP_PX
 * of travel along the dominant axis sends one D-pad press, so a long drag
 * scrolls a row of posters and a flick moves one tile.
 */
export function Touchpad({ width, height, onMove, onSelect }: Props) {
  const [flash, setFlash] = useState<Direction | 'ok' | null>(null);
  const ripple = useRef(new Animated.Value(0)).current;
  const ripplePos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const gesture = useRef({ originX: 0, originY: 0, startX: 0, startY: 0, startedAt: 0, moved: false });

  const show = (what: Direction | 'ok') => {
    setFlash(what);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 220);
  };

  const pulse = (x: number, y: number) => {
    ripplePos.setValue({ x, y });
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          gesture.current = {
            originX: x,
            originY: y,
            startX: x,
            startY: y,
            startedAt: Date.now(),
            moved: false,
          };
          pulse(x, y);
        },
        onPanResponderMove: (e) => {
          const g = gesture.current;
          const { locationX: x, locationY: y } = e.nativeEvent;
          const dx = x - g.originX;
          const dy = y - g.originY;
          if (Math.hypot(x - g.startX, y - g.startY) > TAP_SLOP_PX) g.moved = true;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < STEP_PX) return;

          const direction: Direction =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          tap();
          onMove(direction);
          show(direction);
          g.originX = x;
          g.originY = y;
        },
        onPanResponderRelease: (e) => {
          const g = gesture.current;
          if (!g.moved && Date.now() - g.startedAt < TAP_MS) {
            bump();
            onSelect();
            show('ok');
            pulse(e.nativeEvent.locationX, e.nativeEvent.locationY);
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onMove, onSelect],
  );

  const edge = (d: Direction) => (flash === d ? 1 : 0);

  return (
    <View style={[styles.pad, { width, height }]} {...responder.panHandlers}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="tpBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surfaceHigh} />
            <Stop offset="1" stopColor={colors.surface} />
          </LinearGradient>
          <Pattern id="tpDots" width="22" height="22" patternUnits="userSpaceOnUse">
            <Circle cx="11" cy="11" r="1.1" fill="rgba(255,255,255,0.09)" />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} rx={radius.xl} fill="url(#tpBg)" />
        <Rect width={width} height={height} rx={radius.xl} fill="url(#tpDots)" />
      </Svg>

      {/* Edge glows show which way the last step went. */}
      <View style={[styles.edge, styles.edgeTop, { opacity: edge('up') }]} pointerEvents="none" />
      <View style={[styles.edge, styles.edgeBottom, { opacity: edge('down') }]} pointerEvents="none" />
      <View style={[styles.edgeV, styles.edgeLeft, { opacity: edge('left') }]} pointerEvents="none" />
      <View style={[styles.edgeV, styles.edgeRight, { opacity: edge('right') }]} pointerEvents="none" />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [
              { translateX: Animated.subtract(ripplePos.x, RIPPLE / 2) },
              { translateY: Animated.subtract(ripplePos.y, RIPPLE / 2) },
              { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) },
            ],
          },
        ]}
      />

      <View style={styles.hint} pointerEvents="none">
        <Text style={[styles.hintTitle, flash === 'ok' && { color: colors.coral }]}>
          {flash === 'ok' ? 'OK' : 'Swipe to move'}
        </Text>
        <Text style={styles.hintSub}>Tap to select · drag to keep scrolling</Text>
      </View>
    </View>
  );
}

const RIPPLE = 120;
const EDGE = 5;

const styles = StyleSheet.create({
  pad: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  edge: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    height: EDGE,
    borderRadius: EDGE,
    backgroundColor: colors.coral,
  },
  edgeTop: { top: 6 },
  edgeBottom: { bottom: 6 },
  edgeV: {
    position: 'absolute',
    top: '15%',
    bottom: '15%',
    width: EDGE,
    borderRadius: EDGE,
    backgroundColor: colors.coral,
  },
  edgeLeft: { left: 6 },
  edgeRight: { right: 6 },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RIPPLE,
    height: RIPPLE,
    borderRadius: RIPPLE / 2,
    borderWidth: 2,
    borderColor: colors.coralSoft,
    backgroundColor: colors.coralDim,
  },
  hint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hintTitle: { color: colors.textMuted, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  hintSub: { color: colors.textFaint, fontSize: 12 },
});
