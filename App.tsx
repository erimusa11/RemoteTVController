import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Backdrop } from './src/components/Backdrop';
import { RemoteProvider, useRemote } from './src/RemoteContext';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { PairScreen } from './src/screens/PairScreen';
import { RemoteScreen } from './src/screens/RemoteScreen';
import { colors } from './src/theme';

/**
 * Three states, so no navigation library: you're either picking a TV, typing a
 * pairing code, or holding the remote.
 */
function Router() {
  const { state } = useRemote();

  if (state.status === 'connected') return <RemoteScreen />;
  if (
    state.status === 'pairing' ||
    state.status === 'awaiting-code' ||
    state.status === 'connecting'
  ) {
    return <PairScreen />;
  }
  return <ConnectScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <Backdrop />
        <RemoteProvider>
          <Router />
        </RemoteProvider>
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
