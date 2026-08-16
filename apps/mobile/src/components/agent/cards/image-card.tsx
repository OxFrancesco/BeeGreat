import { generatedImageFileName } from '@beegreat/tool-presentation';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MotionDuration } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

import { sharedStyles } from './shared';

async function downloadGeneratedImage(url: string) {
  return File.downloadFileAsync(
    url,
    new File(Paths.cache, generatedImageFileName(url)),
    { idempotent: true },
  );
}

export function GeneratedImageCard({
  url,
  alt,
  title,
}: Extract<UIComponent, { type: 'image' }>) {
  const theme = useTheme();
  const [feedback, setFeedback] = useState<string>();
  const [working, setWorking] = useState<'copy' | 'save'>();

  const copyImage = async () => {
    setWorking('copy');
    try {
      const file = await downloadGeneratedImage(url);
      await Clipboard.setImageAsync(await file.base64());
      setFeedback('Image copied');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      await Clipboard.setStringAsync(url);
      setFeedback('Image link copied');
    } finally {
      setWorking(undefined);
    }
  };

  const saveImage = async () => {
    setWorking('save');
    try {
      const file = await downloadGeneratedImage(url);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: 'Save image',
          mimeType: file.type || 'image/png',
          UTI: 'public.image',
        });
        setFeedback('Image ready to save');
      } else {
        await Linking.openURL(url);
        setFeedback('Image opened');
      }
    } catch {
      await Linking.openURL(url);
      setFeedback('Image opened');
    } finally {
      setWorking(undefined);
    }
  };

  return (
    <View
      style={[
        sharedStyles.card,
        styles.imageCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      <ExpoImage
        accessibilityLabel={alt}
        accessibilityRole="image"
        contentFit="cover"
        source={{ uri: url }}
        style={[
          styles.generatedImage,
          { backgroundColor: theme.backgroundElement },
        ]}
        transition={MotionDuration.enter}
      />
      <View style={styles.imageActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy generated image"
          disabled={working !== undefined}
          onPress={() => void copyImage()}
          style={({ pressed }) => [
            styles.imageAction,
            styles.imageActionOutline,
            { borderColor: theme.border },
            (pressed || working !== undefined) && sharedStyles.taskRowPressed,
          ]}
        >
          {working === 'copy' ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <SymbolView
              name="doc.on.doc"
              size={16}
              tintColor={theme.text}
              fallback={<ThemedText type="smallBold">Copy</ThemedText>}
            />
          )}
          <ThemedText type="smallBold">Copy</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save generated image"
          disabled={working !== undefined}
          onPress={() => void saveImage()}
          style={({ pressed }) => [
            styles.imageAction,
            { backgroundColor: theme.primary },
            (pressed || working !== undefined) && sharedStyles.taskRowPressed,
          ]}
        >
          {working === 'save' ? (
            <ActivityIndicator size="small" color={theme.primaryForeground} />
          ) : (
            <SymbolView
              name="square.and.arrow.down"
              size={16}
              tintColor={theme.primaryForeground}
              fallback={
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.primaryForeground }}
                >
                  Save
                </ThemedText>
              }
            />
          )}
          <ThemedText
            type="smallBold"
            style={{ color: theme.primaryForeground }}
          >
            Save
          </ThemedText>
        </Pressable>
      </View>
      {feedback ? (
        <ThemedText
          accessibilityLiveRegion="polite"
          type="small"
          themeColor="textSecondary"
        >
          {feedback}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  imageCard: {
    overflow: 'hidden',
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
  },
  imageActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  imageAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    gap: Spacing.one,
  },
  imageActionOutline: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
