import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

/**
 * The "Remote TV" mark redrawn as vector art: rabbit-ear antennas over a
 * barrel-shaped CRT. Drawn rather than bitmapped so it stays sharp from a
 * 24pt header badge up to the 96pt hero on the connect screen.
 */
export function LogoMark({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Line x1="50" y1="44" x2="31" y2="19" stroke={colors.deepRed} strokeWidth={3.4} strokeLinecap="round" />
      <Line x1="50" y1="44" x2="69" y2="19" stroke={colors.deepRed} strokeWidth={3.4} strokeLinecap="round" />
      <Circle cx="29" cy="17" r="5.4" fill={colors.deepRed} />
      <Circle cx="71" cy="17" r="5.4" fill={colors.deepRed} />

      <Path
        d="M18 50 Q50 43 82 50 Q87 67 82 85 Q50 92 18 85 Q13 67 18 50 Z"
        stroke={colors.coral}
        strokeWidth={6.5}
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x="36" y="90" width="28" height="7" rx="3" fill={colors.deepRed} />
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
