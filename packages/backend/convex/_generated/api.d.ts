/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as accountDeletionActions from "../accountDeletionActions.js";
import type * as agent from "../agent.js";
import type * as agentFocus from "../agentFocus.js";
import type * as agentMind from "../agentMind.js";
import type * as appleSignInRevocation from "../appleSignInRevocation.js";
import type * as beennectorAuthActions from "../beennectorAuthActions.js";
import type * as beennectorCrypto from "../beennectorCrypto.js";
import type * as beennectorOAuth from "../beennectorOAuth.js";
import type * as beennectorOperations from "../beennectorOperations.js";
import type * as beennectorValidators from "../beennectorValidators.js";
import type * as beennectors from "../beennectors.js";
import type * as bookmarkCrawl from "../bookmarkCrawl.js";
import type * as bookmarkCrawlDomain from "../bookmarkCrawlDomain.js";
import type * as bookmarkCrawlValidators from "../bookmarkCrawlValidators.js";
import type * as bookmarkValidators from "../bookmarkValidators.js";
import type * as bookmarks from "../bookmarks.js";
import type * as channelActions from "../channelActions.js";
import type * as chat from "../chat.js";
import type * as chatgptAuth from "../chatgptAuth.js";
import type * as chatgptAuthActions from "../chatgptAuthActions.js";
import type * as chatgptAuthValidators from "../chatgptAuthValidators.js";
import type * as chatgptCrypto from "../chatgptCrypto.js";
import type * as chatgptOpenAi from "../chatgptOpenAi.js";
import type * as crons from "../crons.js";
import type * as devin from "../devin.js";
import type * as devinClient from "../devinClient.js";
import type * as devinData from "../devinData.js";
import type * as economy from "../economy.js";
import type * as economyPolicy from "../economyPolicy.js";
import type * as falMedia from "../falMedia.js";
import type * as falMediaClient from "../falMediaClient.js";
import type * as firstFocus from "../firstFocus.js";
import type * as focusConstants from "../focusConstants.js";
import type * as focusDeletion from "../focusDeletion.js";
import type * as goals from "../goals.js";
import type * as googleHealth from "../googleHealth.js";
import type * as googleHealthAuth from "../googleHealthAuth.js";
import type * as googleHealthAuthActions from "../googleHealthAuthActions.js";
import type * as googleHealthCrypto from "../googleHealthCrypto.js";
import type * as googleHealthOAuth from "../googleHealthOAuth.js";
import type * as googleHealthValidators from "../googleHealthValidators.js";
import type * as healthJournal from "../healthJournal.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as journalEntries from "../journalEntries.js";
import type * as memories from "../memories.js";
import type * as memoryRelevance from "../memoryRelevance.js";
import type * as memoryValidators from "../memoryValidators.js";
import type * as nfcActionValidators from "../nfcActionValidators.js";
import type * as nfcActions from "../nfcActions.js";
import type * as posts from "../posts.js";
import type * as powerups from "../powerups.js";
import type * as projects from "../projects.js";
import type * as recurrence from "../recurrence.js";
import type * as recurrenceValidators from "../recurrenceValidators.js";
import type * as revenueCatRest from "../revenueCatRest.js";
import type * as revenueCatWebhook from "../revenueCatWebhook.js";
import type * as scraper from "../scraper.js";
import type * as scraperEffect from "../scraperEffect.js";
import type * as scraperShared from "../scraperShared.js";
import type * as sentryNode from "../sentryNode.js";
import type * as subscriptionReconciliation from "../subscriptionReconciliation.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tasks from "../tasks.js";
import type * as user from "../user.js";
import type * as wallets from "../wallets.js";
import type * as web3 from "../web3.js";
import type * as web3Actions from "../web3Actions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  accountDeletionActions: typeof accountDeletionActions;
  agent: typeof agent;
  agentFocus: typeof agentFocus;
  agentMind: typeof agentMind;
  appleSignInRevocation: typeof appleSignInRevocation;
  beennectorAuthActions: typeof beennectorAuthActions;
  beennectorCrypto: typeof beennectorCrypto;
  beennectorOAuth: typeof beennectorOAuth;
  beennectorOperations: typeof beennectorOperations;
  beennectorValidators: typeof beennectorValidators;
  beennectors: typeof beennectors;
  bookmarkCrawl: typeof bookmarkCrawl;
  bookmarkCrawlDomain: typeof bookmarkCrawlDomain;
  bookmarkCrawlValidators: typeof bookmarkCrawlValidators;
  bookmarkValidators: typeof bookmarkValidators;
  bookmarks: typeof bookmarks;
  channelActions: typeof channelActions;
  chat: typeof chat;
  chatgptAuth: typeof chatgptAuth;
  chatgptAuthActions: typeof chatgptAuthActions;
  chatgptAuthValidators: typeof chatgptAuthValidators;
  chatgptCrypto: typeof chatgptCrypto;
  chatgptOpenAi: typeof chatgptOpenAi;
  crons: typeof crons;
  devin: typeof devin;
  devinClient: typeof devinClient;
  devinData: typeof devinData;
  economy: typeof economy;
  economyPolicy: typeof economyPolicy;
  falMedia: typeof falMedia;
  falMediaClient: typeof falMediaClient;
  firstFocus: typeof firstFocus;
  focusConstants: typeof focusConstants;
  focusDeletion: typeof focusDeletion;
  goals: typeof goals;
  googleHealth: typeof googleHealth;
  googleHealthAuth: typeof googleHealthAuth;
  googleHealthAuthActions: typeof googleHealthAuthActions;
  googleHealthCrypto: typeof googleHealthCrypto;
  googleHealthOAuth: typeof googleHealthOAuth;
  googleHealthValidators: typeof googleHealthValidators;
  healthJournal: typeof healthJournal;
  helpers: typeof helpers;
  http: typeof http;
  journalEntries: typeof journalEntries;
  memories: typeof memories;
  memoryRelevance: typeof memoryRelevance;
  memoryValidators: typeof memoryValidators;
  nfcActionValidators: typeof nfcActionValidators;
  nfcActions: typeof nfcActions;
  posts: typeof posts;
  powerups: typeof powerups;
  projects: typeof projects;
  recurrence: typeof recurrence;
  recurrenceValidators: typeof recurrenceValidators;
  revenueCatRest: typeof revenueCatRest;
  revenueCatWebhook: typeof revenueCatWebhook;
  scraper: typeof scraper;
  scraperEffect: typeof scraperEffect;
  scraperShared: typeof scraperShared;
  sentryNode: typeof sentryNode;
  subscriptionReconciliation: typeof subscriptionReconciliation;
  subscriptions: typeof subscriptions;
  tasks: typeof tasks;
  user: typeof user;
  wallets: typeof wallets;
  web3: typeof web3;
  web3Actions: typeof web3Actions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
