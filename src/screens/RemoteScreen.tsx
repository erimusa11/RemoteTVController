import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { DPad } from '../components/DPad';
import { Icon } from '../components/Icons';
import { LogoMark } from '../components/Logo';
import { RemoteButton } from '../components/RemoteButton';
import { Touchpad } from '../components/Touchpad';
import { VolumeHud } from '../components/VolumeHud';
import { useRemote } from '../RemoteContext';
import { APP_SHORTCUTS, appFor, appLabel, type AppShortcut } from '../transport/apps';
import { KEY, SOURCES } from '../transport/keys';
import { colors, radius, shadow, spacing } from '../theme';
import { bump, tap } from '../lib/haptics';

type Tab = 'remote' | 'apps' | 'keyboard';

const SECTOR_KEY = {
  up: KEY.DPAD_UP,
  down: KEY.DPAD_DOWN,
  left: KEY.DPAD_LEFT,
  right: KEY.DPAD_RIGHT,
  ok: KEY.DPAD_CENTER,
} as const;

const TOAST_MS = 4500;

export function RemoteScreen() {
  const { state, disconnect } = useRemote();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('remote');

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing(2) }]}>
      <Header onDisconnect={disconnect} />
      <VolumeHud top={insets.top + spacing(2)} />
      <StatusBanners />
      <ErrorToast />

      <View style={styles.pane}>
        {tab === 'remote' ? <RemotePane /> : null}
        {tab === 'apps' ? <AppsPane /> : null}
        {tab === 'keyboard' ? <KeyboardPane /> : null}
      </View>

      <TabBar tab={tab} onChange={setTab} bottomInset={insets.bottom} />
    </View>
  );
}

function Header({ onDisconnect }: { onDisconnect: () => void }) {
  const { state } = useRemote();
  const reconnecting = state.status === 'reconnecting';
  const standby = state.isOn === false;
  const onScreen = appLabel(state.currentApp);

  const dotColor = reconnecting ? colors.amber : standby ? colors.textFaint : colors.green;
  const status = reconnecting
    ? 'Reconnecting…'
    : standby
      ? 'Standby'
      : onScreen ?? 'Connected';

  return (
    <View style={styles.header}>
      <LogoMark size={40} />
      <View style={styles.headerMeta}>
        <Text style={styles.headerName} numberOfLines={1}>
          {state.device?.name ?? 'TV'}
        </Text>
        <View style={styles.statusRow}>
          <PulseDot color={dotColor} pulsing={reconnecting} />
          <Text style={styles.statusText} numberOfLines={1}>
            {status}
            {!reconnecting && state.volume !== null
              ? state.muted
                ? '  ·  muted'
                : `  ·  vol ${state.volume}`
              : ''}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDisconnect}
        hitSlop={10}
        style={({ pressed }) => [styles.headerAction, pressed && { backgroundColor: colors.surfacePress }]}
        accessibilityRole="button"
        accessibilityLabel="Disconnect"
      >
        <Icon.Close size={16} color={colors.textMuted} weight={2.4} />
      </Pressable>
    </View>
  );
}

function PulseDot({ color, pulsing }: { color: string; pulsing: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);
  return <Animated.View style={[styles.statusDot, { backgroundColor: color, opacity: pulse }]} />;
}

/** Reconnecting and standby both change what the buttons will do, so say so. */
function StatusBanners() {
  const { state, press } = useRemote();
  if (state.status === 'reconnecting') {
    return (
      <View style={[styles.banner, styles.bannerAmber]}>
        <ActivityIndicator size="small" color={colors.amber} />
        <Text style={[styles.bannerText, { color: colors.amber }]}>
          Connection dropped — reconnecting to your TV…
        </Text>
      </View>
    );
  }
  if (state.isOn === false) {
    return (
      <Pressable
        onPress={() => {
          bump();
          press(KEY.POWER);
        }}
        style={({ pressed }) => [styles.banner, styles.bannerCoral, pressed && { opacity: 0.8 }]}
      >
        <Icon.Power size={18} color={colors.coralSoft} />
        <Text style={[styles.bannerText, { color: colors.coralSoft }]}>
          The TV is in standby. Tap to switch it on.
        </Text>
      </Pressable>
    );
  }
  return null;
}

/**
 * A session that drops mid-use (TV asleep, Wi-Fi hiccup, TLS reset) used to
 * fail every button press with zero feedback. Errors surface here and clear
 * themselves so a stale one doesn't linger over the remote.
 */
function ErrorToast() {
  const { state, clearError } = useRemote();
  useEffect(() => {
    if (!state.error) return;
    const t = setTimeout(clearError, TOAST_MS);
    return () => clearTimeout(t);
  }, [state.error, clearError]);

  if (!state.error) return null;
  return (
    <Pressable onPress={clearError} style={styles.toast}>
      <Text style={styles.toastText} numberOfLines={2}>
        {state.error}
      </Text>
      <Text style={styles.toastDismiss}>Dismiss</Text>
    </Pressable>
  );
}

function RemotePane() {
  const { press, prefs, setPrefs, state } = useRemote();
  const { width } = useWindowDimensions();
  const navSize = Math.min(280, width - spacing(16));
  const touchpad = prefs.navMode === 'touchpad';

  return (
    <ScrollView contentContainerStyle={styles.remoteScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.row}>
        <RemoteButton
          variant="danger"
          icon={<Icon.Power color="#fff" size={24} />}
          accessibilityLabel="Power"
          size={58}
          onPress={() => {
            bump();
            press(KEY.POWER);
          }}
        />
        <RemoteButton
          icon={<Icon.Mic />}
          accessibilityLabel="Assistant"
          size={58}
          onPress={() => press(KEY.ASSIST)}
        />
        <RemoteButton
          icon={<Icon.Guide />}
          accessibilityLabel="Guide"
          size={58}
          onPress={() => press(KEY.GUIDE)}
        />
        <RemoteButton
          icon={<Icon.Settings />}
          accessibilityLabel="TV settings"
          size={58}
          onPress={() => press(KEY.SETTINGS)}
        />
      </View>

      <SourceStrip />

      <View style={styles.navBlock}>
        <Segmented
          value={prefs.navMode}
          onChange={(navMode) => setPrefs({ navMode })}
          options={[
            { value: 'dpad', label: 'D-pad', icon: (c) => <Icon.DPadCross size={15} color={c} weight={2.2} /> },
            { value: 'touchpad', label: 'Touchpad', icon: (c) => <Icon.Touchpad size={15} color={c} weight={2.2} /> },
          ]}
        />
        {touchpad ? (
          <Touchpad
            width={width - spacing(10)}
            height={navSize}
            onMove={(d) => press(SECTOR_KEY[d])}
            onSelect={() => press(KEY.DPAD_CENTER)}
          />
        ) : (
          <DPad size={navSize} onPress={(sector) => press(SECTOR_KEY[sector])} />
        )}
      </View>

      <View style={styles.row}>
        <RemoteButton icon={<Icon.Back />} accessibilityLabel="Back" onPress={() => press(KEY.BACK)} />
        <RemoteButton icon={<Icon.Home />} accessibilityLabel="Home" onPress={() => press(KEY.HOME)} />
        <RemoteButton icon={<Icon.Menu />} accessibilityLabel="Menu" onPress={() => press(KEY.MENU)} />
      </View>

      <View style={styles.rockers}>
        <Rocker
          label="VOL"
          up={<Icon.Plus />}
          down={<Icon.Minus />}
          onUp={() => press(KEY.VOLUME_UP)}
          onDown={() => press(KEY.VOLUME_DOWN)}
          repeat
        />
        <View style={styles.rockerMiddle}>
          <RemoteButton
            icon={<Icon.Mute color={state.muted ? colors.coral : colors.text} />}
            accessibilityLabel="Mute"
            onPress={() => press(KEY.VOLUME_MUTE)}
            size={56}
          />
          <RemoteButton
            icon={<Icon.Info />}
            accessibilityLabel="Info"
            onPress={() => press(KEY.INFO)}
            size={56}
          />
        </View>
        <Rocker
          label="CH"
          up={<Icon.Plus />}
          down={<Icon.Minus />}
          onUp={() => press(KEY.CHANNEL_UP)}
          onDown={() => press(KEY.CHANNEL_DOWN)}
        />
      </View>

      <View style={styles.mediaBar}>
        <RemoteButton
          variant="ghost"
          icon={<Icon.Rewind />}
          accessibilityLabel="Rewind"
          onPress={() => press(KEY.MEDIA_REWIND)}
        />
        <RemoteButton
          variant="accent"
          icon={<Icon.PlayPause color="#fff" size={28} />}
          accessibilityLabel="Play or pause"
          size={72}
          onPress={() => press(KEY.MEDIA_PLAY_PAUSE)}
        />
        <RemoteButton
          variant="ghost"
          icon={<Icon.Forward />}
          accessibilityLabel="Fast forward"
          onPress={() => press(KEY.MEDIA_FAST_FORWARD)}
        />
      </View>
    </ScrollView>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: (color: string) => React.ReactNode }[];
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        const c = on ? '#fff' : colors.textMuted;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (on) return;
              tap();
              onChange(o.value);
            }}
            style={[styles.segment, on && styles.segmentOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            {o.icon(c)}
            <Text style={[styles.segmentText, { color: c }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Switching to a console or a soundbar is the single most common reason a
 * remote gets picked up, so the ports sit on the main screen rather than
 * behind the input picker.
 */
function SourceStrip() {
  const { press } = useRemote();
  return (
    <View style={styles.sourceBlock}>
      <View style={styles.sourceHeading}>
        <Icon.Source size={15} color={colors.textFaint} weight={2.2} />
        <Text style={styles.sourceLabel}>SOURCE</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sourceRow}
      >
        {SOURCES.map((source) => (
          <Pressable
            key={source.id}
            onPress={() => {
              bump();
              press(source.key);
            }}
            style={({ pressed }) => [
              styles.sourcePill,
              pressed && { backgroundColor: colors.coral, borderColor: colors.coral },
            ]}
          >
            <Text style={styles.sourcePillText}>{source.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Vertical +/- pill, the shape your thumb finds without looking. */
function Rocker({
  label,
  up,
  down,
  onUp,
  onDown,
  repeat,
}: {
  label: string;
  up: React.ReactNode;
  down: React.ReactNode;
  onUp: () => void;
  onDown: () => void;
  repeat?: boolean;
}) {
  return (
    <View style={styles.rocker}>
      <RemoteButton
        icon={up}
        accessibilityLabel={`${label} up`}
        onPress={onUp}
        onRepeat={repeat ? onUp : undefined}
        size={62}
      />
      <Text style={styles.rockerLabel}>{label}</Text>
      <RemoteButton
        icon={down}
        accessibilityLabel={`${label} down`}
        onPress={onDown}
        onRepeat={repeat ? onDown : undefined}
        size={62}
      />
    </View>
  );
}

function AppsPane() {
  const { launch, state } = useRemote();
  const running = appFor(state.currentApp);
  const onScreen = appLabel(state.currentApp);

  return (
    <ScrollView contentContainerStyle={styles.appsScroll} showsVerticalScrollIndicator={false}>
      {onScreen ? (
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingLabel}>ON SCREEN</Text>
          <Text style={styles.nowPlayingName} numberOfLines={1}>
            {onScreen}
          </Text>
        </View>
      ) : null}
      <View style={styles.appGrid}>
        {APP_SHORTCUTS.map((app) => (
          <AppTile
            key={app.id}
            app={app}
            active={running?.id === app.id}
            onPress={() => {
              bump();
              launch(app.uri);
            }}
          />
        ))}
      </View>
      <Text style={styles.paneHint}>
        Tap to jump straight into an app — the TV opens it the same way a cast link would.
      </Text>
    </ScrollView>
  );
}

function AppTile({
  app,
  active,
  onPress,
}: {
  app: AppShortcut;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 7 }).start();

  return (
    <Animated.View style={[styles.appCell, { transform: [{ scale }] }]}>
      <Pressable
        onPressIn={() => to(0.93)}
        onPressOut={() => to(1)}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${app.name}`}
        style={[styles.appTile, active && { borderColor: colors.coral }]}
      >
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`app-${app.id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={app.tint} />
              <Stop offset="1" stopColor={app.tint2} />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" fill={`url(#app-${app.id})`} />
          <Circle cx="18" cy="8" r="42" fill="#fff" opacity={0.1} />
        </Svg>
        {/* A positioned wrapper keeps the mark above the absolute gradient on web. */}
        <View style={styles.appMark}>
          <AppMark app={app} />
        </View>
        {active ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
      </Pressable>
      <Text style={styles.appName} numberOfLines={1}>
        {app.name}
      </Text>
    </Animated.View>
  );
}

/** Simple drawn marks where a letter would look cheap; text for the rest. */
function AppMark({ app }: { app: AppShortcut }) {
  const ink = app.ink ?? '#fff';
  if (app.id === 'youtube') {
    return (
      <Svg width={46} height={46} viewBox="0 0 24 24">
        <Rect x="1.5" y="5" width="21" height="14" rx="4.2" fill="#fff" />
        <Path d="M10 8.8 L15.4 12 L10 15.2 Z" fill={app.tint} />
      </Svg>
    );
  }
  if (app.id === 'spotify') {
    return (
      <Svg width={46} height={46} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="10" fill="#101010" />
        <Path
          d="M6.5 9.3 C10 8.2 14.3 8.5 17.6 10.3 M7.2 12.3 C10.2 11.5 13.6 11.8 16.3 13.3 M7.8 15.1 C10.2 14.5 12.7 14.8 14.8 16"
          stroke={app.tint}
          strokeWidth={1.7}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }
  if (app.id === 'plex') {
    return (
      <Svg width={42} height={42} viewBox="0 0 24 24">
        <Path d="M7 3 H12.5 L18 12 L12.5 21 H7 L12.5 12 Z" fill={ink} />
      </Svg>
    );
  }
  return (
    <Text
      style={[
        styles.appGlyphText,
        { color: ink, fontSize: app.glyph.length > 3 ? 18 : app.glyph.length > 1 ? 24 : 34 },
      ]}
    >
      {app.glyph}
    </Text>
  );
}

/**
 * Two ways to type. "Send" pushes a finished line, which suits a search box.
 * Live mode mirrors every keystroke — including backspace — as you type, so
 * you can watch it land on the TV and fix typos there.
 */
function KeyboardPane() {
  const { type, press } = useRemote();
  const [text, setText] = useState('');
  const [live, setLive] = useState(false);

  const send = () => {
    if (!text.trim()) return;
    bump();
    type(text);
    setText('');
  };

  const onChange = (next: string) => {
    if (live) {
      let common = 0;
      while (common < text.length && common < next.length && text[common] === next[common]) common++;
      for (let i = 0; i < text.length - common; i++) press(KEY.DEL);
      const added = next.slice(common);
      if (added) type(added);
      tap();
    }
    setText(next);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardPane}
    >
      <View style={styles.liveRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.liveTitle}>Live typing</Text>
          <Text style={styles.liveSub}>
            {live ? 'Every key goes straight to the TV.' : 'Type a line, then send it in one go.'}
          </Text>
        </View>
        <Switch
          value={live}
          onValueChange={(v) => {
            tap();
            setLive(v);
            setText('');
          }}
          trackColor={{ false: colors.surfacePress, true: colors.coral }}
          thumbColor="#fff"
        />
      </View>

      <TextInput
        value={text}
        onChangeText={onChange}
        placeholder={live ? 'Start typing — it appears on the TV…' : 'Type for the TV…'}
        placeholderTextColor={colors.textFaint}
        style={[styles.bigInput, live && { borderColor: 'rgba(244,87,63,0.5)' }]}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={live ? () => press(KEY.ENTER) : send}
        submitBehavior="submit"
        returnKeyType={live ? 'go' : 'send'}
        multiline
      />

      <View style={styles.row}>
        <RemoteButton
          icon={<Icon.Backspace />}
          accessibilityLabel="Backspace"
          onPress={() => press(KEY.DEL)}
        />
        <RemoteButton label="Space" onPress={() => press(KEY.SPACE)} size={62} />
        <RemoteButton icon={<Icon.Enter />} accessibilityLabel="Enter" onPress={() => press(KEY.ENTER)} />
        <RemoteButton
          icon={<Icon.Search />}
          accessibilityLabel="Search"
          onPress={() => press(KEY.SEARCH)}
        />
      </View>

      {!live ? (
        <Pressable
          onPress={send}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: pressed ? colors.coralSoft : colors.coral },
          ]}
        >
          <Text style={styles.sendText}>Send to TV</Text>
        </Pressable>
      ) : null}

      <Text style={styles.paneHint}>
        Open a search box on the TV first. Letters, digits and common symbols are sent as key
        presses; capitals arrive as lower case.
      </Text>
    </KeyboardAvoidingView>
  );
}

function TabBar({
  tab,
  onChange,
  bottomInset,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  bottomInset: number;
}) {
  const items: { key: Tab; label: string; render: (color: string) => React.ReactNode }[] = [
    { key: 'remote', label: 'Remote', render: (c) => <Icon.RemotePad color={c} size={21} /> },
    { key: 'apps', label: 'Apps', render: (c) => <Icon.Grid color={c} size={21} /> },
    { key: 'keyboard', label: 'Keyboard', render: (c) => <Icon.Keyboard color={c} size={21} /> },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: bottomInset + spacing(2) }]}>
      {items.map((item) => {
        const active = item.key === tab;
        const color = active ? colors.coral : colors.textFaint;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              tap();
              onChange(item.key);
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.tabIcon, active && styles.tabIconOn]}>{item.render(color)}</View>
            <Text style={[styles.tabLabel, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(3),
  },
  headerMeta: { flex: 1 },
  headerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: colors.textMuted, fontSize: 12, flexShrink: 1 },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },

  banner: {
    marginHorizontal: spacing(5),
    marginBottom: spacing(3),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  bannerAmber: { backgroundColor: 'rgba(245,166,35,0.10)', borderColor: 'rgba(245,166,35,0.35)' },
  bannerCoral: { backgroundColor: colors.coralDim, borderColor: 'rgba(244,87,63,0.35)' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  toast: {
    marginHorizontal: spacing(5),
    marginBottom: spacing(3),
    padding: spacing(3.5),
    borderRadius: radius.md,
    backgroundColor: 'rgba(176,13,30,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(176,13,30,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  toastText: { flex: 1, color: '#FF9B8E', fontSize: 13, lineHeight: 18 },
  toastDismiss: { color: '#FF9B8E', fontSize: 12, fontWeight: '700' },

  pane: { flex: 1 },

  remoteScroll: {
    alignItems: 'center',
    gap: spacing(5),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(5) },

  navBlock: { alignItems: 'center', gap: spacing(3.5), alignSelf: 'stretch' },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3.5),
    height: 32,
    borderRadius: radius.pill,
  },
  segmentOn: { backgroundColor: colors.coral, ...shadow.glow, shadowOpacity: 0.3 },
  segmentText: { fontSize: 12, fontWeight: '700' },

  sourceBlock: { alignSelf: 'stretch', gap: spacing(2) },
  sourceHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  sourceLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  sourceRow: { gap: spacing(2), paddingRight: spacing(4) },
  sourcePill: {
    paddingHorizontal: spacing(4),
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcePillText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  rockers: { flexDirection: 'row', alignItems: 'center', gap: spacing(5) },
  rocker: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing(1),
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rockerLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  rockerMiddle: { gap: spacing(3) },

  mediaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(6),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing(2),
  },

  appsScroll: { padding: spacing(5), gap: spacing(5) },
  nowPlaying: {
    padding: spacing(4),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 2,
  },
  nowPlayingLabel: { color: colors.coral, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  nowPlayingName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  paneHint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: spacing(1),
    textAlign: 'center',
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing(4), columnGap: '5%' },
  appCell: { width: '30%', gap: spacing(2), alignItems: 'center' },
  appTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  appMark: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  appGlyphText: { fontWeight: '900', letterSpacing: -0.5 },
  appName: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  liveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.coral },
  liveText: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },

  keyboardPane: { flex: 1, padding: spacing(5), gap: spacing(5), alignItems: 'center' },
  liveRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(4),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  liveTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  liveSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bigInput: {
    width: '100%',
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing(4),
    color: colors.text,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: '100%',
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glow,
  },
  sendText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: 'rgba(21,21,29,0.96)',
    paddingTop: spacing(2),
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconOn: { backgroundColor: colors.coralDim },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
