/**
 * Deep links handed to the TV's app-launch message. Google TV resolves these
 * the same way it resolves a link from a phone's cast/share sheet, so a plain
 * https URL is enough for most streaming apps.
 */
export type AppShortcut = {
  id: string;
  name: string;
  uri: string;
  /** Brand colour, used for the tile. */
  tint: string;
  /** Short label drawn when we have no artwork. */
  glyph: string;
};

export const APP_SHORTCUTS: AppShortcut[] = [
  { id: 'youtube', name: 'YouTube', uri: 'https://www.youtube.com', tint: '#FF0033', glyph: 'YT' },
  { id: 'netflix', name: 'Netflix', uri: 'https://www.netflix.com/title', tint: '#E50914', glyph: 'N' },
  { id: 'prime', name: 'Prime Video', uri: 'https://app.primevideo.com', tint: '#1FA2E0', glyph: 'PV' },
  { id: 'disney', name: 'Disney+', uri: 'https://www.disneyplus.com', tint: '#0C204D', glyph: 'D+' },
  { id: 'spotify', name: 'Spotify', uri: 'spotify://', tint: '#1DB954', glyph: 'SP' },
  { id: 'plex', name: 'Plex', uri: 'https://app.plex.tv', tint: '#E5A00D', glyph: 'PX' },
  { id: 'twitch', name: 'Twitch', uri: 'https://www.twitch.tv', tint: '#9146FF', glyph: 'tw' },
  { id: 'dazn', name: 'DAZN', uri: 'https://www.dazn.com', tint: '#F8F800', glyph: 'DZ' },
];
