import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DPad } from '../components/DPad';
import { Icon } from '../components/Icons';
import { RemoteButton } from '../components/RemoteButton';
import { LogoMark } from '../components/Logo';
import { VolumeHud } from '../components/VolumeHud';
import { useRemote } from '../RemoteContext';
import { APP_SHORTCUTS } from '../transport/apps';
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

export function RemoteScreen() {
  const { state, disconnect } = useRemote();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('remote');

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing(2) }]}>
      <Header
        name={state.device?.name ?? 'TV'}
        volume={state.volume}
        muted={state.muted}
        onDisconnect={disconnect}
      />
      <VolumeHud />
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

/**
 * A session that drops mid-use (TV asleep, Wi-Fi hiccup, TLS reset) used to
 * fail every button press with zero feedback — press() just swallowed the
 * error into state.error, which nothing on this screen ever read.
 */
function ErrorToast() {
  const { state, clearError } = useRemote();
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

function Header({
  name,
  volume,
  muted,
  onDisconnect,
}: {
  name: string;
  volume: number | null;
  muted: boolean;
  onDisconnect: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBadge}>
        <LogoMark size={24} />
      </View>
      <View style={styles.headerMeta}>
        <Text style={styles.headerName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            Connected
            {volume !== null ? (muted ? '  ·  muted' : `  ·  vol ${volume}`) : ''}
          </Text>
        </View>
      </View>
      <Pressable onPress={onDisconnect} hitSlop={10} style={styles.headerAction}>
        <Text style={styles.headerActionText}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

function RemotePane() {
  const { press } = useRemote();
  return (
    <ScrollView
      contentContainerStyle={styles.remoteScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.row}>
        <RemoteButton
          variant="danger"
          icon={<Icon.Power color="#fff" size={26} />}
          accessibilityLabel="Power"
          onPress={() => {
            bump();
            press(KEY.POWER);
          }}
        />
        <RemoteButton
          icon={<Icon.Guide />}
          accessibilityLabel="Guide"
          onPress={() => press(KEY.GUIDE)}
        />
        <RemoteButton
          icon={<Icon.Mic />}
          accessibilityLabel="Assistant"
          onPress={() => press(KEY.ASSIST)}
        />
      </View>

      <SourceStrip />

      <DPad size={264} onPress={(sector) => press(SECTOR_KEY[sector])} />

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
            icon={<Icon.Mute />}
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

      <View style={styles.row}>
        <RemoteButton
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
          icon={<Icon.Forward />}
          accessibilityLabel="Fast forward"
          onPress={() => press(KEY.MEDIA_FAST_FORWARD)}
        />
      </View>
    </ScrollView>
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
  return (
    <ScrollView contentContainerStyle={styles.appsScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.paneHint}>
        Tap to jump straight into an app. The TV opens it the same way a cast link would.
      </Text>
      <View style={styles.appGrid}>
        {APP_SHORTCUTS.map((app) => (
          <Pressable
            key={app.id}
            onPress={() => {
              bump();
              launch(app.uri);
            }}
            style={({ pressed }) => [
              styles.appTile,
              { borderColor: pressed ? app.tint : colors.hairline },
            ]}
          >
            <View style={[styles.appGlyph, { backgroundColor: app.tint }]}>
              <Text style={styles.appGlyphText}>{app.glyph}</Text>
            </View>
            <Text style={styles.appName} numberOfLines={1}>
              {app.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {state.currentApp ? (
        <Text style={styles.currentApp}>On screen now: {state.currentApp}</Text>
      ) : null}
    </ScrollView>
  );
}

function KeyboardPane() {
  const { type, press } = useRemote();
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    bump();
    type(text);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardPane}
    >
      <Text style={styles.paneHint}>
        Open a search box on the TV first, then type here and hit Send. Letters, digits and
        spaces are injected one key at a time.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type for the TV…"
        placeholderTextColor={colors.textFaint}
        style={styles.bigInput}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={send}
        returnKeyType="send"
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

      <Pressable
        onPress={send}
        style={({ pressed }) => [
          styles.sendButton,
          { backgroundColor: pressed ? colors.coralSoft : colors.coral },
        ]}
      >
        <Text style={styles.sendText}>Send to TV</Text>
      </Pressable>
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
          >
            {item.render(color)}
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
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: { flex: 1 },
  headerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  statusText: { color: colors.textFaint, fontSize: 12 },
  headerAction: { paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
  headerActionText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },

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

  appsScroll: { padding: spacing(5), gap: spacing(4) },
  paneHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: spacing(1),
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  appTile: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    ...shadow.card,
  },
  appGlyph: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appGlyphText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  appName: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  currentApp: { color: colors.textFaint, fontSize: 11 },

  keyboardPane: { flex: 1, padding: spacing(5), gap: spacing(5), alignItems: 'center' },
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
    backgroundColor: colors.surface,
    paddingTop: spacing(2.5),
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
