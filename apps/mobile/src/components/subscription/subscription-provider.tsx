import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { subscriptionClient } from "@/lib/subscription-client";
import { SubscriptionClientError } from "@/lib/subscription-client-types";
import type {
  SubscriptionPlan,
  SubscriptionSnapshot,
} from "@/lib/subscription-state";

export type SubscriptionPhase =
  "waiting-for-user" | "loading" | "active" | "inactive" | "unavailable";

export type SubscriptionOperation =
  "purchase" | "restore" | "manage" | "refresh";

type ProviderState = {
  appUserId: string | null;
  phase: SubscriptionPhase;
  snapshot: SubscriptionSnapshot | null;
  operation: SubscriptionOperation | null;
  error: string | null;
  message: string | null;
};

export type SubscriptionContextValue = {
  phase: SubscriptionPhase;
  isPro: boolean;
  plan: SubscriptionPlan | null;
  managementUrl: string | null;
  operation: SubscriptionOperation | null;
  error: string | null;
  message: string | null;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  manage: () => Promise<void>;
  refresh: () => Promise<void>;
  recordPaywallImpression: () => Promise<void>;
  clearFeedback: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null,
);

function phaseFromSnapshot(snapshot: SubscriptionSnapshot): SubscriptionPhase {
  return snapshot.isPro ? "active" : "inactive";
}

function userMessage(error: unknown): string {
  if (error instanceof SubscriptionClientError) return error.message;
  return "BeeGreat Pro could not connect to the App Store. Please try again.";
}

export function SubscriptionProvider({
  clerkUserId,
  revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  children,
}: PropsWithChildren<{
  clerkUserId: string | null | undefined;
  revenueCatApiKey?: string;
}>) {
  const [state, setState] = useState<ProviderState>({
    appUserId: null,
    phase: "waiting-for-user",
    snapshot: null,
    operation: null,
    error: null,
    message: null,
  });
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const operationRef = useRef<SubscriptionOperation | null>(null);
  const sessionVersionRef = useRef(0);

  const applySnapshot = useCallback((snapshot: SubscriptionSnapshot) => {
    setState((current) => ({
      ...current,
      phase: phaseFromSnapshot(snapshot),
      snapshot,
      error: null,
    }));
  }, []);

  useEffect(() => {
    sessionVersionRef.current += 1;
    let cancelled = false;
    let unsubscribe = () => {};

    if (!clerkUserId) {
      setState({
        appUserId: null,
        phase: "waiting-for-user",
        snapshot: null,
        operation: null,
        error: null,
        message: null,
      });
      return;
    }

    if (process.env.EXPO_OS !== "ios") {
      setState({
        appUserId: clerkUserId,
        phase: "unavailable",
        snapshot: null,
        operation: null,
        error: null,
        message: null,
      });
      return;
    }

    const apiKey = revenueCatApiKey?.trim() ?? "";
    if (!apiKey) {
      setState({
        appUserId: clerkUserId,
        phase: "unavailable",
        snapshot: null,
        operation: null,
        error: "BeeGreat Pro is not configured correctly yet.",
        message: null,
      });
      return;
    }

    setState({
      appUserId: clerkUserId,
      phase: "loading",
      snapshot: null,
      operation: null,
      error: null,
      message: null,
    });

    void (async () => {
      try {
        const snapshot = await subscriptionClient.connect({
          appUserId: clerkUserId,
          apiKey,
        });
        if (cancelled) {
          subscriptionClient.disconnect(clerkUserId);
          return;
        }
        unsubscribe = subscriptionClient.subscribe(clerkUserId, applySnapshot);
        applySnapshot(snapshot);
      } catch (error) {
        if (cancelled) return;
        setState({
          appUserId: clerkUserId,
          phase: "unavailable",
          snapshot: null,
          operation: null,
          error: userMessage(error),
          message: null,
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      subscriptionClient.disconnect(clerkUserId);
      operationRef.current = null;
    };
  }, [applySnapshot, clerkUserId, connectionAttempt, revenueCatApiKey]);

  const beginOperation = useCallback(
    (operation: SubscriptionOperation): boolean => {
      if (operationRef.current) return false;
      operationRef.current = operation;
      setState((current) => ({
        ...current,
        operation,
        error: null,
        message: null,
      }));
      return true;
    },
    [],
  );

  const finishOperation = useCallback(() => {
    operationRef.current = null;
    setState((current) => ({ ...current, operation: null }));
  }, []);

  const purchase = useCallback(async () => {
    const sessionVersion = sessionVersionRef.current;
    if (!beginOperation("purchase")) return;
    try {
      const outcome = await subscriptionClient.purchaseMonthly();
      if (sessionVersionRef.current !== sessionVersion) return;
      if (outcome.kind === "purchased") {
        applySnapshot(outcome.snapshot);
        setState((current) => ({
          ...current,
          message: outcome.snapshot.isPro
            ? "Welcome to BeeGreat Pro."
            : "Your purchase is still syncing. Tap Restore Purchases in a moment.",
        }));
      } else if (outcome.kind === "pending") {
        setState((current) => ({
          ...current,
          message:
            "Your purchase is pending approval. Pro unlocks after Apple confirms it.",
        }));
      }
      // A user-cancelled StoreKit sheet is intentionally silent.
    } catch (error) {
      if (sessionVersionRef.current !== sessionVersion) return;
      setState((current) => ({ ...current, error: userMessage(error) }));
    } finally {
      if (sessionVersionRef.current === sessionVersion) finishOperation();
    }
  }, [applySnapshot, beginOperation, finishOperation]);

  const restore = useCallback(async () => {
    const sessionVersion = sessionVersionRef.current;
    if (!beginOperation("restore")) return;
    try {
      const snapshot = await subscriptionClient.restore();
      if (sessionVersionRef.current !== sessionVersion) return;
      applySnapshot(snapshot);
      setState((current) => ({
        ...current,
        message: snapshot.isPro
          ? "BeeGreat Pro has been restored."
          : "No active BeeGreat Pro subscription was found for this Apple Account.",
      }));
    } catch (error) {
      if (sessionVersionRef.current !== sessionVersion) return;
      setState((current) => ({ ...current, error: userMessage(error) }));
    } finally {
      if (sessionVersionRef.current === sessionVersion) finishOperation();
    }
  }, [applySnapshot, beginOperation, finishOperation]);

  const manage = useCallback(async () => {
    const sessionVersion = sessionVersionRef.current;
    if (!beginOperation("manage")) return;
    try {
      await subscriptionClient.manage();
    } catch (error) {
      if (sessionVersionRef.current !== sessionVersion) return;
      setState((current) => ({ ...current, error: userMessage(error) }));
    } finally {
      if (sessionVersionRef.current === sessionVersion) finishOperation();
    }
  }, [beginOperation, finishOperation]);

  const refresh = useCallback(async () => {
    if (state.phase === "unavailable") {
      setState((current) => ({
        ...current,
        phase: "loading",
        error: null,
        message: null,
      }));
      setConnectionAttempt((attempt) => attempt + 1);
      return;
    }

    const sessionVersion = sessionVersionRef.current;
    if (!beginOperation("refresh")) return;
    try {
      const snapshot = await subscriptionClient.refresh();
      if (sessionVersionRef.current !== sessionVersion) return;
      applySnapshot(snapshot);
    } catch (error) {
      if (sessionVersionRef.current !== sessionVersion) return;
      setState((current) => ({ ...current, error: userMessage(error) }));
    } finally {
      if (sessionVersionRef.current === sessionVersion) finishOperation();
    }
  }, [applySnapshot, beginOperation, finishOperation, state.phase]);

  useEffect(() => {
    if (process.env.EXPO_OS !== "ios" || !clerkUserId) return;

    let previousState = AppState.currentState;
    const listener = AppState.addEventListener("change", (nextState) => {
      const returnedToForeground =
        nextState === "active" && previousState !== "active";
      previousState = nextState;
      if (
        returnedToForeground &&
        (state.phase === "active" || state.phase === "inactive")
      ) {
        void refresh();
      }
    });

    return () => listener.remove();
  }, [clerkUserId, refresh, state.phase]);

  const recordPaywallImpression = useCallback(async () => {
    try {
      await subscriptionClient.trackPaywallImpression();
    } catch {
      // Analytics must never block purchase, restore, legal, or sign-out actions.
    }
  }, []);

  const clearFeedback = useCallback(() => {
    setState((current) => ({ ...current, error: null, message: null }));
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => {
    // Never carry an entitlement across a Clerk account transition, even for
    // the single render before the identity effect reconnects RevenueCat.
    const identityMatches = Boolean(
      clerkUserId && state.appUserId === clerkUserId,
    );
    const phase: SubscriptionPhase = !clerkUserId
      ? "waiting-for-user"
      : identityMatches
        ? state.phase
        : "loading";
    const snapshot = identityMatches ? state.snapshot : null;

    return {
      phase,
      isPro: phase === "active",
      plan: snapshot?.plan ?? null,
      managementUrl: snapshot?.managementUrl ?? null,
      operation: identityMatches ? state.operation : null,
      error: identityMatches ? state.error : null,
      message: identityMatches ? state.message : null,
      purchase,
      restore,
      manage,
      refresh,
      recordPaywallImpression,
      clearFeedback,
    };
  }, [
    clearFeedback,
    clerkUserId,
    manage,
    purchase,
    recordPaywallImpression,
    refresh,
    restore,
    state,
  ]);

  return <SubscriptionContext value={value}>{children}</SubscriptionContext>;
}

export function useSubscription(): SubscriptionContextValue {
  const subscription = use(SubscriptionContext);
  if (!subscription) {
    throw new Error(
      "useSubscription must be used inside SubscriptionProvider.",
    );
  }
  return subscription;
}
