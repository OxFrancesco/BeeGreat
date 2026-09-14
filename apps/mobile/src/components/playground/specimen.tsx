import {
  Children,
  Component,
  createContext,
  isValidElement,
  use,
  useCallback,
  useState,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared chrome for the component playground: a section holds a numbered run
 * of specimens, and each specimen is a framed card with the JSX that produced
 * it in a header strip and the live render on the page background below.
 */

export const GalleryContext = createContext<{
  selected: string | null;
  setSelected: (name: string | null) => void;
  reset: () => void;
}>({ selected: null, setSelected: () => {}, reset: () => {} });

export function Section({
  title,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const { selected, setSelected, reset } = use(GalleryContext);
  const specimens = Children.toArray(children).filter(
    (child): child is ReactElement<{ name: string; note?: string }> =>
      isValidElement(child) && child.type === Specimen,
  );
  const visible = specimens.filter((child) =>
    `${child.props.name} ${child.props.note ?? ''}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const current = specimens.find((child) => child.props.name === selected);

  return (
    <View style={styles.section}>
      {current ? (
        <>
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected(null)}
              style={styles.control}
            >
              <ThemedText type="smallBold">
                ‹ All {title.toLowerCase()}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={reset}
              style={styles.control}
            >
              <ThemedText type="smallBold">Reset</ThemedText>
            </Pressable>
          </View>
          <View>{current}</View>
          {Children.toArray(children).filter(
            (child) => !isValidElement(child) || child.type !== Specimen,
          )}
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel={`Search ${title.toLowerCase()} components`}
            placeholder="Search components"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={[
              styles.search,
              {
                color: theme.text,
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          />
          <View style={styles.sectionBody}>
            {visible.map((child) => (
              <Pressable
                key={child.props.name}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${child.props.name}`}
                onPress={() => setSelected(child.props.name)}
                style={({ pressed }) => [
                  styles.directoryRow,
                  {
                    backgroundColor: pressed
                      ? theme.backgroundSelected
                      : theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: Spacing.one }}>
                  <ThemedText type="smallBold">
                    {child.props.name.replace(/[<>]/g, '')}
                  </ThemedText>
                  {child.props.note ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {child.props.note}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ))}
            {visible.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                No matching components.
              </ThemedText>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

/** One component on display: a framed card, name strip on top, live render below. */
export function Specimen({
  name,
  note,
  children,
}: PropsWithChildren<{ name: string; note?: string }>) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.specimen,
        { borderColor: theme.border, backgroundColor: theme.card },
      ]}
    >
      <View style={[styles.specimenLabel, { borderBottomColor: theme.border }]}>
        <ThemedText selectable type="code" style={styles.specimenName}>
          {name}
        </ThemedText>
        {note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[styles.specimenStage, { backgroundColor: theme.background }]}
      >
        <CrashBoundary label={name} theme={theme}>
          {children}
        </CrashBoundary>
      </View>
    </View>
  );
}

/**
 * Keeps one crashing specimen (e.g. a hook that needs live backend data) from
 * taking the whole gallery down — the slot shows the error instead. Sections
 * wrap the same boundary so a crash during a section's own render still
 * leaves the rest of the page usable.
 */
class CrashBoundary extends Component<
  PropsWithChildren<{
    label: string;
    theme: { destructive: string; border: string };
  }>,
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View
          style={[styles.crash, { borderColor: this.props.theme.destructive }]}
        >
          <ThemedText type="smallBold" themeColor="destructive">
            {this.props.label} crashed
          </ThemedText>
          <ThemedText
            selectable
            type="small"
            themeColor="destructive"
            style={styles.crashMessage}
          >
            {error.message}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => this.setState({ error: null })}
            style={styles.control}
          >
            <ThemedText type="smallBold">Retry preview</ThemedText>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Horizontal wrap row for small variants shown side by side. */
export function VariantRow({ children }: { children: ReactNode }) {
  return <View style={styles.variantRow}>{children}</View>;
}

/** Labeled variant inside a VariantRow. */
export function Variant({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  const theme = useTheme();
  return (
    <View style={styles.variant}>
      {children}
      <View
        style={[
          styles.variantPill,
          { backgroundColor: theme.backgroundElement },
        ]}
      >
        <ThemedText
          type="code"
          themeColor="textSecondary"
          style={styles.variantLabel}
        >
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Captures `onReply`/`onSubmit` callbacks so interactive specimens show what
 * they would have sent to Bee instead of needing a live agent.
 */
export function useReplySink() {
  const theme = useTheme();
  const [last, setLast] = useState<string>();
  const onReply = useCallback((text: string) => setLast(text), []);
  const sink =
    last === undefined ? null : (
      <View style={[styles.reply, { backgroundColor: theme.secondary }]}>
        <ThemedText type="code" themeColor="secondaryForeground">
          Preview response
        </ThemedText>
        <ThemedText selectable type="small" themeColor="secondaryForeground">
          {last}
        </ThemedText>
      </View>
    );
  return { onReply, sink };
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  control: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontSize: 17,
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  section: {
    gap: Spacing.four,
  },
  sectionBody: {
    gap: Spacing.four,
  },
  specimen: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  specimenLabel: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  specimenName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  specimenStage: {
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'stretch',
    minHeight: 140,
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    alignItems: 'flex-end',
  },
  variant: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  variantPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  variantLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  reply: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    padding: Spacing.two + Spacing.half,
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: Spacing.half,
  },
  crash: {
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  crashMessage: {
    fontFamily: Fonts.mono,
  },
});
