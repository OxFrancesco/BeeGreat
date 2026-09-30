import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeResearchStates,
  researchActionResultSchema,
  researchDetailSchema,
  researchListSchema,
  type ResearchAction,
  type ResearchDetail,
  type ResearchList,
  type ResearchSummary,
} from "../../../../src/research-contract";
import { errorText } from "./profile";
import { request } from "./use-account";

const pollMs = 5_000;
const stateText: Readonly<Record<ResearchSummary["state"], string>> = {
  queued: "Waiting for a slot",
  collecting: "Collecting chain data",
  researching: "Specialists at work",
  synthesizing: "Writing the report",
  completed: "Ready",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const researchActive = (research: Pick<ResearchSummary, "state">) => activeResearchStates.has(research.state);
export const researchStateText = (research: Pick<ResearchSummary, "state">) => stateText[research.state];

const month = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** 23–29 Sep 2026 for a finished window, or "last 7d" before the data was collected. */
export function researchPeriod(research: Pick<ResearchSummary, "period" | "window">): string {
  if (!research.period) return `Last ${research.window}`;
  const start = new Date(`${research.period.start}T00:00:00Z`);
  const end = new Date(`${research.period.end}T00:00:00Z`);
  return research.period.start === research.period.end ? monthYear.format(end) : `${month.format(start)}–${monthYear.format(end)}`;
}

/** The signed-in user's runs; polls while one is running. */
export function useResearches(enabled: boolean) {
  const [list, setList] = useState<ResearchList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      setList(researchListSchema.parse(await request("researches")));
      setError(null);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      loading.current = false;
    }
  }, []);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);
  const running = list?.researches.some(researchActive) ?? false;
  useEffect(() => {
    if (!enabled || !running) return;
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [enabled, running, load]);
  return { list, error, load };
}

/** One run with its report; polls until it finishes. */
export function useResearch(code: string, enabled: boolean) {
  const [detail, setDetail] = useState<ResearchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setDetail(researchDetailSchema.parse(await request(`research?code=${encodeURIComponent(code)}`)));
      setError(null);
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [code]);
  useEffect(() => { setDetail(null); if (enabled) void load(); }, [enabled, load]);
  const running = detail ? researchActive(detail) : false;
  useEffect(() => {
    if (!enabled || !running) return;
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [enabled, running, load]);
  return { detail, error, load };
}

export async function researchAction(action: ResearchAction) {
  return researchActionResultSchema.parse(await request("research-action", action));
}
