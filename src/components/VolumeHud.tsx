import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icons';
import { useRemote } from '../RemoteContext';
import { colors, radius, spacing } from '../theme';

/**
 * Floats in over the remote whenever the TV reports a new level, then fades.
 * The TV draws its own volume bar, but you're looking at your phone — so the
 * number has to be here too.
 */
export function VolumeHud({ top }: { top: number }) {
  const { state } = useRemote();
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-12)).current;
  const first = useRef(true);

  useEffect(() => {
    if (state.volume === null) return;
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.stopAnimation();
    slide.stopAnimation();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start(({ finished }) => {
      if (finished) slide.setValue(-12);
    });
  }, [state.volume, state.muted, opacity, slide]);

  if (state.volume === null) return null;

  const max = state.volumeMax && state.volumeMax > 0 ? state.volumeMax : 100;
  const percent = state.muted ? 0 : Math.round((Math.min(state.volume, max) / max) * 100);

  return (
    <Animated.View
      style={[styles.hud, { top, opacity, transform: [{ translateY: slide }] }]}
      pointerEvents="none"
    >
      {state.muted ? (
        <Icon.Mute size={18} color={colors.coralSoft} />
      ) : (
        <Icon.VolumeUp size={18} color={colors.text} />
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.value}>{state.muted ? 'Muted' : state.volume}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(24,24,33,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(244,87,63,0.28)',
    zIndex: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  track: {
    width: 140,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfacePress,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.coral },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
