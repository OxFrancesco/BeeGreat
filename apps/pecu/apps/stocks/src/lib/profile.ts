import type { JsonValue, JsonInput } from "../../../../src/json-contract";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  profileActionResultSchema,
  profileActionSchema,
  profileOverviewSchema,
  profileSafeDetailSchema,
  type ProfileAction,
  type ProfileActionResult,
  type ProfileOverview,
  type ProfileSafeDetail,
} from "../../../../src/safe-profile-contract";
import { request } from "./use-account";

type Address = `0x${string}`;

export async function profileAction(raw: JsonInput): Promise<ProfileActionResult> {
  const action = profileActionSchema.safeParse(raw);
  if (!action.success) {
    const issue = action.error.issues[0];
    const field = issue?.path.at(-1);
    throw new Error(issue?.message.startsWith("Enter") || issue?.message.startsWith("Use") ? issue.message : `Check the ${labels.get(String(field)) ?? "details"} and try again.`);
  }
  return profileActionResultSchema.parse(await request("profile", action.data satisfies ProfileAction));
}

const labels = new Map(Object.entries({
  safe: "Safe address", to: "recipient address", owner: "owner address", replacement: "new owner address",
  delegate: "spender address", token: "token", amount: "amount", name: "name", owners: "owner addresses",
}));

export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
export const sameAddress = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
export const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Something went wrong. Try again.");

type Loaded<T> = { value: T | null; error: string | null; loading: boolean; refresh: () => Promise<void> };

function useResource<T>(path: string | null, parse: (raw: JsonValue) => T, pollMs: (value: T | null) => number | null): Loaded<T> {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const current = useRef(path);
  current.current = path;
  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const next = parse(await request(path));
      if (current.current !== path) return;
      setValue(next);
      setError(null);
    } catch (reason) {
      if (current.current === path) setError(errorText(reason));
    } finally {
      if (current.current === path) setLoading(false);
    }
  }, [path, parse]);
  useEffect(() => {
    setValue(null);
    setError(null);
    void refresh();
  }, [refresh]);
  const delay = pollMs(value);
  useEffect(() => {
    if (delay === null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, delay);
    return () => window.clearInterval(timer);
  }, [delay, refresh]);
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  return { value, error, loading, refresh };
}

const parseOverview = (raw: JsonValue) => profileOverviewSchema.parse(raw);
const parseSafe = (raw: JsonValue) => profileSafeDetailSchema.parse(raw);

export function useProfileOverview(signedIn: boolean) {
  return useResource<ProfileOverview>(signedIn ? "profile" : null, parseOverview, (value) =>
    value?.orgs.some((org) => org.safes.some((safe) => safe.status === "creating")) ? 10_000 : null,
  );
}

export function useSafeDetail(address: string | null) {
  return useResource<ProfileSafeDetail>(address ? `profile-safe?safe=${address}` : null, parseSafe, (value) => {
    if (!value) return null;
    const busy = value.status === "creating"
      || value.intents.some((intent) => intent.preview.state === "executing")
      || value.queue.some((proposal) => proposal.state === "submitted" || proposal.intents.some((intent) => intent.preview.state === "executing"));
    return busy ? 8_000 : 60_000;
  });
}

export type ProfileContextValue = {
  overview: ProfileOverview | null;
  refreshOverview: () => Promise<void>;
};
export const ProfileContext = createContext<ProfileContextValue>({ overview: null, refreshOverview: async () => {} });
export const useProfile = () => useContext(ProfileContext);

export function addressLabel(address: string, options: { contacts?: readonly { address: string; name: string }[]; wallet?: string | null; browser?: string | null }): string | null {
  if (sameAddress(address, options.wallet)) return "Your Pecu wallet";
  if (sameAddress(address, options.browser)) return "Your connected wallet";
  return options.contacts?.find((contact) => sameAddress(contact.address, address))?.name ?? null;
}

export function resetLabel(minutes: number): string {
  if (minutes === 0) return "One time";
  if (minutes === 1440) return "Every day";
  if (minutes === 10080) return "Every week";
  if (minutes === 43200) return "Every 30 days";
  if (minutes % 1440 === 0) return `Every ${minutes / 1440} days`;
  if (minutes % 60 === 0) return `Every ${minutes / 60} hours`;
  return `Every ${minutes} minutes`;
}

export const newRequestId = () => crypto.randomUUID();
export const safeTabs = ["transactions", "owners", "settings"] as const;
export type SafeTab = (typeof safeTabs)[number];
export type { Address };
