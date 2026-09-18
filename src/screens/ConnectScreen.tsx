import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, Wordmark } from '../components/Logo';
import { ScanRadar } from '../components/ScanRadar';
import { useRemote } from '../RemoteContext';
import { colors, radius, shadow, spacing } from '../theme';
import type { TvDevice } from '../transport/types';
import { tap } from '../lib/haptics';

export function ConnectScreen() {
  const { discovered, known, scanning, scan, stopScan, choose, forget, addManual, isReal, state } =
    useRemote();
  const insets = useSafeAreaInsets();
  const [manualOpen, setManualOpen] = useState(false);
  const [host, setHost] = useState('');

  const nothingFound = !scanning && discovered.length === 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing(6), paddingBottom: insets.bottom + spacing(10) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <ScanRadar size={210} active={scanning} />
        <Wordmark size={34} />
        <Text style={styles.byline}>BY ERI</Text>
      </View>

      {!isReal ? (
        <View style={styles.demoBanner}>
          <Text style={styles.demoText}>
            Preview mode — this browser can&apos;t open TV sockets, so you&apos;re driving a
            simulated TV. Any 6-digit code works.
          </Text>
        </View>
      ) : null}

      {state.error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connect in three steps</Text>
        <Step n={1} title="Switch the TV on" body="It has to be awake — not in standby." />
        <Step
          n={2}
          title="Same Wi-Fi"
          body="Phone and TV must sit on the same network. 5 GHz and 2.4 GHz on one router are fine."
        />
        <Step
          n={3}
          title="Scan and pair"
          body="Pick your TV below, then type the 6 digits it shows on screen. Once only."
          last
        />
      </View>

      <Pressable
        onPress={() => {
          tap();
          scanning ? stopScan() : scan();
        }}
        style={({ pressed }) => [
          styles.scanButton,
          { backgroundColor: pressed ? colors.coralSoft : colors.coral },
        ]}
      >
        {scanning ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.scanText}>
          {scanning ? 'Scanning…  tap to stop' : 'Scan for TVs'}
        </Text>
      </Pressable>

      {discovered.length > 0 ? (
        <Section title="Found on your network">
          {discovered.map((d) => (
            <DeviceRow key={d.id} device={d} onPress={() => choose(d)} />
          ))}
        </Section>
      ) : null}

      {known.length > 0 ? (
        <Section title="Already paired">
          {known.map((d) => (
            <DeviceRow
              key={d.id}
              device={d}
              paired
              onPress={() => choose(d)}
              onForget={() => forget(d)}
            />
          ))}
        </Section>
      ) : null}

      {nothingFound && known.length === 0 ? (
        <Text style={styles.hint}>
          No TVs yet. Tap Scan — discovery takes a few seconds. If your router blocks device
          discovery, add the TV&apos;s IP by hand below.
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          tap();
          setManualOpen((v) => !v);
        }}
        style={styles.manualToggle}
      >
        <Text style={styles.manualToggleText}>
          {manualOpen ? '– Hide manual entry' : '+ Enter the TV’s IP address manually'}
        </Text>
      </Pressable>

      {manualOpen ? (
        <View style={styles.manualBox}>
          <Text style={styles.manualHint}>
            On the TV: Settings → Network &amp; Internet → your Wi-Fi → IP address.
          </Text>
          <View style={styles.manualRow}>
            <TextInput
              value={host}
              onChangeText={setHost}
              placeholder="192.168.1.42"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              onPress={() => {
                if (!host.trim()) return;
                Keyboard.dismiss();
                tap();
                addManual(host);
              }}
              style={({ pressed }) => [
                styles.manualGo,
                { backgroundColor: pressed ? colors.coralSoft : colors.deepRed },
              ]}
            >
              <Text style={styles.manualGoText}>Connect</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Step({
  n,
  title,
  body,
  last,
}: {
  n: number;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepNumber}>{n}</Text>
        </View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{body}</Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DeviceRow({
  device,
  onPress,
  onForget,
  paired,
}: {
  device: TvDevice;
  onPress: () => void;
  onForget?: () => void;
  paired?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.deviceRow,
        { backgroundColor: pressed ? colors.surfacePress : colors.surfaceHigh },
      ]}
    >
      <View style={styles.deviceIcon}>
        <LogoMark size={26} />
      </View>
      <View style={styles.deviceMeta}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {device.name}
        </Text>
        <Text style={styles.deviceHost}>
          {device.host}
          {paired ? '  ·  paired' : ''}
        </Text>
      </View>
      {onForget ? (
        <Pressable hitSlop={10} onPress={onForget} style={styles.forget}>
          <Text style={styles.forgetText}>Forget</Text>
        </Pressable>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: spacing(5), gap: spacing(5) },

  hero: { alignItems: 'center', gap: spacing(1) },
  byline: {
    color: colors.deepRed,
    letterSpacing: 6,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -spacing(1),
  },

  demoBanner: {
    backgroundColor: colors.coralDim,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: 'rgba(244,87,63,0.3)',
  },
  demoText: { color: colors.coralSoft, fontSize: 13, lineHeight: 19 },

  errorBanner: {
    backgroundColor: 'rgba(176,13,30,0.18)',
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: 'rgba(176,13,30,0.45)',
  },
  errorText: { color: '#FF9B8E', fontSize: 13, lineHeight: 19 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(5),
    gap: spacing(1),
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.card,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing(3),
  },

  step: { flexDirection: 'row', gap: spacing(3.5) },
  stepRail: { alignItems: 'center', width: 28 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.coralDim,
    borderWidth: 1,
    borderColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { color: colors.coral, fontWeight: '800', fontSize: 13 },
  stepLine: { flex: 1, width: 2, backgroundColor: colors.hairline, marginVertical: 4 },
  stepBody: { flex: 1, paddingBottom: spacing(4) },
  stepTitle: { color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 },
  stepText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },

  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    height: 58,
    borderRadius: radius.pill,
    ...shadow.glow,
  },
  scanText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  section: { gap: spacing(2) },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    padding: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  deviceIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceMeta: { flex: 1 },
  deviceName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  deviceHost: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  chevron: { color: colors.textFaint, fontSize: 24, paddingHorizontal: spacing(1) },
  forget: { paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
  forgetText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },

  hint: { color: colors.textFaint, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  manualToggle: { alignItems: 'center', paddingVertical: spacing(1) },
  manualToggleText: { color: colors.coral, fontSize: 14, fontWeight: '600' },

  manualBox: { gap: spacing(3) },
  manualHint: { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
  manualRow: { flexDirection: 'row', gap: spacing(2.5) },
  input: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing(4),
    color: colors.text,
    fontSize: 16,
  },
  manualGo: {
    paddingHorizontal: spacing(5),
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualGoText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
