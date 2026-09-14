import { platformSymbol } from '@/components/platform-symbol';
import type { BeeAnimation } from '@beegreat/tool-presentation';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/agent/cards/shared';
import { FloatingBee } from '@/components/floating-bee';
import { HexAvatar } from '@/components/hex-avatar';
import { HexButton, Hive } from '@/components/hex-button';
import { HexIconButton } from '@/components/hex-icon-button';
import { HoneyQrCode } from '@/components/honey-qr-code';
import { InfoButton } from '@/components/info-button';
import { useInputDialog } from '@/components/input-dialog';
import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Spacing, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import { Section, Specimen, Variant, VariantRow } from './specimen';

const TEXT_TYPES: NonNullable<ThemedTextProps['type']>[] = [
  'title',
  'subtitle',
  'default',
  'small',
  'smallBold',
  'link',
  'linkPrimary',
  'code',
];

const TEXT_COLORS: ThemeColor[] = [
  'text',
  'textSecondary',
  'primary',
  'secondaryForeground',
  'destructive',
];

const BEE_ANIMATIONS: BeeAnimation[] = [
  'idle',
  'fly',
  'happy',
  'sad',
  'thinking',
  'fail',
  'succeed',
];

const FONT_ROLES = ['sans', 'serif', 'rounded', 'mono'] as const;

export function PrimitivesSection() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Section
      title="Primitives"
      description="Themed text and views, hex controls, the bee mascot, and the shared card recipe."
    >
      <Specimen name="<ThemedText type>">
        <View style={{ gap: Spacing.three }}>
          {TEXT_TYPES.map((type) => (
            <View key={type} style={{ gap: Spacing.half }}>
              <ThemedText type="code" themeColor="textSecondary">
                {`type="${type}"`}
              </ThemedText>
              <ThemedText type={type}>Plan your next task.</ThemedText>
            </View>
          ))}
        </View>
      </Specimen>

      <Specimen name="<ThemedText themeColor>">
        <View style={{ gap: Spacing.two }}>
          {TEXT_COLORS.map((color) => (
            <ThemedText key={color} themeColor={color}>
              {color}
            </ThemedText>
          ))}
        </View>
      </Specimen>

      <Specimen name="Colors (active scheme)">
        <View style={{ gap: Spacing.two, alignSelf: 'stretch' }}>
          {(Object.keys(palette) as ThemeColor[]).map((name) => (
            <View key={name} style={styles.swatchRow}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: palette[name], borderColor: theme.border },
                ]}
              />
              <ThemedText type="small" style={{ flex: 1 }}>
                {name}
              </ThemedText>
              <ThemedText selectable type="code" themeColor="textSecondary">
                {String(palette[name])}
              </ThemedText>
            </View>
          ))}
        </View>
      </Specimen>

      <Specimen name="Spacing">
        <View style={{ gap: Spacing.two, alignSelf: 'stretch' }}>
          {(Object.keys(Spacing) as (keyof typeof Spacing)[]).map((name) => (
            <View key={name} style={styles.swatchRow}>
              <View
                style={{
                  width: Math.max(Spacing[name], 2),
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: theme.primary,
                }}
              />
              <ThemedText type="code" themeColor="textSecondary">
                {name} = {Spacing[name]}
              </ThemedText>
            </View>
          ))}
        </View>
      </Specimen>

      <Specimen name="Fonts">
        <View style={{ gap: Spacing.two }}>
          {FONT_ROLES.map((role) => (
            <ThemedText key={role} style={{ fontFamily: Fonts[role] }}>
              {role} — The quick brown fox jumps over 0123456789
            </ThemedText>
          ))}
        </View>
      </Specimen>

      <Specimen name="<HexButton>">
        <View style={{ gap: Spacing.three, alignSelf: 'stretch' }}>
          <HexButton label="Primary" busy={false} onPress={() => {}} />
          <HexButton
            label="Secondary"
            busy={false}
            variant="secondary"
            onPress={() => {}}
          />
          <HexButton
            label="With icon"
            busy={false}
            icon={
              <SymbolView name={platformSymbol("sparkles")} size={16} tintColor={Hive.cream} />
            }
            onPress={() => {}}
          />
          <HexButton label="Busy" busy onPress={() => {}} />
          <HexButton
            label="Disabled"
            busy={false}
            disabled
            onPress={() => {}}
          />
        </View>
      </Specimen>

      <Specimen name="<HexIconButton>">
        <VariantRow>
          <Variant label="36">
            <HexIconButton
              size={36}
              icon="line.3.horizontal"
              fallbackGlyph="≡"
              accessibilityLabel="Menu"
              onPress={() => {}}
            />
          </Variant>
          <Variant label="52">
            <HexIconButton
              size={52}
              icon="plus"
              fallbackGlyph="+"
              accessibilityLabel="Add"
              onPress={() => {}}
            />
          </Variant>
        </VariantRow>
      </Specimen>

      <Specimen name="<HexAvatar>">
        <VariantRow>
          <Variant label="fallback">
            <HexAvatar size={48} />
          </Variant>
          <Variant label="uri">
            <HexAvatar
              size={48}
              uri="https://beedocs.pages.dev/assets/bee.png"
            />
          </Variant>
        </VariantRow>
      </Specimen>

      <Specimen name="<InfoButton>">
        <VariantRow>
          <Variant label="inactive">
            <InfoButton
              active={false}
              label="About this card"
              onPress={() => {}}
            />
          </Variant>
          <Variant label="active">
            <InfoButton active label="About this card" onPress={() => {}} />
          </Variant>
        </VariantRow>
      </Specimen>

      <Specimen name="<FloatingBee>" note="Every BeeAnimation">
        <VariantRow>
          {BEE_ANIMATIONS.map((animation) => (
            <Variant key={animation} label={animation}>
              <FloatingBee height={56} animation={animation} />
            </Variant>
          ))}
        </VariantRow>
      </Specimen>

      <Specimen name="<HoneyQrCode>">
        <HoneyQrCode
          value="https://beegreat.example/tap/playground"
          size={140}
        />
      </Specimen>

      <Specimen name="<Card>" note="Shared card recipe">
        <View style={{ alignSelf: 'stretch' }}>
          <Card>
            <ThemedText type="smallBold">Base card</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Hairline border, radius 16, padding 16, gap 8.
            </ThemedText>
          </Card>
        </View>
      </Specimen>

      <Specimen name="<ThemedView type>">
        <VariantRow>
          {(
            [
              'background',
              'card',
              'backgroundElement',
              'backgroundSelected',
              'secondary',
            ] as const
          ).map((type) => (
            <Variant key={type} label={type}>
              <ThemedView type={type} style={styles.themedBox} />
            </Variant>
          ))}
        </VariantRow>
      </Specimen>

      <Specimen name="useInputDialog()" note="Alert + prompt, native on iOS">
        <InputDialogDemo />
      </Specimen>
    </Section>
  );
}

function InputDialogDemo() {
  const dialog = useInputDialog();
  const theme = useTheme();
  const [last, setLast] = useState<string>();
  return (
    <View style={{ gap: Spacing.two }}>
      <VariantRow>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            dialog.alert(
              'Hello from the playground',
              'This is the alert path.',
              [
                { text: 'OK', onPress: () => setLast('OK') },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => setLast('Cancel'),
                },
              ],
            )
          }
          style={[styles.dialogButton, { borderColor: theme.border }]}
        >
          <ThemedText type="smallBold">Alert</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            dialog.prompt(
              'Rename the goal',
              'Only the prompt path renders the inline dialog on Android.',
              [
                { text: 'Save', onPress: (text) => setLast(text ?? '') },
                { text: 'Cancel', style: 'cancel' },
              ],
              'plain-text',
              'Ship BeeGreat 1.0',
            )
          }
          style={[styles.dialogButton, { borderColor: theme.border }]}
        >
          <ThemedText type="smallBold">Prompt</ThemedText>
        </Pressable>
      </VariantRow>
      {last !== undefined ? (
        <ThemedText type="small" themeColor="textSecondary">
          Last result: {last}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  themedBox: {
    width: 56,
    height: 40,
    borderRadius: Spacing.two,
  },
  dialogButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
