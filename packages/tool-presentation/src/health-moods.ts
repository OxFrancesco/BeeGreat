// The Bee Healthy mood vocabulary, shared by the web and mobile apps so the
// scale, labels, and palette can never drift between platforms.

export type Mood = "awful" | "bad" | "okay" | "good" | "great";

export type MoodOption = {
  value: Mood;
  label: string;
  color: string;
  softColor: string;
};

export const MOODS = [
  { value: "awful", label: "Awful", color: "#D96F5C", softColor: "#F8DDD7" },
  { value: "bad", label: "Bad", color: "#C98B48", softColor: "#F6E5D1" },
  { value: "okay", label: "Okay", color: "#D9A63E", softColor: "#F8EDCE" },
  { value: "good", label: "Good", color: "#75A469", softColor: "#E1EDDD" },
  { value: "great", label: "Great", color: "#449487", softColor: "#D9ECE8" },
] as const satisfies readonly MoodOption[];
