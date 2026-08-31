import { api } from "@beegreat/backend/convex/_generated/api";
import { useUser } from "@clerk/clerk-expo";
import type { FunctionArgs } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";

import { HoneyQrCode } from "@/components/honey-qr-code";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { captureMobileFailure } from "@/lib/sentry";

const PROVIDERS = [
  "instagram",
  "linkedin",
  "x",
  "github",
  "youtube",
  "tiktok",
  "facebook",
  "website",
  "other",
] as const;
type Provider = (typeof PROVIDERS)[number];
type EditableLink = {
  id: string;
  provider: Provider;
  label: string;
  url: string;
};

function newLink(): EditableLink {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    provider: "website",
    label: "",
    url: "",
  };
}

function providerLabel(provider: Provider) {
  if (provider === "x") return "X";
  return provider.slice(0, 1).toUpperCase() + provider.slice(1);
}

export default function PublicProfileScreen() {
  const { user } = useUser();
  const theme = useTheme();
  const queriedProfile = useQuery(api.publicProfiles.mine);
  const ensureProfile = useMutation(api.publicProfiles.ensureMine);
  const saveProfile = useMutation(api.publicProfiles.saveMine);
  const ensuring = useRef(false);
  const initialized = useRef(false);
  const [provisionedProfile, setProvisionedProfile] =
    useState<typeof queriedProfile>();
  const profile = queriedProfile ?? provisionedProfile;
  const [ensureAttempt, setEnsureAttempt] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState(false);
  const [links, setLinks] = useState<EditableLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (queriedProfile !== null || ensuring.current || !user) return;
    ensuring.current = true;
    const ensureArgs: FunctionArgs<typeof api.publicProfiles.ensureMine> = {
      displayName: user.fullName ?? user.username ?? "Beekeeper",
      suggestedHandle: user.username ?? user.fullName ?? "beekeeper",
    };
    if (user.hasImage) ensureArgs.avatarUrl = user.imageUrl;
    void ensureProfile(ensureArgs)
      .then((created) => {
        // Render from the mutation immediately. The live query normally catches
        // up at once, but first-time provisioning should not depend on it.
        setProvisionedProfile(created);
      })
      .catch((cause) => {
        captureMobileFailure(cause, "public_profile.ensure");
        setError("Couldn't create your public profile.");
        ensuring.current = false;
      });
  }, [ensureAttempt, ensureProfile, queriedProfile, user]);

  useEffect(() => {
    if (!profile || initialized.current) return;
    initialized.current = true;
    setDisplayName(profile.displayName);
    setHandle(profile.handle);
    setBio(profile.bio ?? "");
    setPublished(profile.published);
    setLinks(
      profile.links.map((link, index) => ({
        id: `${index}-${link.url}`,
        ...link,
      })),
    );
  }, [profile]);

  const updateLink = (id: string, update: Partial<EditableLink>) => {
    setLinks((current) =>
      current.map((link) => (link.id === id ? { ...link, ...update } : link)),
    );
  };

  const moveLink = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= links.length) return;
    setLinks((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
  };

  const save = async () => {
    if (!profile || saving) return;
    const incomplete = links.find(
      (link) => Boolean(link.label.trim()) !== Boolean(link.url.trim()),
    );
    if (incomplete) {
      setError("Each link needs both a label and an HTTPS URL.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saveArgs: FunctionArgs<typeof api.publicProfiles.saveMine> = {
        handle,
        displayName,
        published,
        links: links
          .filter((link) => link.label.trim() && link.url.trim())
          .map(({ provider, label, url }) => ({ provider, label, url })),
      };
      if (bio.trim()) saveArgs.bio = bio;
      if (profile.avatarUrl) saveArgs.avatarUrl = profile.avatarUrl;
      const saved = await saveProfile(saveArgs);
      setHandle(saved.handle);
      setDisplayName(saved.displayName);
      setBio(saved.bio ?? "");
      setPublished(saved.published);
      setLinks(
        saved.links.map((link, index) => ({
          id: `${index}-${link.url}`,
          ...link,
        })),
      );
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (cause) {
      captureMobileFailure(cause, "public_profile.save");
      setError(
        cause instanceof Error ? cause.message : "Couldn't save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!profile) return;
    await Clipboard.setStringAsync(profile.profileUrl);
    setCopied(true);
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
    setTimeout(() => setCopied(false), 1_500);
  };

  const share = async () => {
    if (!profile) return;
    await Share.share({
      title: `${displayName} on BeeGreat`,
      message: `Find me on BeeGreat: ${profile.profileUrl}`,
      url: profile.profileUrl,
    });
  };

  return (
    // Keep a concrete native wrapper: react-native-screens form sheets can
    // otherwise collapse ScrollView content to zero height after reopening.
    <ThemedView style={styles.container} collapsable={false}>
      <Stack.Screen options={{ title: "Public profile" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {!profile ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.loadingMark, { backgroundColor: theme.secondary }]}
            >
              <ActivityIndicator color={theme.secondaryForeground} />
            </View>
            <ThemedText type="subtitle">
              {error ? "Profile unavailable" : "Preparing your profile"}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={error ? "destructive" : "textSecondary"}
              style={styles.loadingCopy}
            >
              {error ?? "Creating your permanent profile link and QR…"}
            </ThemedText>
            {error ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setError(null);
                  ensuring.current = false;
                  setEnsureAttempt((current) => current + 1);
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText
                  style={{
                    color: theme.primaryForeground,
                    fontWeight: "700",
                  }}
                >
                  Try again
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View style={[styles.qrCard, { backgroundColor: theme.secondary }]}>
              <View style={styles.qrFrame}>
                <HoneyQrCode value={profile.qrUrl} size={184} />
              </View>
              <View style={styles.qrCopy}>
                <ThemedText
                  style={[styles.qrTitle, { color: theme.secondaryForeground }]}
                >
                  Your permanent QR
                </ThemedText>
                <ThemedText
                  type="small"
                  selectable
                  style={{ color: theme.secondaryForeground, opacity: 0.78 }}
                >
                  bee.buddytools.org/@{handle || profile.handle}
                </ThemedText>
              </View>
              <View style={styles.shareActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void share()}
                  style={({ pressed }) => [
                    styles.honeyAction,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText
                    style={{
                      color: theme.primaryForeground,
                      fontWeight: "700",
                    }}
                  >
                    Share
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void copyLink()}
                  style={({ pressed }) => [
                    styles.quietHoneyAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText style={{ color: theme.secondaryForeground }}>
                    {copied ? "Copied ✓" : "Copy link"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">Profile</ThemedText>
              <Field label="Display name">
                <TextInput
                  accessibilityLabel="Display name"
                  autoCapitalize="words"
                  maxLength={60}
                  value={displayName}
                  onChangeText={setDisplayName}
                  selectionColor="#D89B21"
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </Field>
              <Field
                label="Handle"
                hint="Letters, numbers, dashes, and underscores"
              >
                <View
                  style={[
                    styles.handleInput,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <ThemedText themeColor="textSecondary">@</ThemedText>
                  <TextInput
                    accessibilityLabel="Profile handle"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={30}
                    value={handle}
                    onChangeText={setHandle}
                    selectionColor="#D89B21"
                    style={[styles.handleTextInput, { color: theme.text }]}
                  />
                </View>
              </Field>
              <Field label="Bio" hint={`${bio.length}/180`}>
                <TextInput
                  accessibilityLabel="Profile bio"
                  multiline
                  maxLength={180}
                  placeholder="What should people know about you?"
                  placeholderTextColor={theme.textSecondary}
                  value={bio}
                  onChangeText={setBio}
                  selectionColor="#D89B21"
                  style={[
                    styles.input,
                    styles.bioInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </Field>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.settingCopy}>
                  <ThemedText type="smallBold">Links</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Add up to 12 social profiles or websites.
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={links.length >= 12}
                  onPress={() => setLinks((current) => [...current, newLink()])}
                  style={({ pressed }) => [
                    styles.addButton,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">+ Add</ThemedText>
                </Pressable>
              </View>
              {links.map((link, index) => (
                <View
                  key={link.id}
                  style={[
                    styles.linkCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.providerRow}
                  >
                    {PROVIDERS.map((provider) => (
                      <Pressable
                        key={provider}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: link.provider === provider,
                        }}
                        onPress={() => updateLink(link.id, { provider })}
                        style={[
                          styles.providerChip,
                          {
                            backgroundColor:
                              link.provider === provider
                                ? theme.secondary
                                : theme.backgroundElement,
                          },
                        ]}
                      >
                        <ThemedText type="small">
                          {providerLabel(provider)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput
                    accessibilityLabel={`Link ${index + 1} label`}
                    placeholder="Label"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={40}
                    value={link.label}
                    onChangeText={(label) => updateLink(link.id, { label })}
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <TextInput
                    accessibilityLabel={`Link ${index + 1} URL`}
                    placeholder="https://…"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    value={link.url}
                    onChangeText={(url) => updateLink(link.id, { url })}
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <View style={styles.linkActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${link.label || `link ${index + 1}`} up`}
                      disabled={index === 0}
                      onPress={() => moveLink(index, -1)}
                      style={styles.smallAction}
                    >
                      <ThemedText type="small" themeColor="textSecondary">
                        ↑ Up
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${link.label || `link ${index + 1}`} down`}
                      disabled={index === links.length - 1}
                      onPress={() => moveLink(index, 1)}
                      style={styles.smallAction}
                    >
                      <ThemedText type="small" themeColor="textSecondary">
                        ↓ Down
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${link.label || `link ${index + 1}`}`}
                      onPress={() =>
                        setLinks((current) =>
                          current.filter((item) => item.id !== link.id),
                        )
                      }
                      style={styles.smallAction}
                    >
                      <ThemedText type="small" themeColor="destructive">
                        Remove
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.publishCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.settingCopy}>
                <ThemedText type="default">Publish profile</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {published
                    ? "Anyone with your link or QR can see it."
                    : "Only you can see this draft."}
                </ThemedText>
              </View>
              <Switch
                accessibilityLabel="Publish public profile"
                value={published}
                onValueChange={setPublished}
                trackColor={{ true: theme.primary }}
              />
            </View>

            {error ? (
              <ThemedText
                type="small"
                themeColor="destructive"
                accessibilityLiveRegion="polite"
                selectable
              >
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: saving }}
              disabled={saving}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: saving
                    ? theme.backgroundElement
                    : theme.primary,
                },
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.textSecondary} />
              ) : (
                <ThemedText
                  style={{ color: theme.primaryForeground, fontWeight: "700" }}
                >
                  Save profile
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="link"
              disabled={!published}
              onPress={() =>
                void WebBrowser.openBrowserAsync(profile.profileUrl, {
                  presentationStyle:
                    WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                })
              }
              style={({ pressed }) => [
                styles.previewButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText
                type="smallBold"
                themeColor={published ? "text" : "textSecondary"}
              >
                {published
                  ? "Open public profile ↗"
                  : "Publish to open public profile"}
              </ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <ThemedText type="small">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  loadingCard: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: Spacing.four,
  },
  loadingMark: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    marginBottom: Spacing.one,
  },
  loadingCopy: { maxWidth: 300, textAlign: "center" },
  retryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  qrCard: {
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: Spacing.four,
  },
  qrFrame: { overflow: "hidden", borderRadius: 18, borderCurve: "continuous" },
  qrCopy: { alignItems: "center", gap: Spacing.half },
  qrTitle: {
    fontFamily: Fonts?.rounded,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  shareActions: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: Spacing.two,
  },
  honeyAction: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  quietHoneyAction: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(88,45,29,0.25)",
    paddingHorizontal: Spacing.three,
  },
  section: { gap: Spacing.three },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  settingCopy: { flex: 1, gap: Spacing.half },
  field: { gap: Spacing.two },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  bioInput: { minHeight: 112, textAlignVertical: "top" },
  handleInput: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: Spacing.three,
  },
  handleTextInput: { flex: 1, minHeight: 46, fontSize: 16 },
  addButton: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  linkCard: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  providerRow: { gap: Spacing.one },
  providerChip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  linkActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.one,
  },
  smallAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  publishCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  saveButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
  },
  previewButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.72 },
});
