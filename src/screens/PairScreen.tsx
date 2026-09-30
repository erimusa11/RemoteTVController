import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useRemote } from '../RemoteContext';
import { colors, radius, spacing } from '../theme';
import { success, warn } from '../lib/haptics';

const LENGTH = 6;
/** Only nag once attempts are getting scarce, not after every single miss. */
const MAX_ATTEMPTS_DISPLAY_THRESHOLD = 4;

export function PairScreen() {
  const { state, submitCode, disconnect, clearError, pairAttemptsRemaining } = useRemote();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInput>(null);

  // A lockout (too many wrong codes) force-disconnects from RemoteContext,
  // which unmounts this screen out from under the in-flight onChange below —
  // guard every local setState after an await with this.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const waiting = state.status === 'pairing';
  const connecting = state.status === 'connecting';

  useEffect(() => {
    if (state.status === 'awaiting-code') {
      const t = setTimeout(() => input.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [state.status]);

  const onChange = async (raw: string) => {
    // The protocol asks the TV for ENCODING_TYPE_HEXADECIMAL, so the code on
    // screen is six hex characters — digits plus A-F, not digits only.
    const digits = raw.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, LENGTH);
    setCode(digits);
    if (state.error) clearError();

    if (digits.length === LENGTH) {
      setBusy(true);
      try {
        await submitCode(digits);
        success();
      } catch {
        warn();
        if (mounted.current) {
          setCode('');
          setTimeout(() => {
            if (mounted.current) input.current?.focus();
          }, 200);
        }
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing(4) }]}>
      <Pressable onPress={disconnect} style={styles.back} hitSlop={12}>
        <Text style={styles.backText}>‹  Back</Text>
      </Pressable>

      <View style={styles.body}>
        {waiting ? (
          <>
            <ActivityIndicator color={colors.coral} size="large" />
            <Text style={styles.title}>Talking to your TV…</Text>
            <Text style={styles.sub}>Asking {state.device?.name ?? 'the TV'} to show a code.</Text>
          </>
        ) : connecting ? (
          <>
            <ActivityIndicator color={colors.coral} size="large" />
            <Text style={styles.title}>Connecting…</Text>
            <Text style={styles.sub}>
              Opening the remote session with {state.device?.name ?? 'your TV'}.
            </Text>
          </>
        ) : (
          <>
            <TvWithCode />

            <Text style={styles.title}>Look at your TV</Text>
            <Text style={styles.sub}>
              {state.device?.name ?? 'Your TV'} is showing a six-character code. Type it here —
              it can contain letters as well as numbers.
            </Text>

            <Pressable style={styles.boxes} onPress={() => input.current?.focus()}>
              {Array.from({ length: LENGTH }).map((_, i) => {
                const filled = i < code.length;
                const isNext = i === code.length;
                return (
                  <View
                    key={i}
                    style={[
                      styles.box,
                      filled && styles.boxFilled,
                      isNext && styles.boxNext,
                    ]}
                  >
                    <Text style={styles.boxText}>{code[i] ?? ''}</Text>
                  </View>
                );
              })}
            </Pressable>

            <TextInput
              ref={input}
              value={code}
              onChangeText={onChange}
              keyboardType="visible-password"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={LENGTH}
              autoFocus
              editable={!busy}
              style={styles.hiddenInput}
              caretHidden
            />

            {busy ? <ActivityIndicator color={colors.coral} /> : null}

            {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
            {!state.error && pairAttemptsRemaining < MAX_ATTEMPTS_DISPLAY_THRESHOLD ? (
              <Text style={styles.attempts}>
                {pairAttemptsRemaining} {pairAttemptsRemaining === 1 ? 'try' : 'tries'} left
              </Text>
            ) : null}

            <Text style={styles.help}>
              No code on screen? Make sure the TV is on the home screen, then go back and scan
              again. Some TVs need “Remote &amp; Accessories” opened once.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

/** The brand TV, with the code slots lit on its screen: "look over there". */
function TvWithCode() {
  return (
    <Svg width={170} height={128} viewBox="0 0 170 128">
      <Defs>
        <LinearGradient id="pairScreen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#24121A" />
          <Stop offset="1" stopColor="#0B0B10" />
        </LinearGradient>
      </Defs>
      <Line x1="85" y1="22" x2="66" y2="4" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      <Line x1="85" y1="22" x2="104" y2="4" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      <Rect x="8" y="22" width="154" height="92" rx="22" fill="#fff" />
      <Rect x="18" y="32" width="134" height="72" rx="14" fill="url(#pairScreen)" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Rect
          key={i}
          x={30 + i * 19}
          y={58}
          width={15}
          height={20}
          rx={4}
          fill={i < 3 ? '#F4573F' : '#FF7A66'}
          opacity={0.35 + i * 0.1}
        />
      ))}
      <Rect x="62" y="118" width="46" height="8" rx="4" fill="#fff" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: spacing(6) },
  back: { alignSelf: 'flex-start', paddingVertical: spacing(2) },
  backText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(4) },


  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },

  boxes: { flexDirection: 'row', gap: spacing(2.5), marginTop: spacing(3) },
  box: {
    width: 46,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.coral, backgroundColor: colors.coralDim },
  boxNext: { borderColor: colors.textMuted },
  boxText: { color: colors.text, fontSize: 26, fontWeight: '700' },

  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },

  error: { color: '#FF9B8E', fontSize: 14, textAlign: 'center' },
  attempts: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  help: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing(4),
  },
});
