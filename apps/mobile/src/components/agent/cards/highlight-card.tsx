import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { sharedStyles } from './shared';

export function HighlightCard({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        sharedStyles.card,
        styles.highlight,
        { backgroundColor: theme.secondary, borderColor: theme.secondary },
      ]}
    >
      <ThemedText type="smallBold" themeColor="secondaryForeground">
        {title}
      </ThemedText>
      <ThemedText themeColor="secondaryForeground">{body}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    borderWidth: 0,
  },
});
