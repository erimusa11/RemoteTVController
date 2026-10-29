import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RemoteButton } from './RemoteButton';
import { colors, spacing } from '../theme';

type Props = {
  /** Height of the pad; matches the D-pad so switching doesn't shift the screen. */
  size: number;
  onDigit: (digit: number) => void;
  onLast: () => void;
  onEnter: () => void;
};

const ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const;

const ROW_GAP = spacing(3);

/**
 * Digits for typing a channel number, laid out like the keypad on the TV's
 * own remote. Most TVs tune a moment after the last digit; OK tunes at once.
 */
export function NumberPad({ size, onDigit, onLast, onEnter }: Props) {
  const key = Math.floor((size - ROW_GAP * 3) / 4);

  const digit = (n: number) => (
    <RemoteButton
      key={n}
      icon={<Text style={styles.digit}>{n}</Text>}
      accessibilityLabel={String(n)}
      size={key}
      onPress={() => onDigit(n)}
    />
  );

  return (
    <View style={styles.pad}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((n) => digit(n))}
        </View>
      ))}
      <View style={styles.row}>
        <RemoteButton
          variant="ghost"
          label="Last"
          accessibilityLabel="Last channel"
          size={key}
          onPress={onLast}
        />
        {digit(0)}
        <RemoteButton
          variant="ghost"
          label="OK"
          accessibilityLabel="Tune now"
          size={key}
          onPress={onEnter}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: ROW_GAP, alignItems: 'center' },
  row: { flexDirection: 'row', gap: spacing(5) },
  digit: { color: colors.text, fontSize: 22, fontWeight: '600' },
});
