import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { sharedStyles } from './shared';

export function ConfirmCard({
  summary,
  onReply,
}: {
  summary: string;
  action: string;
  onReply?: (text: string) => void;
}) {
  const theme = useTheme();

  const reply = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply?.(text);
  };

  return (
    <View
      style={[
        sharedStyles.card,
        { backgroundColor: theme.card, borderColor: theme.destructive },
      ]}
    >
      <ThemedText type="smallBold" themeColor="destructive">
        Needs your confirmation
      </ThemedText>
      <ThemedText>{summary}</ThemedText>
      {onReply ? (
        <View style={sharedStyles.confirmRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm"
            onPress={() => reply('Yes')}
            style={({ pressed }) => [
              sharedStyles.confirmButton,
              { backgroundColor: theme.primary },
              pressed && sharedStyles.taskRowPressed,
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: theme.primaryForeground }}
            >
              Yes
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline"
            onPress={() => reply('No')}
            style={({ pressed }) => [
              sharedStyles.confirmButton,
              sharedStyles.confirmButtonOutline,
              { borderColor: theme.border },
              pressed && sharedStyles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold">No</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Reply yes or no by voice or text.
        </ThemedText>
      )}
    </View>
  );
}
