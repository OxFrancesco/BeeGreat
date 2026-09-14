import { platformSymbol } from '@/components/platform-symbol';
import { api } from '@beegreat/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

import { sharedStyles } from './shared';

type DevinCardProps = Extract<UIComponent, { type: 'devin' }> & {
  onReply?: (text: string) => void;
};

export function DevinCard(props: DevinCardProps) {
  const live = useQuery(api.devinData.get, { sessionId: props.sessionId });
  return (
    <DevinCardView
      {...props}
      status={live?.status ?? props.status}
      statusDetail={live?.statusDetail ?? props.statusDetail}
      pullRequests={live?.pullRequests ?? props.pullRequests}
    />
  );
}

export function DevinCardView({
  title,
  status,
  statusDetail,
  sessionId,
  sessionUrl,
  summary,
  pullRequests,
  onReply,
}: DevinCardProps) {
  const theme = useTheme();
  const currentStatus = status;
  const currentDetail = statusDetail;
  const currentPullRequests = pullRequests;
  const detail =
    currentDetail?.replace(/_/g, ' ') ?? currentStatus.replace(/_/g, ' ');
  const open = (url: string) => {
    Haptics.selectionAsync();
    void Linking.openURL(url);
  };

  return (
    <View
      style={[
        sharedStyles.card,
        styles.devinCard,
        { backgroundColor: theme.card, borderColor: '#F2765A66' },
      ]}
    >
      <View style={styles.devinHeading}>
        <View style={styles.devinMark}>
          <SymbolView
            name={platformSymbol("cloud.fill")}
            size={16}
            tintColor="#FFFFFF"
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
                pressed && sharedStyles.taskRowPressed,
              ]}
            >
              <SymbolView
                name={platformSymbol("arrow.triangle.pull")}
                size={14}
                tintColor={theme.text}
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
            pressed && sharedStyles.taskRowPressed,
          ]}
        >
          <ThemedText type="smallBold" style={styles.devinPrimaryText}>
            Open in Devin
          </ThemedText>
          <SymbolView
            name={platformSymbol("arrow.up.right")}
            size={12}
            tintColor="#FFFFFF"
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
              pressed && sharedStyles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold">Refresh</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  devinCard: {
    borderWidth: 1,
  },
  devinHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  devinMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderCurve: 'continuous',
    backgroundColor: '#D85238',
  },
  devinMarkText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  devinTitle: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  devinStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    minHeight: 26,
    borderRadius: 13,
    backgroundColor: '#F2765A1F',
  },
  devinStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D85238',
  },
  devinStatusText: {
    color: '#D85238',
    textTransform: 'capitalize',
  },
  devinLinks: {
    gap: Spacing.one,
  },
  devinLink: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: Spacing.two,
  },
  devinLinkLabel: {
    flex: 1,
  },
  devinActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  devinPrimaryAction: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#D85238',
    gap: Spacing.one,
  },
  devinPrimaryText: {
    color: '#FFFFFF',
  },
  devinSecondaryAction: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
