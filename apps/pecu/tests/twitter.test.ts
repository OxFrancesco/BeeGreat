import { expect, test } from "bun:test";
import type { JsonInput } from "../src/json-contract";
import { compactTwitter, twitterEndpointNames, twitterEndpoints, TwitterService, twitterTime } from "../src/integrations/twitter";

type Seen = { url: URL; init: RequestInit };

function service(body: JsonInput, status = 200) {
  const seen: Seen[] = [];
  const request: typeof fetch = Object.assign(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    seen.push({ url: new URL(String(url)), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }, { preconnect() {} });
  return { twitter: new TwitterService("test-key", request), seen };
}

const tweet = {
  type: "tweet", id: "2103492819109470349", url: "https://x.com/base/status/2103492819109470349", twitterUrl: "https://twitter.com/base/status/2103492819109470349",
  text: "Base Batches 004 is live", source: "Twitter for iPhone", retweetCount: 2, replyCount: 4, likeCount: 59, quoteCount: 0, viewCount: 3844, bookmarkCount: 0,
  createdAt: "Fri Sep 25 14:32:23 +0000 2026", lang: "en", isReply: true, inReplyToUsername: "aave", conversationId: "2103490003460313153",
  author: { type: "user", userName: "base", id: "1628067904083181570", name: "Base", followers: 1554632, following: 895, statusesCount: 8529, verifiedType: "Business", isBlueVerified: false, profilePicture: "https://pbs.twimg.com/x.jpg", createdAt: "Tue Feb 21 16:26:04 +0000 2023", description: "Where the world transacts onchain." },
  entities: { user_mentions: [{ screen_name: "aave" }], urls: [{ expanded_url: "https://base.org/batches" }], hashtags: [], symbols: [{ text: "AERO" }] },
  extendedEntities: {}, card: null, place: {}, quoted_tweet: null, retweeted_tweet: null,
};

test("the catalog covers every read endpoint and no writes", () => {
  expect(twitterEndpointNames.length).toBe(34);
  for (const entry of Object.values(twitterEndpoints)) {
    expect(entry.path).toMatch(/^\/(twitter|oapi\/my)\//);
    expect(entry.path).not.toMatch(/_v[23]$|login|create_|delete_|like_|follow_user|send_dm|upload|update_|monitor|tweet_filter|bookmark/);
  }
});

test("each endpoint sends its exact upstream parameter names", async () => {
  const cases: [keyof typeof twitterEndpoints, JsonInput, Record<string, string>][] = [
    ["user_info", { username: "@base" }, { userName: "base" }],
    ["user_verified_followers", { user_id: "1628067904083181570" }, { user_id: "1628067904083181570" }],
    ["user_articles", { username: "JessePollak" }, { username: "jessepollak" }],
    ["tweets", { tweet_ids: ["1", "2"] }, { tweet_ids: "1,2" }],
    ["tweet_replies_ranked", { tweet_id: "7", sort: "Likes" }, { tweetId: "7", queryType: "Likes" }],
    ["list_members", { list_id: "9" }, { list_id: "9" }],
    ["list_timeline", { list_id: "9" }, { listId: "9" }],
    ["follow_relationship", { source: "base", target: "jessepollak" }, { source_user_name: "base", target_user_name: "jessepollak" }],
    ["user_mentions", { username: "base", since: "2026-09-21", until: "2026-09-28" }, { userName: "base", sinceTime: String(Date.UTC(2026, 8, 21) / 1000), untilTime: String(Date.UTC(2026, 8, 28) / 1000) }],
  ];
  for (const [name, input, expected] of cases) {
    const { twitter, seen } = service({ status: "success", data: {} });
    await twitter.call(name, input);
    expect(Object.fromEntries(seen[0]!.url.searchParams)).toEqual(expected);
    expect(seen[0]!.url.pathname).toBe(twitterEndpoints[name].path);
    expect(new Headers(seen[0]!.init.headers).get("x-api-key")).toBe("test-key");
  }
});

test("search puts dates into since_time and until_time operators", async () => {
  const { twitter, seen } = service({ tweets: [], has_next_page: false, next_cursor: "" });
  await twitter.call("search", { query: "from:base", since: "2026-09-21", until: "2026-09-28T00:00:00Z", sort: "Top" });
  expect(seen[0]!.url.searchParams.get("query")).toBe(`from:base since_time:${Date.UTC(2026, 8, 21) / 1000} until_time:${Date.UTC(2026, 8, 28) / 1000}`);
  expect(seen[0]!.url.searchParams.get("queryType")).toBe("Top");
});

test("bulk search posts every query in one body", async () => {
  const { twitter, seen } = service({ results: {} });
  await twitter.call("search_many", { searches: [{ query: "$AERO", since: "2026-09-21" }, { query: "from:base" }] });
  expect(seen[0]!.init.method).toBe("POST");
  expect(JSON.parse(String(seen[0]!.init.body))).toEqual({ queries: [{ query: `$AERO since_time:${Date.UTC(2026, 8, 21) / 1000}`, queryType: "Latest" }, { query: "from:base", queryType: "Latest" }] });
});

test("responses keep text, author, time, links and engagement, not pictures or entities", async () => {
  const { twitter } = service({ tweets: [tweet], has_next_page: true, next_cursor: "abc" });
  const result = JSON.parse((await twitter.call("search", { query: "from:base" })).text);
  expect(result).toMatchObject({ source: "twitterapi.io", endpoint: "search", has_next_page: true, next_cursor: "abc" });
  expect(result.tweets[0]).toEqual({
    id: "2103492819109470349", url: "https://x.com/base/status/2103492819109470349",
    author: { id: "1628067904083181570", username: "base", name: "Base", followers: 1554632, following: 895, posts: 8529, verified: "Business", created_at: "2023-02-21T16:26:04.000Z", bio: "Where the world transacts onchain." },
    created_at: "2026-09-25T14:32:23.000Z", text: "Base Batches 004 is live", likes: 59, reposts: 2, replies: 4, quotes: 0, views: 3844, bookmarks: 0,
    lang: "en", reply_to: "aave", conversation_id: "2103490003460313153", mentions: ["aave"], links: ["https://base.org/batches"], cashtags: ["AERO"],
  });
  expect(JSON.stringify(result)).not.toContain("pbs.twimg.com");
});

test("large pages are cut from the end and marked", async () => {
  const { twitter } = service({ tweets: Array.from({ length: 80 }, (_, index) => ({ ...tweet, id: String(index), text: "x".repeat(1100) })), has_next_page: true, next_cursor: "n" });
  const output = (await twitter.call("search", { query: "base" })).text;
  const parsed = JSON.parse(output);
  expect(output.length).toBeLessThanOrEqual(28_000);
  expect(parsed.truncated).toBe(true);
  expect(parsed.tweets.length).toBeLessThan(80);
  expect(parsed.next_cursor).toBe("n");
});

test("errors become plain sentences", async () => {
  await expect(service({ detail: "tweetId is required" }, 400).twitter.call("tweet_quotes", { tweet_id: "1" })).rejects.toThrow("X data rejected the request: tweetId is required");
  await expect(service({}, 402).twitter.call("credits", {})).rejects.toThrow("credits are exhausted");
  await expect(service({ status: "error", msg: "user not found" }).twitter.call("user_info", { username: "nobody" })).rejects.toThrow("X data: user not found");
  await expect(new TwitterService(undefined).call("credits", {})).rejects.toThrow("not configured");
});

test("inputs are validated before any request", async () => {
  const { twitter, seen } = service({});
  await expect(twitter.call("user_info", { username: "not a handle" })).rejects.toThrow();
  await expect(twitter.call("user_last_tweets", {})).rejects.toThrow("exactly one of username or user_id");
  expect(seen).toHaveLength(0);
});

test("legacy X timestamps convert to ISO", () => {
  expect(twitterTime("Tue Feb 21 16:26:04 +0000 2023")).toBe("2023-02-21T16:26:04.000Z");
  expect(twitterTime("Sun Sep 27 08:00:00 +0200 2026")).toBe("2026-09-27T06:00:00.000Z");
  expect(twitterTime("2026-09-25T14:32:23.000000Z")).toBe("2026-09-25T14:32:23.000Z");
  expect(twitterTime("not a date")).toBeUndefined();
  expect(compactTwitter({ status: "success", msg: "success", data: { userName: "base", followers: 1 } })).toEqual({ data: { username: "base", followers: 1 } });
});
