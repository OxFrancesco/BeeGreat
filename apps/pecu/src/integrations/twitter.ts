import { z } from "zod";
import { jsonObjectSchema, jsonValueSchema, type JsonInput, type JsonObject, type JsonValue } from "../json-contract";
import { log } from "../logger";

// twitterapi.io read endpoints. Parameter casing differs per endpoint upstream
// (userName, user_id, tweetId, tweet_ids, listId, list_id), so tools take one
// consistent snake_case shape and each entry maps it to the exact API names.
// Write endpoints, monitors and filter rules are deliberately absent.

const username = z.string().trim().regex(/^@?[A-Za-z0-9_]{1,15}$/, "Use an X username such as base, without spaces.").describe("X username, with or without @, for example base.");
/** Tool schemas cannot carry transforms (they become JSON Schema), so the @ comes off here. */
const handle = (value: string) => value.replace(/^@/, "");
const numericId = z.string().regex(/^\d{1,25}$/, "Use the numeric id.");
const userId = numericId.describe("Numeric X user id.");
const tweetId = numericId.describe("Numeric tweet id.");
const listId = numericId.describe("Numeric X list id.");
const communityId = numericId.describe("Numeric X community id.");
const cursor = z.string().max(4000).optional().describe("next_cursor from the previous page. Omit for the first page.");
const time = z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional();
const since = time.describe("Earliest time, ISO date (2026-09-21) or datetime with offset. Inclusive.");
const until = time.describe("Latest time, ISO date or datetime with offset. Exclusive.");
const searchQuery = z.string().trim().min(1).max(500).describe("X search query with operators: from:user, to:user, @mention, #tag, $CASHTAG, \"exact phrase\", OR, -exclude, min_faves:100, min_retweets:10, filter:links, -filter:replies, lang:en. Put dates in since and until, not in the query.");
const queryType = z.enum(["Latest", "Top"]).default("Latest").describe("Latest for chronological coverage, Top for the most engaged posts.");

function seconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const at = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(at)) throw new Error("Use an ISO date such as 2026-09-21.");
  return Math.floor(at / 1000);
}

function timedQuery(query: string, from?: string, to?: string): string {
  const start = seconds(from);
  const end = seconds(to);
  return [query, start === undefined ? "" : `since_time:${start}`, end === undefined ? "" : `until_time:${end}`].filter(Boolean).join(" ");
}

type Params = Record<string, string | number | boolean | undefined>;
type Request = Readonly<{ method: "GET"; params: Params } | { method: "POST"; body: JsonInput }>;

type TwitterEntry<S extends z.ZodType> = Readonly<{
  path: string;
  description: string;
  input: S;
  request(input: z.output<S>): Request;
}>;

const entry = <S extends z.ZodType>(definition: TwitterEntry<S>) => definition;
const get = (params: Params): Request => ({ method: "GET", params });

export const twitterEndpoints = {
  user_info: entry({
    path: "/twitter/user/info",
    description: "Profile of one X account: id, name, bio, followers, following, post count, verification and creation date.",
    input: z.strictObject({ username }),
    request: (input) => get({ userName: handle(input.username) }),
  }),
  user_about: entry({
    path: "/twitter/user_about",
    description: "Extended About panel of an X account: account location, username changes, verification history and affiliate details.",
    input: z.strictObject({ username }),
    request: (input) => get({ userName: handle(input.username) }),
  }),
  users_by_ids: entry({
    path: "/twitter/user/batch_info_by_ids",
    description: "Profiles for up to 100 numeric X user ids in one call.",
    input: z.strictObject({ user_ids: z.array(userId).min(1).max(100) }),
    request: (input) => get({ userIds: input.user_ids.join(",") }),
  }),
  user_search: entry({
    path: "/twitter/user/search",
    description: "Find X accounts by keyword, for example a protocol name, to learn its handle before reading its posts.",
    input: z.strictObject({ query: z.string().trim().min(1).max(100), cursor }),
    request: (input) => get({ query: input.query, cursor: input.cursor }),
  }),
  user_last_tweets: entry({
    path: "/twitter/user/last_tweets",
    description: "Latest posts of one account, newest first, 20 per page. Use search with from:username and since/until for a date window.",
    input: z.strictObject({ username: username.optional(), user_id: userId.optional(), include_replies: z.boolean().default(false), cursor }).refine((input) => (input.username === undefined) !== (input.user_id === undefined), "Give exactly one of username or user_id."),
    request: (input) => get({ userName: input.username && handle(input.username), userId: input.user_id, includeReplies: input.include_replies, cursor: input.cursor }),
  }),
  user_timeline: entry({
    path: "/twitter/user/tweet_timeline",
    description: "Profile timeline of a numeric user id in the same order as the X app, 20 per page, optionally with replies and their parent posts.",
    input: z.strictObject({ user_id: userId, include_replies: z.boolean().default(false), include_parent: z.boolean().default(false), cursor }),
    request: (input) => get({ userId: input.user_id, includeReplies: input.include_replies, includeParentTweet: input.include_parent, cursor: input.cursor }),
  }),
  user_articles: entry({
    path: "/twitter/user/articles",
    description: "Long-form X Articles published by an account.",
    input: z.strictObject({ username, cursor }),
    request: (input) => get({ username: handle(input.username).toLowerCase(), cursor: input.cursor }),
  }),
  user_mentions: entry({
    path: "/twitter/user/mentions",
    description: "Posts mentioning an account, newest first, 20 per page, optionally inside a time window.",
    input: z.strictObject({ username, since, until, cursor }),
    request: (input) => get({ userName: handle(input.username), sinceTime: seconds(input.since), untilTime: seconds(input.until), cursor: input.cursor }),
  }),
  user_followers: entry({
    path: "/twitter/user/followers",
    description: "Newest followers of an account with profiles, up to 200 per page.",
    input: z.strictObject({ username, page_size: z.number().int().min(20).max(200).default(50), cursor }),
    request: (input) => get({ userName: handle(input.username), pageSize: input.page_size, cursor: input.cursor }),
  }),
  user_follower_ids: entry({
    path: "/twitter/user/followers_ids",
    description: "Follower ids only, up to 5000 per page. Cheap for overlap checks; no profiles.",
    input: z.strictObject({ username: username.optional(), user_id: userId.optional(), count: z.number().int().min(50).max(5000).default(1000), cursor }).refine((input) => (input.username === undefined) !== (input.user_id === undefined), "Give exactly one of username or user_id."),
    request: (input) => get({ userName: input.username && handle(input.username), userId: input.user_id, count: input.count, cursor: input.cursor }),
  }),
  user_verified_followers: entry({
    path: "/twitter/user/verifiedFollowers",
    description: "Newest verified followers of a numeric user id, 20 per page.",
    input: z.strictObject({ user_id: userId, cursor }),
    request: (input) => get({ user_id: input.user_id, cursor: input.cursor }),
  }),
  user_followings: entry({
    path: "/twitter/user/followings",
    description: "Accounts that an account follows, newest first, up to 200 per page.",
    input: z.strictObject({ username, page_size: z.number().int().min(20).max(200).default(50), cursor }),
    request: (input) => get({ userName: handle(input.username), pageSize: input.page_size, cursor: input.cursor }),
  }),
  follow_relationship: entry({
    path: "/twitter/user/check_follow_relationship",
    description: "Whether one account follows another and whether it is followed back.",
    input: z.strictObject({ source: username, target: username }),
    request: (input) => get({ source_user_name: handle(input.source), target_user_name: handle(input.target) }),
  }),
  tweets: entry({
    path: "/twitter/tweets",
    description: "Full posts with engagement counts for up to 100 tweet ids.",
    input: z.strictObject({ tweet_ids: z.array(tweetId).min(1).max(100) }),
    request: (input) => get({ tweet_ids: input.tweet_ids.join(",") }),
  }),
  tweet_replies: entry({
    path: "/twitter/tweet/replies",
    description: "Replies to a post, newest first, optionally inside a time window.",
    input: z.strictObject({ tweet_id: tweetId, since, until, cursor }),
    request: (input) => get({ tweetId: input.tweet_id, sinceTime: seconds(input.since), untilTime: seconds(input.until), cursor: input.cursor }),
  }),
  tweet_replies_ranked: entry({
    path: "/twitter/tweet/replies/v2",
    description: "Replies to a post sorted by Relevance, Latest or Likes.",
    input: z.strictObject({ tweet_id: tweetId, sort: z.enum(["Relevance", "Latest", "Likes"]).default("Relevance"), cursor }),
    request: (input) => get({ tweetId: input.tweet_id, queryType: input.sort, cursor: input.cursor }),
  }),
  tweet_quotes: entry({
    path: "/twitter/tweet/quotes",
    description: "Quote posts of a post, newest first, optionally inside a time window.",
    input: z.strictObject({ tweet_id: tweetId, since, until, include_replies: z.boolean().default(true), cursor }),
    request: (input) => get({ tweetId: input.tweet_id, sinceTime: seconds(input.since), untilTime: seconds(input.until), includeReplies: input.include_replies, cursor: input.cursor }),
  }),
  tweet_retweeters: entry({
    path: "/twitter/tweet/retweeters",
    description: "Accounts that reposted a post, about 100 per page.",
    input: z.strictObject({ tweet_id: tweetId, cursor }),
    request: (input) => get({ tweetId: input.tweet_id, cursor: input.cursor }),
  }),
  tweet_thread: entry({
    path: "/twitter/tweet/thread_context",
    description: "The whole thread around a post: its parents and the replies under it.",
    input: z.strictObject({ tweet_id: tweetId, cursor }),
    request: (input) => get({ tweetId: input.tweet_id, cursor: input.cursor }),
  }),
  tweet_article: entry({
    path: "/twitter/article",
    description: "Full text of an X Article attached to a post.",
    input: z.strictObject({ tweet_id: tweetId }),
    request: (input) => get({ tweet_id: input.tweet_id }),
  }),
  search: entry({
    path: "/twitter/tweet/advanced_search",
    description: "Advanced X search, 20 posts per page. Combine operators in query and bound it with since and until, for example query from:base since 2026-09-21 until 2026-09-28.",
    input: z.strictObject({ query: searchQuery, since, until, sort: queryType, cursor }),
    request: (input) => get({ query: timedQuery(input.query, input.since, input.until), queryType: input.sort, cursor: input.cursor }),
  }),
  search_many: entry({
    path: "/twitter/tweet/bulk_advanced_search",
    description: "Run up to five advanced searches in parallel in one call. Each item takes the same fields as search.",
    input: z.strictObject({ searches: z.array(z.strictObject({ query: searchQuery, since, until, sort: queryType, cursor })).min(1).max(5) }),
    request: (input) => ({ method: "POST", body: { queries: input.searches.map((search) => ({ query: timedQuery(search.query, search.since, search.until), queryType: search.sort, cursor: search.cursor })) } }),
  }),
  trends: entry({
    path: "/twitter/trends",
    description: "Trending topics for a place by Yahoo WOEID: 1 worldwide, 23424977 United States, 23424975 United Kingdom.",
    input: z.strictObject({ woeid: z.number().int().positive().default(1), count: z.number().int().min(30).max(50).default(30) }),
    request: (input) => get({ woeid: input.woeid, count: input.count }),
  }),
  space: entry({
    path: "/twitter/spaces/detail",
    description: "Details of an X Space: title, state, hosts, speakers and listener counts.",
    input: z.strictObject({ space_id: z.string().regex(/^[A-Za-z0-9]{5,40}$/) }),
    request: (input) => get({ space_id: input.space_id }),
  }),
  list_tweets: entry({
    path: "/twitter/list/tweets",
    description: "Posts from the members of an X list, optionally inside a time window.",
    input: z.strictObject({ list_id: listId, since, until, include_replies: z.boolean().default(false), cursor }),
    request: (input) => get({ listId: input.list_id, sinceTime: seconds(input.since), untilTime: seconds(input.until), includeReplies: input.include_replies, cursor: input.cursor }),
  }),
  list_timeline: entry({
    path: "/twitter/list/tweets_timeline",
    description: "The timeline of an X list as the app shows it.",
    input: z.strictObject({ list_id: listId, cursor }),
    request: (input) => get({ listId: input.list_id, cursor: input.cursor }),
  }),
  list_members: entry({
    path: "/twitter/list/members",
    description: "Members of an X list, 20 per page.",
    input: z.strictObject({ list_id: listId, cursor }),
    request: (input) => get({ list_id: input.list_id, cursor: input.cursor }),
  }),
  list_followers: entry({
    path: "/twitter/list/followers",
    description: "Followers of an X list, 20 per page.",
    input: z.strictObject({ list_id: listId, cursor }),
    request: (input) => get({ list_id: input.list_id, cursor: input.cursor }),
  }),
  community_info: entry({
    path: "/twitter/community/info",
    description: "Details of an X Community: name, description, rules, member count and creator.",
    input: z.strictObject({ community_id: communityId }),
    request: (input) => get({ community_id: input.community_id }),
  }),
  community_members: entry({
    path: "/twitter/community/members",
    description: "Members of an X Community, 20 per page.",
    input: z.strictObject({ community_id: communityId, cursor }),
    request: (input) => get({ community_id: input.community_id, cursor: input.cursor }),
  }),
  community_moderators: entry({
    path: "/twitter/community/moderators",
    description: "Moderators of an X Community, 20 per page.",
    input: z.strictObject({ community_id: communityId, cursor }),
    request: (input) => get({ community_id: input.community_id, cursor: input.cursor }),
  }),
  community_tweets: entry({
    path: "/twitter/community/tweets",
    description: "Posts inside one X Community, newest first.",
    input: z.strictObject({ community_id: communityId, cursor }),
    request: (input) => get({ community_id: input.community_id, cursor: input.cursor }),
  }),
  community_search: entry({
    path: "/twitter/community/get_tweets_from_all_community",
    description: "Keyword search across posts in all X Communities.",
    input: z.strictObject({ query: z.string().trim().min(1).max(200), sort: queryType, cursor }),
    request: (input) => get({ query: input.query, queryType: input.sort, cursor: input.cursor }),
  }),
  credits: entry({
    path: "/oapi/my/info",
    description: "Remaining twitterapi.io credits on Pecu's key. 100,000 credits are $1.",
    input: z.strictObject({}),
    request: () => get({}),
  }),
} as const;

export type TwitterEndpointName = keyof typeof twitterEndpoints;
export function isTwitterEndpoint(name: string): name is TwitterEndpointName {
  return Object.hasOwn(twitterEndpoints, name);
}
export const twitterEndpointNames = Object.keys(twitterEndpoints).filter(isTwitterEndpoint);

const months = new Map(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((name, index) => [name, String(index + 1).padStart(2, "0")]));

/** X's legacy "Fri Sep 25 14:32:23 +0000 2026" timestamps as ISO 8601. Other formats pass through when they parse. */
export function twitterTime(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const legacy = /^\w{3} (\w{3}) (\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2}) (\d{4})$/.exec(value);
  const month = legacy ? months.get(legacy[1]!) : undefined;
  const iso = legacy && month ? `${legacy[6]}-${month}-${legacy[2]}T${legacy[3]}${legacy[4]}:${legacy[5]}` : value;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? new Date(at).toISOString() : undefined;
}

// The fields research reads from twitterapi.io users and tweets. Every field
// falls back to undefined instead of failing, since the provider mixes
// camelCase and legacy snake_case objects.
const maybe = <S extends z.ZodType>(schema: S) => schema.optional().catch(undefined);
const count = maybe(z.number().finite());
const words = maybe(z.string());
const userSchema = z.object({
  id: words, id_str: words, userName: words, screen_name: words, name: words,
  followers: count, followers_count: count, following: count, friends_count: count, statusesCount: count, statuses_count: count,
  verifiedType: words, isBlueVerified: maybe(z.boolean()), createdAt: words, created_at: words, description: words, location: words,
}).refine((value) => (value.userName ?? value.screen_name) !== undefined && (value.followers ?? value.followers_count) !== undefined);
type RawUser = z.infer<typeof userSchema>;
const names = (key: string) => maybe(z.array(z.object({ [key]: z.string() }).transform((item) => item[key]!)));
const entitiesSchema = z.object({ user_mentions: names("screen_name"), urls: names("expanded_url"), hashtags: names("text"), symbols: names("text") }).catch({});
type RawTweet = Readonly<{
  type?: string; id: string; url?: string; text: string; author?: RawUser; createdAt?: string; lang?: string;
  likeCount?: number; retweetCount?: number; replyCount?: number; quoteCount?: number; viewCount?: number; bookmarkCount?: number;
  isReply?: boolean; inReplyToUsername?: string; conversationId?: string;
  entities: z.infer<typeof entitiesSchema>; quoted_tweet?: RawTweet; retweeted_tweet?: RawTweet;
}>;
const tweetSchema: z.ZodType<RawTweet> = z.lazy(() => z.object({
  type: words, id: z.string(), url: words, text: z.string(), author: maybe(userSchema), createdAt: words, lang: words,
  likeCount: count, retweetCount: count, replyCount: count, quoteCount: count, viewCount: count, bookmarkCount: count,
  isReply: maybe(z.boolean()), inReplyToUsername: words, conversationId: words,
  entities: entitiesSchema, quoted_tweet: maybe(tweetSchema), retweeted_tweet: maybe(tweetSchema),
}).refine((value) => value.type === "tweet" || value.author !== undefined));
const listSchema = z.array(jsonValueSchema);

const clip = (value: string | undefined, limit: number) => value !== undefined && value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

function strip(value: Readonly<Record<string, JsonValue | undefined>>): JsonObject {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => item === undefined || item === null || item === "" || (Array.isArray(item) && !item.length) ? [] : [[key, item]]));
}

function user(value: RawUser): JsonObject {
  return strip({
    id: value.id ?? value.id_str,
    username: value.userName ?? value.screen_name,
    name: value.name,
    followers: value.followers ?? value.followers_count,
    following: value.following ?? value.friends_count,
    posts: value.statusesCount ?? value.statuses_count,
    verified: value.verifiedType || (value.isBlueVerified ? "Blue" : undefined),
    created_at: twitterTime(value.createdAt ?? value.created_at),
    bio: clip(value.description, 240),
    location: clip(value.location, 80),
  });
}

function tweet(value: RawTweet, depth: number): JsonObject {
  return strip({
    id: value.id,
    url: value.url,
    author: value.author && user(value.author),
    created_at: twitterTime(value.createdAt),
    text: clip(value.text, 1200),
    likes: value.likeCount,
    reposts: value.retweetCount,
    replies: value.replyCount,
    quotes: value.quoteCount,
    views: value.viewCount,
    bookmarks: value.bookmarkCount,
    lang: value.lang,
    reply_to: value.isReply ? value.inReplyToUsername ?? true : undefined,
    conversation_id: value.conversationId !== value.id ? value.conversationId : undefined,
    mentions: value.entities.user_mentions,
    links: value.entities.urls,
    hashtags: value.entities.hashtags,
    cashtags: value.entities.symbols,
    quoted: value.quoted_tweet && depth < 1 ? tweet(value.quoted_tweet, depth + 1) : undefined,
    reposted: value.retweeted_tweet && depth < 1 ? tweet(value.retweeted_tweet, depth + 1) : undefined,
  });
}

const noise = new Set(["profilePicture", "coverPicture", "profile_image_url_https", "profile_banner_url", "twitterUrl", "extendedEntities", "card", "place", "affiliatesHighlightedLabel", "withheldInCountries", "profile_bio", "entities", "status", "msg", "code", "message", "displayTextRange", "source"]);

/** Keeps what research needs from a twitterapi.io response: post text, author, time, links and engagement. */
export function compactTwitter(value: JsonValue, depth = 0): JsonValue {
  const post = tweetSchema.safeParse(value);
  if (post.success) return tweet(post.data, 0);
  const person = userSchema.safeParse(value);
  if (person.success) return user(person.data);
  const list = listSchema.safeParse(value);
  if (list.success) return list.data.map((item) => compactTwitter(item, depth));
  const record = jsonObjectSchema.safeParse(value);
  if (record.success) return depth > 6 ? null : strip(Object.fromEntries(Object.entries(record.data).flatMap(([key, item]) => noise.has(key) ? [] : [[key, compactTwitter(item, depth + 1)]])));
  const sentence = z.string().safeParse(value);
  return sentence.success ? clip(sentence.data, 1500) ?? "" : value;
}

/** Largest tool output the model receives. Lists are cut from the end and marked. */
const maxOutputBytes = 28_000;

function bounded(payload: JsonObject): string {
  let output = JSON.stringify(payload);
  if (output.length <= maxOutputBytes) return output;
  const lists = Object.entries(payload).flatMap(([key, value]) => {
    const items = listSchema.safeParse(value);
    return items.success ? [{ key, items: items.data, size: JSON.stringify(value).length }] : [];
  }).sort((a, b) => b.size - a.size);
  const copy = { ...payload };
  for (const { key, items: all } of lists) {
    const items = [...all];
    while (items.length > 1 && JSON.stringify({ ...copy, [key]: items }).length > maxOutputBytes) items.pop();
    copy[key] = items;
    copy.truncated = true;
    output = JSON.stringify(copy);
    if (output.length <= maxOutputBytes) return output;
  }
  return output.slice(0, maxOutputBytes);
}

const errorSchema = z.object({ detail: maybe(z.string()), msg: words, message: words });
const refusalSchema = z.object({ status: z.literal("error"), msg: words, message: words });

function failure(status: number, body: string): string {
  const parsed = (() => { try { return errorSchema.safeParse(JSON.parse(body)).data; } catch { return undefined; } })();
  const detail = parsed?.detail ?? parsed?.msg ?? parsed?.message;
  if (status === 401 || status === 403) return "X data is not available right now (access).";
  if (status === 402) return "X data credits are exhausted. The Pecu administrator needs to top up twitterapi.io.";
  if (status === 429) return "X data is busy. Try again in a minute.";
  if (status === 400 || status === 404 || status === 422) return `X data rejected the request: ${(detail ?? "invalid request").slice(0, 200)}`;
  return `X data is unavailable right now (${status}).`;
}

export type TwitterResult = Readonly<{ endpoint: TwitterEndpointName; text: string; data: JsonValue }>;

export class TwitterService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly request: typeof fetch = fetch,
    private readonly apiUrl = "https://api.twitterapi.io",
  ) {}

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async call(name: TwitterEndpointName, rawInput: JsonInput): Promise<TwitterResult> {
    if (!this.apiKey) throw new Error("X data is not configured yet.");
    const spec: TwitterEntry<z.ZodType> = twitterEndpoints[name];
    const request = spec.request(spec.input.parse(rawInput ?? {}));
    const url = new URL(spec.path, this.apiUrl);
    if (request.method === "GET") {
      for (const [key, value] of Object.entries(request.params)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const headers = new Headers({ "x-api-key": this.apiKey });
    if (request.method === "POST") headers.set("content-type", "application/json");
    const response = await this.request.call(globalThis, url, {
      method: request.method,
      headers,
      body: request.method === "POST" ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    log("info", "twitter_call", { endpoint: name, status: response.status });
    if (!response.ok) throw new Error(failure(response.status, body));
    let data: JsonValue;
    try { data = jsonValueSchema.parse(JSON.parse(body)); }
    catch { throw new Error("X data returned an unreadable response."); }
    const refusal = refusalSchema.safeParse(data);
    if (refusal.success) throw new Error(`X data: ${(refusal.data.msg ?? refusal.data.message ?? "request failed").slice(0, 200)}`);
    const compact = compactTwitter(data);
    const record = jsonObjectSchema.safeParse(compact);
    const payload = { source: "twitterapi.io", endpoint: name, retrieved_at: new Date().toISOString(), ...(record.success ? record.data : { data: compact }) };
    return { endpoint: name, text: bounded(payload), data };
  }
}
