import { api } from '@beegreat/backend/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { captureMobileFailure } from '@/lib/sentry';

export function ImessageSettings() {
  const theme = useTheme();
  const connections = useQuery(api.imessage.connections);
  const disconnect = useMutation(api.imessage.disconnect);
  const [workingAddress, setWorkingAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removeConnection = async (address: string) => {
    if (workingAddress) return;
    setWorkingAddress(address);
    setError(null);
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    try {
      await disconnect({ address });
    } catch (cause) {
      captureMobileFailure(cause, 'imessage.disconnect');
      setError('Could not disconnect this address. Try again.');
    } finally {
      setWorkingAddress(null);
    }
  };

  if (!connections) return <ActivityIndicator color={theme.primary} />;
  const connected = connections.length > 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        connected && { borderColor: theme.primary },
      ]}
    >
      <View style={styles.heading}>
        <View style={[styles.mark, { backgroundColor: '#34C759' }]}>
          <SymbolView
            name="message.fill"
            size={21}
            tintColor="#ffffff"
            fallback={<ThemedText style={styles.fallback}>M</ThemedText>}
          />
        </View>
        <View style={styles.copy}>
          <ThemedText type="default">
            {connected ? 'iMessage connected' : 'Connect iMessage'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
            {connected
              ? 'Bee answers these senders in Messages.'
              : 'Text Bee from Messages and open the link she replies with — that is the whole setup.'}
          </ThemedText>
        </View>
      </View>
      {error ? (
        <ThemedText type="small" themeColor="destructive" selectable>
          {error}
        </ThemedText>
      ) : null}
      {connections.map((connection) => (
        <View
          key={connection.address}
          style={[styles.addressRow, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="small" selectable style={styles.address}>
            {connection.address}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Disconnect ${connection.address}`}
            disabled={workingAddress === connection.address}
            onPress={() => void removeConnection(connection.address)}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            {workingAddress === connection.address ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: theme.textSecondary }}
              >
                Disconnect
              </ThemedText>
            )}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    gap: Spacing.three,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  mark: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  fallback: { color: '#ffffff', fontWeight: '700' },
  copy: { flex: 1, gap: Spacing.one },
  addressRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: 14,
    borderCurve: 'continuous',
    gap: Spacing.two,
  },
  address: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  button: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
