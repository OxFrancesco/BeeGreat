import * as Haptics from 'expo-haptics';
import { useRef, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GalleryContext } from './specimen';

import { CardsSection } from './cards-section';
import { ChatSection } from './chat-section';
import { DomainsSection } from './domains-section';
import { PrimitivesSection } from './primitives-section';

type SectionId = 'chat' | 'cards' | 'primitives' | 'domains';

const SECTIONS: { id: SectionId; label: string; Component: ComponentType }[] = [
  { id: 'chat', label: 'Chat', Component: ChatSection },
  { id: 'cards', label: 'Cards', Component: CardsSection },
  { id: 'primitives', label: 'Basics', Component: PrimitivesSection },
  { id: 'domains', label: 'App', Component: DomainsSection },
];

export function PlaygroundScreen() {
  const theme = useTheme();
  const scroll = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState<SectionId>('chat');
  const section = SECTIONS.find((entry) => entry.id === active) ?? SECTIONS[0];

  return (
    <ScrollView
      ref={scroll}
      key={active}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
      stickyHeaderIndices={[0]}
      style={{ backgroundColor: theme.background }}
    >
      <View
        style={[
          styles.chipBar,
          {
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {SECTIONS.map(({ id, label }) => {
            const selected = id === active;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios')
                    void Haptics.selectionAsync().catch(() => {});
                  setSelected(null);
                  setActive(id);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected
                      ? theme.primary
                      : theme.backgroundElement,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={{
                    color: selected ? theme.primaryForeground : theme.text,
                  }}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.page}>
        <GalleryContext.Provider
          value={{
            selected,
            setSelected: (name) => {
              setSelected(name);
              scroll.current?.scrollTo({ y: 0, animated: false });
            },
            reset: () => setRevision((value) => value + 1),
          }}
        >
          <section.Component key={`${section.id}-${revision}`} />
        </GalleryContext.Provider>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  page: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.six,
  },
});
