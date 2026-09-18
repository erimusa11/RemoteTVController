import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

/**
 * Every control icon is drawn, not typed. Unicode symbols like ⏻ and ⌨ are
 * missing from most Android system fonts and render as empty boxes, so the
 * whole remote uses SVG paths instead.
 */
type IconProps = {
  size?: number;
  color?: string;
  /** Stroke weight in the 24x24 design grid. */
  weight?: number;
};

const Base = ({
  size = 24,
  color = colors.text,
  weight = 2,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const Icon = {
  Power: (p: IconProps) => (
    <Base {...p}>
      <Path d="M12 3.5 V12" />
      <Path d="M7.6 6.6 a7 7 0 1 0 8.8 0" />
    </Base>
  ),

  Home: (p: IconProps) => (
    <Base {...p}>
      <Path d="M3.5 11 L12 3.8 L20.5 11 V19.5 a1 1 0 0 1-1 1 H4.5 a1 1 0 0 1-1-1 Z" />
      <Path d="M9.5 20.5 v-5.5 h5 v5.5" />
    </Base>
  ),

  Back: (p: IconProps) => (
    <Base {...p}>
      <Path d="M9.5 14.5 L4.5 9.5 L9.5 4.5" />
      <Path d="M4.5 9.5 H15 a4.8 4.8 0 0 1 0 9.6 H7.5" />
    </Base>
  ),

  Menu: (p: IconProps) => (
    <Base {...p}>
      <Path d="M4 7 H20 M4 12 H20 M4 17 H20" />
    </Base>
  ),

  VolumeUp: (p: IconProps) => (
    <Base {...p}>
      <Path d="M4 9.5 H7.2 L12 5.2 V18.8 L7.2 14.5 H4 Z" />
      <Path d="M15.6 9.4 a4 4 0 0 1 0 5.2" />
      <Path d="M18.4 6.8 a8 8 0 0 1 0 10.4" />
    </Base>
  ),

  VolumeDown: (p: IconProps) => (
    <Base {...p}>
      <Path d="M4 9.5 H7.2 L12 5.2 V18.8 L7.2 14.5 H4 Z" />
      <Path d="M15.6 9.4 a4 4 0 0 1 0 5.2" />
    </Base>
  ),

  Mute: (p: IconProps) => (
    <Base {...p}>
      <Path d="M4 9.5 H7.2 L12 5.2 V18.8 L7.2 14.5 H4 Z" />
      <Path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" />
    </Base>
  ),

  Info: (p: IconProps) => (
    <Base {...p}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 11 V16.5" />
      <Circle cx="12" cy="7.8" r="0.9" fill={p.color ?? colors.text} />
    </Base>
  ),

  PlayPause: (p: IconProps) => (
    <Base {...p}>
      <Path d="M4 5.5 L12 12 L4 18.5 Z" />
      <Path d="M16 6 V18 M20.5 6 V18" />
    </Base>
  ),

  Rewind: (p: IconProps) => (
    <Base {...p}>
      <Path d="M11.5 6.5 L4.5 12 L11.5 17.5 Z" />
      <Path d="M20 6.5 L13 12 L20 17.5 Z" />
    </Base>
  ),

  Forward: (p: IconProps) => (
    <Base {...p}>
      <Path d="M12.5 6.5 L19.5 12 L12.5 17.5 Z" />
      <Path d="M4 6.5 L11 12 L4 17.5 Z" />
    </Base>
  ),

  Mic: (p: IconProps) => (
    <Base {...p}>
      <Path d="M12 3.5 a2.9 2.9 0 0 1 2.9 2.9 V12 a2.9 2.9 0 0 1-5.8 0 V6.4 A2.9 2.9 0 0 1 12 3.5 Z" />
      <Path d="M5.6 11.2 a6.4 6.4 0 0 0 12.8 0" />
      <Path d="M12 17.6 V20.5 M8.8 20.5 H15.2" />
    </Base>
  ),

  Search: (p: IconProps) => (
    <Base {...p}>
      <Circle cx="10.5" cy="10.5" r="6.2" />
      <Path d="M15 15 L20.5 20.5" />
    </Base>
  ),

  Keyboard: (p: IconProps) => (
    <Base {...p}>
      <Rect x="2.5" y="6" width="19" height="12" rx="2.2" />
      <Path d="M6 9.6 h0.01 M9.4 9.6 h0.01 M12.8 9.6 h0.01 M16.2 9.6 h0.01 M6 13 h0.01 M9.4 13 h0.01 M12.8 13 h0.01 M16.2 13 h0.01" strokeWidth={2.4} />
      <Path d="M8 15.8 H16" />
    </Base>
  ),

  Grid: (p: IconProps) => (
    <Base {...p}>
      <Rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <Rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <Rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </Base>
  ),

  RemotePad: (p: IconProps) => (
    <Base {...p}>
      <Rect x="7" y="2.5" width="10" height="19" rx="3.2" />
      <Circle cx="12" cy="8" r="2.4" />
      <Path d="M9.5 14.5 H14.5 M9.5 17.8 H14.5" />
    </Base>
  ),

  Backspace: (p: IconProps) => (
    <Base {...p}>
      <Path d="M20.5 4.5 H9.2 L3 12 L9.2 19.5 H20.5 a1 1 0 0 0 1-1 V5.5 a1 1 0 0 0-1-1 Z" />
      <Path d="M11.8 9.6 L16.8 14.4 M16.8 9.6 L11.8 14.4" />
    </Base>
  ),

  Enter: (p: IconProps) => (
    <Base {...p}>
      <Path d="M20.5 4.5 V11 a3.2 3.2 0 0 1-3.2 3.2 H4.5" />
      <Path d="M9 9.7 L4.5 14.2 L9 18.7" />
    </Base>
  ),

  Plus: (p: IconProps) => (
    <Base {...p} weight={p.weight ?? 2.4}>
      <Path d="M12 5.5 V18.5 M5.5 12 H18.5" />
    </Base>
  ),

  Minus: (p: IconProps) => (
    <Base {...p} weight={p.weight ?? 2.4}>
      <Path d="M5.5 12 H18.5" />
    </Base>
  ),

  /** Two crossing arrows — reads as "swap the input". */
  Source: (p: IconProps) => (
    <Base {...p}>
      <Path d="M4 8.5 H17 M13.8 5.3 L17 8.5 L13.8 11.7" />
      <Path d="M20 15.5 H7 M10.2 12.3 L7 15.5 L10.2 18.7" />
    </Base>
  ),

  Tv: (p: IconProps) => (
    <Base {...p}>
      <Rect x="2.5" y="7" width="19" height="13" rx="2.4" />
      <Path d="M8 3 L12 7 L16 3" />
    </Base>
  ),

  Guide: (p: IconProps) => (
    <Base {...p}>
      <Rect x="3" y="4.5" width="18" height="15" rx="2.2" />
      <Path d="M3 9.5 H21 M9.5 9.5 V19.5" />
    </Base>
  ),
};
