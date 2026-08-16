import { describe, expect, test } from "bun:test";

import {
  bookmarkHost,
  eoaFailureReason,
  generatedImageFileName,
  questionAnswer,
} from "./beeui-card-logic";
import {
  bookmarkKindGlyph,
  bookmarkKindLabel,
  bookmarkSourceLabel,
} from "./bookmark-presentation";
import { MOODS } from "./health-moods";
import { compareDrafts, formatSaveState } from "./journal-draft";

describe("questionAnswer", () => {
  test("echoes the question and the chosen answer", () => {
    expect(questionAnswer("Which goal?", "Run a 10k")).toBe(
      "For “Which goal?”, my answer is “Run a 10k”.",
    );
  });
});

describe("bookmarkHost", () => {
  test("strips www. from the hostname", () => {
    expect(bookmarkHost("https://www.example.com/a/b")).toBe("example.com");
  });

  test("falls back to the raw text for unparseable URLs", () => {
    expect(bookmarkHost("not a url")).toBe("not a url");
  });
});

describe("generatedImageFileName", () => {
  test("keeps the source file name when it has an image extension", () => {
    expect(generatedImageFileName("https://cdn.example.com/pics/bee.png")).toBe(
      "bee.png",
    );
  });

  test("falls back to a generated png name otherwise", () => {
    expect(generatedImageFileName("https://cdn.example.com/pics/bee")).toMatch(
      /^bee-image-\d+\.png$/,
    );
  });
});

describe("eoaFailureReason", () => {
  test("classifies EIP-1193 code 4001 as a user rejection", () => {
    expect(eoaFailureReason({ code: 4001 })).toBe("user_rejected");
  });

  test("classifies the wrong-account guidance as an account change", () => {
    expect(
      eoaFailureReason(new Error("Please connect the wallet shown above")),
    ).toBe("account_changed");
  });

  test("everything else is a wallet error", () => {
    expect(eoaFailureReason(new Error("boom"))).toBe("wallet_error");
    expect(eoaFailureReason(undefined)).toBe("wallet_error");
  });
});

describe("MOODS", () => {
  test("keeps the five-step scale in order", () => {
    expect(MOODS.map((mood) => mood.value)).toEqual([
      "awful",
      "bad",
      "okay",
      "good",
      "great",
    ]);
  });
});

describe("compareDrafts", () => {
  const draft = { title: "T", body: "B", tags: ["a", "b"] };

  test("equal drafts compare equal", () => {
    expect(compareDrafts(draft, { ...draft, tags: ["a", "b"] })).toBe(true);
  });

  test("differing tags compare unequal", () => {
    expect(compareDrafts(draft, { ...draft, tags: ["a"] })).toBe(false);
    expect(compareDrafts(draft, { ...draft, tags: ["a", "c"] })).toBe(false);
  });

  test("a tag containing a separator never collides with two tags", () => {
    expect(compareDrafts(draft, { ...draft, tags: ["a\0b"] })).toBe(false);
  });
});

describe("formatSaveState", () => {
  test("uses the caller's error copy and shared copy elsewhere", () => {
    expect(formatSaveState("error", { error: "Not saved" })).toBe("Not saved");
    expect(formatSaveState("error", { error: "Couldn’t save" })).toBe(
      "Couldn’t save",
    );
    expect(formatSaveState("loading", { error: "x" })).toBe("Loading…");
    expect(formatSaveState("saving", { error: "x" })).toBe("Saving…");
    expect(formatSaveState("unsaved", { error: "x" })).toBe("Unsaved changes");
    expect(formatSaveState("saved", { error: "x" })).toBe("Saved");
  });
});

describe("bookmark presentation", () => {
  test("kind labels and glyphs", () => {
    expect(bookmarkKindLabel("website")).toBe("Website");
    expect(bookmarkKindLabel("tweet")).toBe("Tweet");
    expect(bookmarkKindLabel("youtube")).toBe("Video");
    expect(bookmarkKindGlyph("website")).toBe("↗");
    expect(bookmarkKindGlyph("tweet")).toBe("𝕏");
    expect(bookmarkKindGlyph("youtube")).toBe("▶");
  });

  const tweet = {
    url: "https://x.com/bee/status/1",
    meta: { handle: "@bee", author: "Bee", siteName: "X" },
  };

  test("web semantics normalize the handle and prefer the site name", () => {
    expect(
      bookmarkSourceLabel(tweet, {
        normalizeHandle: true,
        preferSiteName: true,
        unparseableUrlLabel: "Tweet",
      }),
    ).toBe("@bee");
    expect(
      bookmarkSourceLabel(
        { url: "nope", meta: { siteName: "X" } },
        { preferSiteName: true, unparseableUrlLabel: "Tweet" },
      ),
    ).toBe("X");
  });

  test("mobile semantics keep the stored handle verbatim and skip site name", () => {
    expect(
      bookmarkSourceLabel(tweet, { unparseableUrlLabel: "tweet" }),
    ).toBe("@@bee");
    expect(
      bookmarkSourceLabel(
        { url: "nope", meta: { siteName: "X" } },
        { unparseableUrlLabel: "tweet" },
      ),
    ).toBe("tweet");
  });

  test("falls back to the hostname without www.", () => {
    expect(
      bookmarkSourceLabel(
        { url: "https://www.example.com/post" },
        { unparseableUrlLabel: "website" },
      ),
    ).toBe("example.com");
  });
});
