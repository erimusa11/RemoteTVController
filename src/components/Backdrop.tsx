import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme';

/**
 * Two out-of-focus colour blobs behind everything — coral warming the top,
 * deep red weighting the bottom. Keeps the near-black UI from reading flat
 * without competing with the controls.
 */
export function Backdrop() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="warm" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.coral} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.coral} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="deep" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.deepRed} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.deepRed} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill={colors.bg} />
        <Circle cx={width * 0.18} cy={height * 0.06} r={width * 0.72} fill="url(#warm)" />
        <Circle cx={width * 0.95} cy={height * 0.92} r={width * 0.8} fill="url(#deep)" />
      </Svg>
    </View>
  );
}
