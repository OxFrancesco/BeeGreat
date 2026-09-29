import type { Trigger } from "./task-contract";

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const weekdayIndex = new Map([["Sun", 0], ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6]]);
const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(timestamp: number, timeZone: string): ZonedParts {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatters.set(timeZone, formatter);
  }
  const parts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, weekday: 0 };
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type === "weekday") parts.weekday = weekdayIndex.get(part.value) ?? 0;
    else if (part.type === "year" || part.type === "month" || part.type === "day" || part.type === "hour" || part.type === "minute" || part.type === "second") parts[part.type] = Number(part.value);
  }
  return parts;
}

const comparable = (parts: Omit<ZonedParts, "weekday">) => Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

/** The instant a wall-clock time happens in a zone. A time skipped by a DST change moves forward by the gap. */
function instantFor(parts: Omit<ZonedParts, "weekday">, timeZone: string): number {
  const target = comparable(parts);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const adjustment = target - comparable(zonedParts(candidate, timeZone));
    if (adjustment === 0) return candidate;
    candidate += adjustment;
  }
  return candidate;
}

/**
 * The first occurrence strictly after `after`, or null when the trigger never
 * fires again. Price triggers return the next time their price is checked.
 */
export function nextOccurrence(trigger: Trigger, after: number): number | null {
  switch (trigger.kind) {
    case "once":
      return trigger.at > after ? trigger.at : null;
    case "interval": {
      if (trigger.startAt > after) return trigger.startAt;
      const every = trigger.everyMinutes * 60_000;
      return trigger.startAt + (Math.floor((after - trigger.startAt) / every) + 1) * every;
    }
    case "calendar": {
      const [hour = 0, minute = 0] = trigger.time.split(":").map(Number);
      const today = zonedParts(after, trigger.timezone);
      for (let offset = 0; offset <= 8; offset++) {
        const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
        if (!trigger.weekdays.includes(date.getUTCDay())) continue;
        const at = instantFor({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour, minute, second: 0 }, trigger.timezone);
        if (at > after) return at;
      }
      return null;
    }
    case "price":
      return after + trigger.checkMinutes * 60_000;
    default: {
      const _exhaustive: never = trigger;
      throw new Error(`Unsupported trigger ${String(_exhaustive)}`);
    }
  }
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesText(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? "day" : `${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? "hour" : `${minutes / 60} h`;
  return `${minutes} min`;
}

function dateText(at: number, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).format(new Date(at));
}

/** A short plain-language schedule, shown in every client and in chat replies. */
export function describeTrigger(trigger: Trigger): string {
  switch (trigger.kind) {
    case "once": return `Once, ${dateText(trigger.at)}`;
    case "interval": return `Every ${minutesText(trigger.everyMinutes)}`;
    case "calendar": {
      const days = trigger.weekdays.length === 7 ? "Daily"
        : trigger.weekdays.join(",") === "1,2,3,4,5" ? "Weekdays"
        : trigger.weekdays.map((day) => dayNames[day]).join(", ");
      return `${days} ${trigger.time} ${trigger.timezone}`;
    }
    case "price": return `When ${trigger.token} is ${trigger.direction === "above" ? "at or above" : "at or below"} $${trigger.priceUsd}`;
    default: {
      const _exhaustive: never = trigger;
      throw new Error(`Unsupported trigger ${String(_exhaustive)}`);
    }
  }
}

export function describeTime(at: number, timeZone?: string): string {
  return dateText(at, timeZone);
}
