/**
 * Palette lifted from the "Remote TV by ERI" logo: a bright coral for the
 * primary surface, a deep red for weight and accents.
 */
export const colors = {
  coral: '#F4573F',
  coralSoft: '#FF7A66',
  coralDim: 'rgba(244, 87, 63, 0.14)',
  deepRed: '#B00D1E',

  bg: '#0B0B10',
  surface: '#15151D',
  surfaceHigh: '#1F1F2A',
  surfacePress: '#2B2B39',
  hairline: 'rgba(255, 255, 255, 0.08)',

  text: '#F6F6F8',
  textMuted: '#8C8C9E',
  textFaint: '#5A5A6B',

  green: '#3ECF8E',
  amber: '#F5A623',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  glow: {
    shadowColor: colors.coral,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
} as const;
