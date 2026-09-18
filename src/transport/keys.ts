/**
 * Android `KEYCODE_*` constants, as accepted by the TV's key-inject message.
 * Values match android.view.KeyEvent.
 */
export const KEY = {
  BACK: 4,
  HOME: 3,
  MENU: 82,
  POWER: 26,
  SEARCH: 84,
  ASSIST: 219,
  SETTINGS: 176,
  NOTIFICATION: 83,
  GUIDE: 172,
  INFO: 165,
  TV: 170,
  /** Opens the TV's input picker rather than selecting a port. */
  TV_INPUT: 178,

  // Jump straight to a physical port. Added in API 21 and handled by the TV's
  // own input framework, so support varies by manufacturer — see SOURCES below.
  TV_INPUT_HDMI_1: 243,
  TV_INPUT_HDMI_2: 244,
  TV_INPUT_HDMI_3: 245,
  TV_INPUT_HDMI_4: 246,
  TV_INPUT_COMPOSITE_1: 247,
  TV_INPUT_COMPONENT_1: 249,
  TV_INPUT_VGA_1: 251,

  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  DPAD_CENTER: 23,
  ENTER: 66,

  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  VOLUME_MUTE: 164,

  CHANNEL_UP: 166,
  CHANNEL_DOWN: 167,

  MEDIA_PLAY_PAUSE: 85,
  MEDIA_STOP: 86,
  MEDIA_NEXT: 87,
  MEDIA_PREVIOUS: 88,
  MEDIA_REWIND: 89,
  MEDIA_FAST_FORWARD: 90,

  DEL: 67,
  SPACE: 62,
} as const;

/**
 * The source strip. `TV_INPUT` always works — it opens whatever input picker
 * the TV ships. The direct-port codes below are forwarded by Google TV but
 * only acted on if the manufacturer wired them up, which is why the picker
 * stays first in the list as the guaranteed fallback.
 */
export const SOURCES = [
  { id: 'picker', label: 'Picker', key: KEY.TV_INPUT },
  { id: 'hdmi1', label: 'HDMI 1', key: KEY.TV_INPUT_HDMI_1 },
  { id: 'hdmi2', label: 'HDMI 2', key: KEY.TV_INPUT_HDMI_2 },
  { id: 'hdmi3', label: 'HDMI 3', key: KEY.TV_INPUT_HDMI_3 },
  { id: 'hdmi4', label: 'HDMI 4', key: KEY.TV_INPUT_HDMI_4 },
  { id: 'av', label: 'AV', key: KEY.TV_INPUT_COMPOSITE_1 },
  { id: 'tv', label: 'TV', key: KEY.TV },
] as const;
