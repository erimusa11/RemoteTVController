/**
 * Deep links handed to the TV's app-launch message. Google TV resolves these
 * the same way it resolves a link from a phone's cast/share sheet, so a plain
 * https URL is enough for most streaming apps.
 */
export type AppShortcut = {
  id: string;
  name: string;
  uri: string;
  /** Package names the TV reports while this app is in the foreground. */
  packages: string[];
  /** Brand colours for the tile gradient. */
  tint: string;
  tint2: string;
  /** Fallback label, for tiles without drawn artwork. */
  glyph: string;
  /** Glyph colour, for brands whose tile is light. */
  ink?: string;
};

export const APP_SHORTCUTS: AppShortcut[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    uri: 'https://www.youtube.com',
    packages: ['com.google.android.youtube.tv', 'com.google.android.youtube'],
    tint: '#FF0033',
    tint2: '#B3001F',
    glyph: 'YT',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    uri: 'https://www.netflix.com/title',
    packages: ['com.netflix.ninja', 'com.netflix.mediaclient'],
    tint: '#E50914',
    tint2: '#6E0409',
    glyph: 'N',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    uri: 'https://app.primevideo.com',
    packages: ['com.amazon.amazonvideo.livingroom', 'com.amazon.avod.thirdpartyclient'],
    tint: '#1FA2E0',
    tint2: '#0B5A86',
    glyph: 'prime',
  },
  {
    id: 'disney',
    name: 'Disney+',
    uri: 'https://www.disneyplus.com',
    packages: ['com.disney.disneyplus'],
    tint: '#1B3E8C',
    tint2: '#0A1633',
    glyph: 'D+',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    uri: 'spotify://',
    packages: ['com.spotify.tv.android', 'com.spotify.music'],
    tint: '#1ED760',
    tint2: '#0E7A35',
    glyph: 'SP',
  },
  {
    id: 'plex',
    name: 'Plex',
    uri: 'https://app.plex.tv',
    packages: ['com.plexapp.android'],
    tint: '#F2B90F',
    tint2: '#9A6A00',
    glyph: 'PX',
    ink: '#1F1F1F',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    uri: 'https://www.twitch.tv',
    packages: ['tv.twitch.android.app', 'tv.twitch.android.viewer'],
    tint: '#9146FF',
    tint2: '#4B1FA3',
    glyph: 'tw',
  },
  {
    id: 'dazn',
    name: 'DAZN',
    uri: 'https://www.dazn.com',
    packages: ['com.dazn'],
    tint: '#F8F800',
    tint2: '#A8A800',
    glyph: 'DZ',
    ink: '#0C0C0C',
  },
];

const LAUNCHERS = [
  'com.google.android.tvlauncher',
  'com.google.android.apps.tv.launcherx',
  'com.google.android.leanbacklauncher',
];

/** Which shortcut, if any, owns the package (or launch URI) the TV reported. */
export function appFor(current: string | null): AppShortcut | null {
  if (!current) return null;
  return (
    APP_SHORTCUTS.find(
      (app) => app.uri === current || app.packages.some((p) => current.startsWith(p)),
    ) ?? null
  );
}

/** A human name for whatever is on screen, e.g. "Netflix" or "Home screen". */
export function appLabel(current: string | null): string | null {
  if (!current) return null;
  if (LAUNCHERS.some((p) => current.startsWith(p))) return 'Home screen';
  const known = appFor(current);
  if (known) return known.name;
  // Unknown package: "com.example.super_app" reads better as "Super app".
  const last = current.split(/[./:]/).filter(Boolean).pop() ?? current;
  const words = last.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
