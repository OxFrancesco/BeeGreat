import posthog, { type PostHogConfig } from "posthog-js";
import { analyticsIdentity, analyticsPath, posthogHost, posthogProjectToken } from "./analytics-config";

const safeProperties = new Set([
  "token", "distinct_id", "$device_id", "$session_id", "$window_id", "$lib", "$lib_version",
  "$browser", "$browser_version", "$os", "$os_version", "$device_type",
  "$screen_height", "$screen_width", "$viewport_height", "$viewport_width",
  "$is_identified", "$process_person_profile", "$anon_distinct_id",
  "product", "environment", "surface", "destination", "$current_url", "$pathname",
]);

export const analyticsOptions = {
  api_host: posthogHost,
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_exceptions: false,
  capture_performance: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_external_dependency_loading: true,
  advanced_disable_flags: true,
  enable_heatmaps: false,
  rageclick: false,
  save_referrer: false,
  save_campaign_params: false,
  person_profiles: "identified_only",
  ip: false,
  respect_dnt: true,
  before_send: (event) => {
    if (!event) return null;
    if (!["$pageview", "$identify", "pecu_navigation_clicked"].includes(event.event)) return null;
    event.properties = Object.fromEntries(Object.entries(event.properties).filter(([key]) => safeProperties.has(key)));
    event.properties.$pathname = analyticsPath(window.location.pathname);
    event.properties.$current_url = `https://pecu.app${event.properties.$pathname}`;
    event.properties.product = "pecu";
    event.properties.environment = "production";
    event.properties.$geoip_disable = true;
    delete event.$set;
    delete event.$set_once;
    return event;
  },
} satisfies Partial<PostHogConfig>;

let initialized = false;
let lastPage: string | undefined;
let currentSender: string | null | undefined;
let identityGeneration = 0;

export async function identifyAnalytics(senderId: string | null): Promise<void> {
  if (!initAnalytics() || senderId === currentSender) return;
  const generation = ++identityGeneration;
  if (currentSender || (senderId === null && posthog.get_distinct_id().startsWith("pecu_"))) posthog.reset(true);
  currentSender = senderId;
  if (senderId === null) return;
  const identity = await analyticsIdentity(senderId);
  if (generation !== identityGeneration) return;
  const persistedIdentity = posthog.get_distinct_id();
  if (persistedIdentity.startsWith("pecu_") && persistedIdentity !== identity) posthog.reset(true);
  posthog.identify(identity);
}

export function initAnalytics(): boolean {
  if (typeof window === "undefined" || window.location.hostname !== "pecu.app") return false;
  if (!initialized) {
    posthog.init(posthogProjectToken, analyticsOptions);
    initialized = true;
  }
  return true;
}

export function trackPage(path: string): void {
  if (!initAnalytics()) return;
  const page = analyticsPath(path);
  if (lastPage === page) return;
  lastPage = page;
  posthog.capture("$pageview", { surface: page === "/" ? "site" : "app" });
}

export type AnalyticsDestination = "agent" | "stocks" | "aero_cli" | "aero_docs" | "x_chat" | "evm_sdk";

export function trackNavigation(destination: AnalyticsDestination): void {
  if (initAnalytics()) posthog.capture("pecu_navigation_clicked", { destination }, { send_instantly: true });
}
