import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '../theme';
import { tap } from '../lib/haptics';

type Props = {
  onPress: () => void;
  /** Fired repeatedly while held — used by volume and channel keys. */
  onRepeat?: () => void;
  label?: string;
  icon?: React.ReactNode;
  variant?: 'surface' | 'accent' | 'ghost' | 'danger';
  size?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const REPEAT_DELAY = 420;
const REPEAT_INTERVAL = 110;

export function RemoteButton({
  onPress,
  onRepeat,
  label,
  icon,
  variant = 'surface',
  size = 62,
  round = true,
  style,
  accessibilityLabel,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({});

  const clearTimers = useCallback(() => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.interval) clearInterval(timers.current.interval);
    timers.current = {};
  }, []);

  const spring = useCallback(
    (to: number) =>
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 40,
        bounciness: 8,
      }).start(),
    [scale],
  );

  const handlePressIn = useCallback(() => {
    setPressed(true);
    spring(0.9);
    tap();
    onPress();
    if (!onRepeat) return;
    timers.current.delay = setTimeout(() => {
      timers.current.interval = setInterval(onRepeat, REPEAT_INTERVAL);
    }, REPEAT_DELAY);
  }, [onPress, onRepeat, spring]);

  const handlePressOut = useCallback(() => {
    setPressed(false);
    spring(1);
    clearTimers();
  }, [clearTimers, spring]);

  // onPressOut never fires if the button unmounts mid-hold (switching tabs,
  // disconnecting) — without this the repeat interval outlives the component
  // and keeps calling onRepeat against a detached closure forever.
  useEffect(() => clearTimers, [clearTimers]);

  const palette = VARIANTS[variant];
  const glow = variant === 'accent' || variant === 'danger';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={[
          styles.base,
          glow && { shadowColor: palette.bg, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8 },
          {
            width: size,
            height: size,
            borderRadius: round ? size / 2 : radius.md,
            backgroundColor: pressed ? palette.pressBg : palette.bg,
            borderColor: palette.border,
          },
        ]}
      >
        {icon ?? null}
        {label ? (
          <Text
            style={[
              styles.label,
              { color: palette.fg, fontSize: label.length > 3 ? 12 : 16 },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const VARIANTS = {
  surface: {
    bg: colors.surfaceHigh,
    pressBg: colors.surfacePress,
    fg: colors.text,
    border: colors.hairline,
  },
  accent: {
    bg: colors.coral,
    pressBg: colors.coralSoft,
    fg: '#fff',
    border: 'transparent',
  },
  ghost: {
    bg: 'transparent',
    pressBg: colors.surfaceHigh,
    fg: colors.textMuted,
    border: colors.hairline,
  },
  danger: {
    bg: colors.deepRed,
    pressBg: '#D4162A',
    fg: '#fff',
    border: 'transparent',
  },
} as const;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 2,
    shadowOffset: { width: 0, height: 4 },
  },
  label: { fontWeight: '600' },
});
