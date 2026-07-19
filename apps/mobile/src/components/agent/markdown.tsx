import * as Linking from 'expo-linking';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Themed markdown for assistant replies: honey links, soft code blocks. */
export function Markdown({ children }: { children: string }) {
  const theme = useTheme();

  const style = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: theme.text,
          fontSize: 17,
          lineHeight: 26,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: Spacing.two,
        },
        heading1: {
          fontSize: 24,
          lineHeight: 30,
          fontWeight: '700',
          marginBottom: Spacing.two,
        },
        heading2: {
          fontSize: 21,
          lineHeight: 27,
          fontWeight: '700',
          marginBottom: Spacing.two,
        },
        heading3: {
          fontSize: 18,
          lineHeight: 24,
          fontWeight: '700',
          marginBottom: Spacing.one,
        },
        heading4: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
        heading5: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
        heading6: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
        strong: { fontWeight: '700' },
        link: {
          color: theme.primary,
          textDecorationLine: 'underline',
        },
        blockquote: {
          backgroundColor: theme.backgroundElement,
          borderLeftWidth: 3,
          borderLeftColor: theme.primary,
          borderRadius: Spacing.one,
          paddingHorizontal: Spacing.two,
          marginLeft: 0,
        },
        code_inline: {
          backgroundColor: theme.backgroundElement,
          color: theme.text,
          fontFamily: Fonts.mono,
          fontSize: 15,
          borderRadius: Spacing.one,
          paddingHorizontal: Spacing.one,
        },
        code_block: {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          color: theme.text,
          fontFamily: Fonts.mono,
          fontSize: 14,
          lineHeight: 20,
          borderRadius: Spacing.two,
          padding: Spacing.two,
        },
        fence: {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          color: theme.text,
          fontFamily: Fonts.mono,
          fontSize: 14,
          lineHeight: 20,
          borderRadius: Spacing.two,
          padding: Spacing.two,
        },
        bullet_list: { marginBottom: Spacing.two },
        ordered_list: { marginBottom: Spacing.two },
        list_item: { marginBottom: Spacing.one },
        bullet_list_icon: { color: theme.textSecondary },
        ordered_list_icon: { color: theme.textSecondary },
        hr: {
          backgroundColor: theme.border,
          height: StyleSheet.hairlineWidth,
          marginVertical: Spacing.two,
        },
        table: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          borderRadius: Spacing.one,
        },
        th: {
          padding: Spacing.one,
          fontWeight: '700',
        },
        td: {
          padding: Spacing.one,
        },
        tr: {
          borderColor: theme.border,
        },
      }),
    [theme],
  );

  return (
    <MarkdownDisplay
      style={style}
      onLinkPress={(url) => {
        void Linking.openURL(url);
        return false;
      }}
    >
      {children}
    </MarkdownDisplay>
  );
}
