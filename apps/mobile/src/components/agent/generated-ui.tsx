import { api } from "@beegreat/backend/convex/_generated/api";
import type { Id } from "@beegreat/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { FirstFocusPreviewCard } from "@/components/first-focus/first-focus-preview-card";
import { ThemedText } from "@/components/themed-text";
import { MotionDuration } from "@/constants/motion";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { UIComponent } from "@/lib/ui-spec";

/** Renders the agent's `beeui` spec as native cards streaming in below the pill. */
export function GeneratedUI({
  components,
  onReply,
}: {
  components: UIComponent[];
  /** Sends a message back to the agent (used by interactive cards). */
  onReply?: (text: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  if (components.length === 0) return null;
  return (
    <View style={styles.stack}>
      {components.map((component, index) => (
        <Animated.View
          key={index}
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeInDown.delay(index * 80)
                  .springify()
                  .damping(18)
          }
        >
          <UIComponentView component={component} onReply={onReply} />
        </Animated.View>
      ))}
    </View>
  );
}

function UIComponentView({
  component,
  onReply,
}: {
  component: UIComponent;
  onReply?: (text: string) => void;
}) {
  switch (component.type) {
    case "text":
      return <ThemedText>{component.body}</ThemedText>;
    case "metric":
      return <MetricCard {...component} />;
    case "chart":
      return <BarChartCard {...component} />;
    case "tasks":
      return <TaskListCard {...component} />;
    case "highlight":
      return <HighlightCard {...component} />;
    case "image":
      return <GeneratedImageCard {...component} />;
    case "bookmark":
      return <BookmarkCard {...component} />;
    case "devin":
      return <DevinCard {...component} onReply={onReply} />;
    case "first_focus":
      return <FirstFocusPreviewCard preview={component} />;
    case "confirm": {
      const web3ActionId = component.payload?.web3ActionId;
      if (typeof web3ActionId === "string" && web3ActionId.length > 0) {
        return (
          <Web3ConfirmCard
            summary={component.summary}
            actionId={web3ActionId}
            onReply={onReply}
          />
        );
      }
      return <ConfirmCard {...component} onReply={onReply} />;
    }
  }
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {children}
    </View>
  );
}

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <Card>
      <ThemedText selectable type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.metricRow}>
        <ThemedText selectable type="subtitle" style={styles.metricValue}>
          {value}
        </ThemedText>
        {delta ? (
          <ThemedText selectable type="smallBold" themeColor="textSecondary">
            {delta}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

function BarChartCard({
  title,
  unit,
  data,
}: {
  title: string;
  unit?: string;
  data: { label: string; value: number }[];
}) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.chart}>
        {data.map((point) => (
          <View key={point.label} style={styles.chartItem}>
            {/* Label sits above the bar so long goal names never truncate. */}
            <ThemedText type="small" themeColor="textSecondary">
              {point.label}
            </ThemedText>
            <View style={styles.chartRow}>
              <View
                style={[
                  styles.chartTrack,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <View
                  style={[
                    styles.chartFill,
                    {
                      backgroundColor: theme.primary,
                      width: `${Math.max((point.value / max) * 100, 2)}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText selectable type="small" style={styles.chartValue}>
                {point.value}
                {unit ? ` ${unit}` : ""}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TaskListCard({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; done: boolean; due?: string }[];
}) {
  const theme = useTheme();
  // The card is a snapshot from the agent; overlay live Convex state so rows
  // stay in sync with the Goals pages and stay tappable to complete tasks.
  const live = useQuery(api.tasks.statuses, {
    taskIds: items.map((item) => item.id as Id<"tasks">),
  });
  const toggle = useMutation(api.tasks.toggle);
  const liveById = new Map(live?.map((task) => [task.id, task.status]));

  const onToggle = async (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggle({ taskId: taskId as Id<"tasks"> });
    } catch {
      // Row simply stays as-is; the live query is the source of truth.
    }
  };

  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.taskList}>
        {items.map((item) => {
          const liveStatus = liveById.get(item.id as Id<"tasks">);
          const done = liveStatus ? liveStatus === "done" : item.done;
          // Only rows backed by a real task are interactive.
          const interactive = liveStatus !== undefined;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: !interactive }}
              accessibilityLabel={item.title}
              disabled={!interactive}
              onPress={() => onToggle(item.id)}
              style={({ pressed }) => [
                styles.taskRow,
                pressed && styles.taskRowPressed,
              ]}
            >
              <SymbolView
                name={done ? "checkmark.circle.fill" : "circle"}
                size={18}
                tintColor={done ? theme.primary : theme.textSecondary}
                fallback={
                  <ThemedText type="small" themeColor="textSecondary">
                    {done ? "[x]" : "[ ]"}
                  </ThemedText>
                }
              />
              <View style={styles.taskBody}>
                <ThemedText
                  style={[styles.taskTitle, done && styles.taskDone]}
                  themeColor={done ? "textSecondary" : "text"}
                >
                  {item.title}
                </ThemedText>
                {item.due ? (
                  <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                  >
                    {item.due}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function HighlightCard({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
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

function imageFileName(url: string) {
  try {
    const sourceName = new URL(url).pathname.split("/").pop() ?? "";
    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(sourceName)) {
      return sourceName;
    }
  } catch {
    // The schema already validates the URL; keep a safe fallback for native URL parsing.
  }
  return `bee-image-${Date.now()}.png`;
}

async function downloadGeneratedImage(url: string) {
  return File.downloadFileAsync(
    url,
    new File(Paths.cache, imageFileName(url)),
    { idempotent: true },
  );
}

function GeneratedImageCard({
  url,
  alt,
  title,
}: Extract<UIComponent, { type: "image" }>) {
  const theme = useTheme();
  const [feedback, setFeedback] = useState<string>();
  const [working, setWorking] = useState<"copy" | "save">();

  const copyImage = async () => {
    setWorking("copy");
    try {
      const file = await downloadGeneratedImage(url);
      await Clipboard.setImageAsync(await file.base64());
      setFeedback("Image copied");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      await Clipboard.setStringAsync(url);
      setFeedback("Image link copied");
    } finally {
      setWorking(undefined);
    }
  };

  const saveImage = async () => {
    setWorking("save");
    try {
      const file = await downloadGeneratedImage(url);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: "Save image",
          mimeType: file.type || "image/png",
          UTI: "public.image",
        });
        setFeedback("Image ready to save");
      } else {
        await Linking.openURL(url);
        setFeedback("Image opened");
      }
    } catch {
      await Linking.openURL(url);
      setFeedback("Image opened");
    } finally {
      setWorking(undefined);
    }
  };

  return (
    <View
      style={[
        styles.card,
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
            (pressed || working !== undefined) && styles.taskRowPressed,
          ]}
        >
          {working === "copy" ? (
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
            (pressed || working !== undefined) && styles.taskRowPressed,
          ]}
        >
          {working === "save" ? (
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

function bookmarkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function BookmarkCard({
  title,
  url,
  note,
}: Extract<UIComponent, { type: "bookmark" }>) {
  const theme = useTheme();
  const host = bookmarkHost(url);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open bookmark ${title} on ${host}`}
      onPress={() => {
        Haptics.selectionAsync();
        void Linking.openURL(url);
      }}
      style={({ pressed }) => [
        styles.card,
        styles.bookmarkCard,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && styles.taskRowPressed,
      ]}
    >
      <View style={styles.bookmarkHeading}>
        <ExpoImage
          accessibilityElementsHidden
          importantForAccessibility="no"
          contentFit="contain"
          source={{
            uri: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
          }}
          style={[
            styles.bookmarkFavicon,
            { backgroundColor: theme.backgroundElement },
          ]}
        />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={styles.bookmarkTitle}
        >
          {title}
        </ThemedText>
        <SymbolView
          name="arrow.up.right"
          size={13}
          tintColor={theme.textSecondary}
          fallback={
            <ThemedText type="small" themeColor="textSecondary">
              ↗
            </ThemedText>
          }
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
        {note?.trim() || host}
      </ThemedText>
    </Pressable>
  );
}

function DevinCard({
  title,
  status,
  statusDetail,
  sessionId,
  sessionUrl,
  summary,
  pullRequests,
  onReply,
}: Extract<UIComponent, { type: "devin" }> & {
  onReply?: (text: string) => void;
}) {
  const theme = useTheme();
  const live = useQuery(api.devinData.get, { sessionId });
  const currentStatus = live?.status ?? status;
  const currentDetail = live?.statusDetail ?? statusDetail;
  const currentPullRequests = live?.pullRequests ?? pullRequests;
  const detail =
    currentDetail?.replace(/_/g, " ") ?? currentStatus.replace(/_/g, " ");
  const open = (url: string) => {
    Haptics.selectionAsync();
    void Linking.openURL(url);
  };

  return (
    <View
      style={[
        styles.card,
        styles.devinCard,
        { backgroundColor: theme.card, borderColor: "#F2765A66" },
      ]}
    >
      <View style={styles.devinHeading}>
        <View style={styles.devinMark}>
          <SymbolView
            name="cloud.fill"
            size={16}
            tintColor="#FFFFFF"
            fallback={<ThemedText style={styles.devinMarkText}>D</ThemedText>}
          />
        </View>
        <View style={styles.devinTitle}>
          <ThemedText type="smallBold">{title}</ThemedText>
        </View>
        <View style={styles.devinStatus}>
          <View style={styles.devinStatusDot} />
          <ThemedText type="smallBold" style={styles.devinStatusText}>
            {detail}
          </ThemedText>
        </View>
      </View>
      {summary ? <ThemedText selectable>{summary}</ThemedText> : null}
      {currentPullRequests.length ? (
        <View style={styles.devinLinks}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Pull requests
          </ThemedText>
          {currentPullRequests.map((pullRequest, index) => (
            <Pressable
              key={pullRequest.url}
              accessibilityRole="link"
              accessibilityLabel={`Open pull request ${index + 1}`}
              onPress={() => open(pullRequest.url)}
              style={({ pressed }) => [
                styles.devinLink,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.taskRowPressed,
              ]}
            >
              <SymbolView
                name="arrow.triangle.pull"
                size={14}
                tintColor={theme.text}
                fallback={<ThemedText type="small">PR</ThemedText>}
              />
              <ThemedText type="smallBold" style={styles.devinLinkLabel}>
                Pull request {index + 1}
              </ThemedText>
              {pullRequest.state ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {pullRequest.state}
                </ThemedText>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.devinActions}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open this session in Devin"
          onPress={() => open(sessionUrl)}
          style={({ pressed }) => [
            styles.devinPrimaryAction,
            pressed && styles.taskRowPressed,
          ]}
        >
          <ThemedText type="smallBold" style={styles.devinPrimaryText}>
            Open in Devin
          </ThemedText>
          <SymbolView
            name="arrow.up.right"
            size={12}
            tintColor="#FFFFFF"
            fallback={
              <ThemedText style={styles.devinPrimaryText}>↗</ThemedText>
            }
          />
        </Pressable>
        {onReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh Devin status"
            onPress={() =>
              onReply(
                `Check Devin session ${sessionId} and show me the latest update and pull requests.`,
              )
            }
            style={({ pressed }) => [
              styles.devinSecondaryAction,
              { borderColor: theme.border },
              pressed && styles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold">Refresh</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Web3 money movement: the app is the authoritative confirmer. Tapping
 * Confirm runs the signed-in `web3Actions.confirm` mutation (which schedules
 * server-side execution) and only then tells Bee. A chat "yes" alone can
 * never move funds.
 */
function Web3ConfirmCard({
  summary,
  actionId,
  onReply,
}: {
  summary: string;
  actionId: string;
  onReply?: (text: string) => void;
}) {
  const theme = useTheme();
  const confirmAction = useMutation(api.web3Actions.confirm);
  const cancelAction = useMutation(api.web3Actions.cancel);
  const [decision, setDecision] = useState<
    "idle" | "working" | "confirmed" | "declined"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  // Subscribe only once the confirm mutation proved the id valid and owned.
  const live = useQuery(
    api.web3Actions.status,
    decision === "confirmed"
      ? { actionId: actionId as Id<"web3Actions"> }
      : "skip",
  );

  const confirm = async () => {
    if (decision !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDecision("working");
    setError(null);
    try {
      await confirmAction({ actionId: actionId as Id<"web3Actions"> });
      setDecision("confirmed");
      onReply?.("I confirmed the action in the app. Check its status.");
    } catch (cause) {
      setDecision("idle");
      setError(
        cause instanceof Error ? cause.message : "Couldn’t confirm the action.",
      );
    }
  };

  const decline = () => {
    if (decision !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDecision("declined");
    cancelAction({ actionId: actionId as Id<"web3Actions"> }).catch(() => {
      // Cancelling a stale or unknown action is a no-op.
    });
    onReply?.("No, I declined the action.");
  };

  const status = live?.status;
  const explorerLink =
    live?.socketProgress?.destinationExplorerLink ??
    [...(live?.result ?? [])].reverse().find((item) => item.explorerLink)
      ?.explorerLink;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.destructive },
      ]}
    >
      <ThemedText type="smallBold" themeColor="destructive">
        Needs your confirmation
      </ThemedText>
      <ThemedText selectable>{summary}</ThemedText>
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
      {decision === "declined" ? (
        <ThemedText type="small" themeColor="textSecondary">
          Declined — nothing was sent.
        </ThemedText>
      ) : decision === "confirmed" ? (
        status === "executed" ? (
          <View style={styles.confirmRow}>
            <ThemedText type="smallBold">Done ✓</ThemedText>
            {explorerLink ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(explorerLink)}
                style={({ pressed }) => pressed && styles.taskRowPressed}
              >
                <ThemedText type="smallBold" themeColor="textSecondary">
                  View transaction ↗
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : status === "failed" ? (
          <ThemedText
            type="small"
            themeColor="destructive"
            accessibilityLiveRegion="polite"
          >
            {live?.error ?? "Execution failed."}
          </ThemedText>
        ) : status === "refunded" ? (
          <ThemedText type="small" accessibilityLiveRegion="polite">
            The route was refunded.
          </ThemedText>
        ) : status === "expired" ? (
          <ThemedText
            type="small"
            themeColor="destructive"
            accessibilityLiveRegion="polite"
          >
            This confirmation expired before execution.
          </ThemedText>
        ) : (
          <View style={styles.confirmRow}>
            <ActivityIndicator size="small" />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityLiveRegion="polite"
            >
              {status === "in_progress"
                ? (live?.socketProgress?.detail ?? "Moving funds…")
                : "Confirmed — preparing…"}
            </ThemedText>
          </View>
        )
      ) : (
        <View style={styles.confirmRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm in app"
            disabled={decision === "working"}
            onPress={() => void confirm()}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: theme.primary },
              (pressed || decision === "working") && styles.taskRowPressed,
            ]}
          >
            {decision === "working" ? (
              <ActivityIndicator size="small" color={theme.primaryForeground} />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: theme.primaryForeground }}
              >
                Confirm
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline"
            disabled={decision === "working"}
            onPress={decline}
            style={({ pressed }) => [
              styles.confirmButton,
              styles.confirmButtonOutline,
              { borderColor: theme.border },
              pressed && styles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold">No</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ConfirmCard({
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
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.destructive },
      ]}
    >
      <ThemedText type="smallBold" themeColor="destructive">
        Needs your confirmation
      </ThemedText>
      <ThemedText>{summary}</ThemedText>
      {onReply ? (
        <View style={styles.confirmRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm"
            onPress={() => reply("Yes")}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: theme.primary },
              pressed && styles.taskRowPressed,
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
            onPress={() => reply("No")}
            style={({ pressed }) => [
              styles.confirmButton,
              styles.confirmButtonOutline,
              { borderColor: theme.border },
              pressed && styles.taskRowPressed,
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

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
    alignSelf: "stretch",
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    borderCurve: "continuous",
    padding: Spacing.three,
    gap: Spacing.two,
    minWidth: 0,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  metricValue: {
    flexShrink: 1,
  },
  chart: {
    gap: Spacing.three,
  },
  chartItem: {
    gap: Spacing.one,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  chartTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },
  chartFill: {
    height: "100%",
    borderRadius: 6,
  },
  chartValue: {
    minWidth: 48,
    textAlign: "right",
  },
  taskList: {
    gap: Spacing.two,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  taskRowPressed: {
    opacity: 0.6,
  },
  confirmRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  confirmButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 20,
  },
  confirmButtonOutline: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  taskTitle: {
    flexShrink: 1,
  },
  taskDone: {
    textDecorationLine: "line-through",
  },
  highlight: {
    borderWidth: 0,
  },
  imageCard: {
    overflow: "hidden",
  },
  generatedImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Spacing.two,
    borderCurve: "continuous",
  },
  imageActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  imageAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    gap: Spacing.one,
  },
  imageActionOutline: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  bookmarkCard: {
    gap: Spacing.two,
  },
  bookmarkHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  bookmarkFavicon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderCurve: "continuous",
  },
  bookmarkTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 21,
  },
  devinCard: {
    borderWidth: 1,
  },
  devinHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  devinMark: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderCurve: "continuous",
    backgroundColor: "#D85238",
  },
  devinMarkText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  devinTitle: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  devinStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    minHeight: 26,
    borderRadius: 13,
    backgroundColor: "#F2765A1F",
  },
  devinStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D85238",
  },
  devinStatusText: {
    color: "#D85238",
    textTransform: "capitalize",
  },
  devinLinks: {
    gap: Spacing.one,
  },
  devinLink: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    borderCurve: "continuous",
    gap: Spacing.two,
  },
  devinLinkLabel: {
    flex: 1,
  },
  devinActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  devinPrimaryAction: {
    minHeight: 40,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#D85238",
    gap: Spacing.one,
  },
  devinPrimaryText: {
    color: "#FFFFFF",
  },
  devinSecondaryAction: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
