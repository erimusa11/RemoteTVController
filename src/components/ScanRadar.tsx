import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { LogoMark } from './Logo';
import { colors } from '../theme';

/**
 * Three rings expanding out of the logo on a stagger, so scanning reads as
 * something actively reaching across the room rather than a spinner.
 */
export function ScanRadar({ size = 220, active }: { size?: number; active: boolean }) {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    if (!active) {
      rings.forEach((r) => r.setValue(0));
      return;
    }
    const animations = rings.map((ring, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(ring, {
            toValue: 1,
            duration: 2100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {active
        ? rings.map((ring, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                  transform: [
                    { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
                  ],
                },
              ]}
            />
          ))
        : null}
      <LogoMark size={size * 0.42} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.coral,
  },
});
