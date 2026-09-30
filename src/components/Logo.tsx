import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme';

/** Same artwork as assets/brand/icon-full.svg, as a rounded tile. */
export function LogoMark({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="lmBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.coralSoft} />
          <Stop offset="0.55" stopColor={colors.coral} />
          <Stop offset="1" stopColor={colors.deepRed} />
        </LinearGradient>
        <LinearGradient id="lmScreen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1C1016" />
          <Stop offset="1" stopColor={colors.bg} />
        </LinearGradient>
      </Defs>

      <Rect width="1024" height="1024" rx="230" fill="url(#lmBg)" />

      <G transform="translate(0 22)">
        <Line x1="512" y1="318" x2="410" y2="196" stroke="#FFFFFF" strokeWidth={30} strokeLinecap="round" />
        <Line x1="512" y1="318" x2="614" y2="196" stroke="#FFFFFF" strokeWidth={30} strokeLinecap="round" />
        <Circle cx="410" cy="196" r="28" fill="#FFFFFF" />
        <Circle cx="614" cy="196" r="28" fill="#FFFFFF" />

        <Rect x="196" y="318" width="632" height="436" rx="110" fill="#FFFFFF" />
        <Rect x="244" y="366" width="536" height="340" rx="70" fill="url(#lmScreen)" />

        <Path d="M448.4 546.4 A90 90 0 0 1 575.6 546.4" stroke={colors.coral} strokeWidth={36} strokeLinecap="round" fill="none" />
        <Path d="M391.8 489.8 A170 170 0 0 1 632.2 489.8" stroke={colors.coral} strokeWidth={36} strokeLinecap="round" fill="none" />
        <Circle cx="512" cy="616" r="34" fill={colors.coralSoft} />

        <Rect x="412" y="776" width="200" height="36" rx="18" fill="#FFFFFF" />
      </G>
    </Svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.wordmark}>
      <Text style={[styles.word, { fontSize: size, color: colors.coral }]}>Remote</Text>
      <Text style={[styles.word, { fontSize: size, color: colors.deepRed }]}> TV</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'baseline' },
  word: { fontWeight: '800', letterSpacing: -0.5 },
});
