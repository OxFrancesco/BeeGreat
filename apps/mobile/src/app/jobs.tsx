import { api } from "@beegreat/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Job = FunctionReturnType<typeof api.agentJobs.list>[number];

function formatDate(timestamp?: number) {
  if (!timestamp) return "No upcoming run";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function scheduleLabel(schedule: Job["schedule"]) {
  if (schedule.kind === "once") return `Once · ${formatDate(schedule.at)}`;
  if (schedule.kind === "interval") {
    const minutes = schedule.everyMs / 60_000;
    if (minutes % 1_440 === 0)
      return `Every ${minutes / 1_440} day${minutes === 1_440 ? "" : "s"}`;
    if (minutes % 60 === 0)
      return `Every ${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
    return `Every ${minutes} minutes`;
  }
  const noun = schedule.frequency
    .replace("daily", "day")
    .replace("weekly", "week")
    .replace("monthly", "month")
    .replace("yearly", "year");
  return `Every ${schedule.interval === 1 ? "" : `${schedule.interval} `}${noun}`;
}

export default function JobsScreen() {
  const theme = useTheme();
  const jobs = useQuery(api.agentJobs.list);
  const grants = useQuery(api.agentJobGrants.list);
  const pause = useMutation(api.agentJobs.pause);
  const resume = useMutation(api.agentJobs.resume);
  const cancel = useMutation(api.agentJobs.cancel);
  const runNow = useMutation(api.agentJobs.runNow);
  const approveGrant = useMutation(api.agentJobGrants.approve);
  const revokeGrant = useMutation(api.agentJobGrants.revoke);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const refreshCurrentTime = () => setCurrentTime(Date.now());
    const initialRefresh = setTimeout(refreshCurrentTime, 0);
    const refreshInterval = setInterval(refreshCurrentTime, 60_000);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(refreshInterval);
    };
  }, []);

  const perform = async (
    job: Job,
    action: "pause" | "resume" | "cancel" | "run",
  ) => {
    if (workingId) return;
    setWorkingId(job.id);
    setError(null);
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
    try {
      if (action === "pause") await pause({ jobId: job.id });
      else if (action === "resume") await resume({ jobId: job.id });
      else if (action === "cancel") await cancel({ jobId: job.id });
      else await runNow({ jobId: job.id });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Bee could not update this Job.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  const confirmCancel = (job: Job) => {
    Alert.alert(
      "Cancel Job?",
      `“${job.title}” will stop permanently and cannot be resumed.`,
      [
        { text: "Keep Job", style: "cancel" },
        {
          text: "Cancel Job",
          style: "destructive",
          onPress: () => void perform(job, "cancel"),
        },
      ],
    );
  };

  const confirmGrant = (job: Job, action: "approve" | "revoke") => {
    const grant = grants?.find((item) => item.jobId === job.id);
    if (!grant || workingId) return;
    const actions = grant.allowedActions
      .map((item) => item.replace("_", " "))
      .join(", ");
    Alert.alert(
      action === "approve"
        ? "Approve scoped wallet access?"
        : "Revoke wallet access?",
      action === "approve"
        ? `For 30 days, “${job.title}” may perform ${actions} on pool ${grant.poolAddress.slice(0, 6)}…${grant.poolAddress.slice(-4)} with your Bee smart wallet.`
        : `“${job.title}” will no longer be able to move funds without a new approval.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: action === "approve" ? "Approve 30 days" : "Revoke",
          style: action === "revoke" ? "destructive" : "default",
          onPress: () => {
            setWorkingId(job.id);
            setError(null);
            const mutation =
              action === "approve"
                ? approveGrant({ jobId: job.id })
                : revokeGrant({ jobId: job.id });
            void mutation
              .catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Bee could not update wallet access.",
                ),
              )
              .finally(() => setWorkingId(null));
          },
        },
      ],
    );
  };

  return (
    // collapsable={false} keeps this wrapper in the native tree so the form
    // sheet can find the ScrollView (react-native-screens#2424).
    <ThemedView style={styles.container} collapsable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.intro}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.eyebrow}
          >
            AGENT JOBS
          </ThemedText>
          <ThemedText style={styles.title}>Bee, on your schedule</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Each Job keeps its own conversation and runs on every device.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.dismissAll();
              router.replace("/");
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={{ color: theme.primaryForeground, fontWeight: "700" }}
            >
              Ask Bee to make a Job
            </ThemedText>
          </Pressable>
        </View>

        {error ? (
          <ThemedText
            type="small"
            themeColor="destructive"
            style={styles.error}
          >
            {error}
          </ThemedText>
        ) : null}

        {jobs === undefined ? (
          <ActivityIndicator color={theme.primary} style={styles.loading} />
        ) : jobs.length === 0 ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <SymbolView
              name="clock.badge.checkmark"
              size={34}
              tintColor={theme.secondaryForeground}
              fallback={<ThemedText style={styles.emptyGlyph}>⌁</ThemedText>}
            />
            <ThemedText style={styles.emptyTitle}>No Jobs yet</ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.emptyCopy}
            >
              Try “ping me on Telegram every two hours.”
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {jobs.map((job) => {
              const working = workingId === job.id;
              const grant = grants?.find((item) => item.jobId === job.id);
              const grantStatus =
                grant?.status === "active" &&
                grant.expiresAt !== undefined &&
                currentTime > 0 &&
                grant.expiresAt <= currentTime
                  ? "expired"
                  : grant?.status;
              return (
                <View
                  key={job.id}
                  style={[
                    styles.card,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.topline}>
                    <View
                      style={[
                        styles.status,
                        {
                          backgroundColor:
                            job.status === "active"
                              ? theme.secondary
                              : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            job.status === "active"
                              ? theme.secondaryForeground
                              : theme.textSecondary,
                        }}
                      >
                        {job.status.toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {job.delivery.includes("telegram")
                        ? "App + Telegram"
                        : "App"}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.cardTitle}>{job.title}</ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    numberOfLines={3}
                  >
                    {job.instruction}
                  </ThemedText>
                  <View style={styles.timing}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {scheduleLabel(job.schedule)}
                    </ThemedText>
                    <ThemedText type="small">
                      Next · {formatDate(job.nextRunAt)}
                    </ThemedText>
                  </View>
                  {grant ? (
                    <View
                      style={[
                        styles.grant,
                        { backgroundColor: theme.secondary },
                      ]}
                    >
                      <View style={styles.grantCopy}>
                        <ThemedText
                          type="small"
                          style={{
                            color: theme.secondaryForeground,
                            fontWeight: "700",
                          }}
                        >
                          Scoped wallet access
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: theme.secondaryForeground }}
                          numberOfLines={2}
                        >
                          {grant.allowedActions
                            .map((item) => item.replace("_", " "))
                            .join(" · ")}{" "}
                          · {grant.poolAddress.slice(0, 6)}…
                          {grant.poolAddress.slice(-4)}
                        </ThemedText>
                      </View>
                      {grantStatus === "pending" ||
                      grantStatus === "expired" ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={working}
                          onPress={() => confirmGrant(job, "approve")}
                          style={styles.grantButton}
                        >
                          <ThemedText
                            type="small"
                            style={{
                              color: theme.secondaryForeground,
                              fontWeight: "700",
                            }}
                          >
                            Approve
                          </ThemedText>
                        </Pressable>
                      ) : grantStatus === "active" ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={working}
                          onPress={() => confirmGrant(job, "revoke")}
                          style={styles.grantButton}
                        >
                          <ThemedText type="small" themeColor="destructive">
                            Revoke
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    {job.status === "active" ? (
                      <JobButton
                        label="Pause"
                        disabled={working}
                        onPress={() => void perform(job, "pause")}
                      />
                    ) : job.status === "paused" ? (
                      <JobButton
                        label="Resume"
                        disabled={working}
                        onPress={() => void perform(job, "resume")}
                      />
                    ) : null}
                    {job.status !== "cancelled" ? (
                      <JobButton
                        label="Run now"
                        disabled={working}
                        onPress={() => void perform(job, "run")}
                      />
                    ) : null}
                    {job.status !== "cancelled" &&
                    job.status !== "completed" ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={working}
                        onPress={() => confirmCancel(job)}
                        style={({ pressed }) => [
                          styles.cancelButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText type="small" themeColor="destructive">
                          Cancel
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function JobButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: theme.border },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  intro: { gap: Spacing.two, marginBottom: Spacing.four },
  eyebrow: { fontFamily: Fonts.mono, letterSpacing: 1.2 },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: { lineHeight: 22 },
  primaryButton: {
    minHeight: 48,
    marginTop: Spacing.two,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  error: { marginBottom: Spacing.three },
  loading: { marginTop: Spacing.six },
  list: { gap: Spacing.three },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  cardTitle: {
    marginTop: Spacing.one,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: "700",
  },
  timing: { gap: Spacing.one, marginTop: Spacing.two },
  grant: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    padding: 12,
    marginTop: Spacing.two,
  },
  grantCopy: { flex: 1, gap: Spacing.one },
  grantButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actionButton: {
    minHeight: 44,
    minWidth: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  cancelButton: {
    minHeight: 44,
    marginLeft: "auto",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  empty: {
    minHeight: 230,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  emptyGlyph: { fontSize: 34 },
  emptyTitle: {
    marginTop: Spacing.two,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyCopy: { marginTop: Spacing.one, textAlign: "center" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
