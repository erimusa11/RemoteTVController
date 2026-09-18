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
export function VolumeHud() {
  const { state } = useRemote();
  const opacity = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (state.volume === null) return;
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.stopAnimation();
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [state.volume, state.muted, opacity]);

  if (state.volume === null) return null;

  return (
    <Animated.View style={[styles.hud, { opacity }]} pointerEvents="none">
      {state.muted ? (
        <Icon.Mute size={18} color={colors.textMuted} />
      ) : (
        <Icon.VolumeUp size={18} color={colors.text} />
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${state.muted ? 0 : state.volume}%` }]} />
      </View>
      <Text style={styles.value}>{state.muted ? '--' : state.volume}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    top: spacing(2),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20,20,28,0.96)',
    borderWidth: 1,
    borderColor: colors.hairline,
    zIndex: 20,
  },
  track: {
    width: 120,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfacePress,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.coral },
  value: { color: colors.text, fontSize: 13, fontWeight: '700', width: 26, textAlign: 'right' },
});
