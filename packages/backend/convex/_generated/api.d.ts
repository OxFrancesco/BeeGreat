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
import type * as agentJobDispatch from "../agentJobDispatch.js";
import type * as agentJobGrantValidators from "../agentJobGrantValidators.js";
import type * as agentJobGrants from "../agentJobGrants.js";
import type * as agentJobRuns from "../agentJobRuns.js";
import type * as agentJobValidators from "../agentJobValidators.js";
import type * as agentJobs from "../agentJobs.js";
import type * as agentMind from "../agentMind.js";
import type * as appleSignInRevocation from "../appleSignInRevocation.js";
import type * as beeSites from "../beeSites.js";
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
import type * as economyLib_achievements from "../economyLib/achievements.js";
import type * as economyLib_core from "../economyLib/core.js";
import type * as economyLib_fatigue from "../economyLib/fatigue.js";
import type * as economyLib_focusShield from "../economyLib/focusShield.js";
import type * as economyLib_goalLifecycle from "../economyLib/goalLifecycle.js";
import type * as economyLib_honeyLedger from "../economyLib/honeyLedger.js";
import type * as economyLib_summary from "../economyLib/summary.js";
import type * as economyLib_taskRewards from "../economyLib/taskRewards.js";
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
import type * as http_beeSites from "../http/beeSites.js";
import type * as http_beennectors from "../http/beennectors.js";
import type * as http_chatgpt from "../http/chatgpt.js";
import type * as http_devin from "../http/devin.js";
import type * as http_falMedia from "../http/falMedia.js";
import type * as http_focus from "../http/focus.js";
import type * as http_googleHealth from "../http/googleHealth.js";
import type * as http_imessage from "../http/imessage.js";
import type * as http_jobs from "../http/jobs.js";
import type * as http_middleware from "../http/middleware.js";
import type * as http_mind from "../http/mind.js";
import type * as http_subscription from "../http/subscription.js";
import type * as http_telegram from "../http/telegram.js";
import type * as http_web3 from "../http/web3.js";
import type * as http_webhooks from "../http/webhooks.js";
import type * as imessage from "../imessage.js";
import type * as imessageAddress from "../imessageAddress.js";
import type * as imessageAuth from "../imessageAuth.js";
import type * as imessageOutbox from "../imessageOutbox.js";
import type * as imessageValidators from "../imessageValidators.js";
import type * as journalEntries from "../journalEntries.js";
import type * as memories from "../memories.js";
import type * as memoryRelevance from "../memoryRelevance.js";
import type * as memoryValidators from "../memoryValidators.js";
import type * as nfcActionValidators from "../nfcActionValidators.js";
import type * as nfcActions from "../nfcActions.js";
import type * as posts from "../posts.js";
import type * as powerups from "../powerups.js";
import type * as projects from "../projects.js";
import type * as publicProfiles from "../publicProfiles.js";
import type * as recurrence from "../recurrence.js";
import type * as recurrenceValidators from "../recurrenceValidators.js";
import type * as revenueCatRest from "../revenueCatRest.js";
import type * as revenueCatWebhook from "../revenueCatWebhook.js";
import type * as scraper from "../scraper.js";
import type * as scraperEffect from "../scraperEffect.js";
import type * as scraperShared from "../scraperShared.js";
import type * as sentryNode from "../sentryNode.js";
import type * as socketSwap from "../socketSwap.js";
import type * as subscriptionReconciliation from "../subscriptionReconciliation.js";
import type * as subscriptions from "../subscriptions.js";
import type * as sugarPoolLocators from "../sugarPoolLocators.js";
import type * as sugarRuntime from "../sugarRuntime.js";
import type * as tasks from "../tasks.js";
import type * as telegram from "../telegram.js";
import type * as telegramAuthActions from "../telegramAuthActions.js";
import type * as telegramBot from "../telegramBot.js";
import type * as telegramCrypto from "../telegramCrypto.js";
import type * as telegramOAuth from "../telegramOAuth.js";
import type * as telegramValidators from "../telegramValidators.js";
import type * as user from "../user.js";
import type * as wallets from "../wallets.js";
import type * as web3 from "../web3.js";
import type * as web3ActionValidators from "../web3ActionValidators.js";
import type * as web3Actions from "../web3Actions.js";
import type * as web3Execution from "../web3Execution.js";
import type * as web3Notify from "../web3Notify.js";
import type * as web3Prefs from "../web3Prefs.js";
import type * as web3lib_actionLifecycle from "../web3lib/actionLifecycle.js";
import type * as web3lib_crossmintRecords from "../web3lib/crossmintRecords.js";
import type * as web3lib_crossmintWallet from "../web3lib/crossmintWallet.js";
import type * as web3lib_eoaTracking from "../web3lib/eoaTracking.js";
import type * as web3lib_executeConfirmed from "../web3lib/executeConfirmed.js";
import type * as web3lib_shared from "../web3lib/shared.js";
import type * as web3lib_socketOrchestration from "../web3lib/socketOrchestration.js";
import type * as web3lib_socketRefresh from "../web3lib/socketRefresh.js";
import type * as web3lib_sugarExecution from "../web3lib/sugarExecution.js";

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
  agentJobDispatch: typeof agentJobDispatch;
  agentJobGrantValidators: typeof agentJobGrantValidators;
  agentJobGrants: typeof agentJobGrants;
  agentJobRuns: typeof agentJobRuns;
  agentJobValidators: typeof agentJobValidators;
  agentJobs: typeof agentJobs;
  agentMind: typeof agentMind;
  appleSignInRevocation: typeof appleSignInRevocation;
  beeSites: typeof beeSites;
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
  "economyLib/achievements": typeof economyLib_achievements;
  "economyLib/core": typeof economyLib_core;
  "economyLib/fatigue": typeof economyLib_fatigue;
  "economyLib/focusShield": typeof economyLib_focusShield;
  "economyLib/goalLifecycle": typeof economyLib_goalLifecycle;
  "economyLib/honeyLedger": typeof economyLib_honeyLedger;
  "economyLib/summary": typeof economyLib_summary;
  "economyLib/taskRewards": typeof economyLib_taskRewards;
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
  "http/beeSites": typeof http_beeSites;
  "http/beennectors": typeof http_beennectors;
  "http/chatgpt": typeof http_chatgpt;
  "http/devin": typeof http_devin;
  "http/falMedia": typeof http_falMedia;
  "http/focus": typeof http_focus;
  "http/googleHealth": typeof http_googleHealth;
  "http/imessage": typeof http_imessage;
  "http/jobs": typeof http_jobs;
  "http/middleware": typeof http_middleware;
  "http/mind": typeof http_mind;
  "http/subscription": typeof http_subscription;
  "http/telegram": typeof http_telegram;
  "http/web3": typeof http_web3;
  "http/webhooks": typeof http_webhooks;
  imessage: typeof imessage;
  imessageAddress: typeof imessageAddress;
  imessageAuth: typeof imessageAuth;
  imessageOutbox: typeof imessageOutbox;
  imessageValidators: typeof imessageValidators;
  journalEntries: typeof journalEntries;
  memories: typeof memories;
  memoryRelevance: typeof memoryRelevance;
  memoryValidators: typeof memoryValidators;
  nfcActionValidators: typeof nfcActionValidators;
  nfcActions: typeof nfcActions;
  posts: typeof posts;
  powerups: typeof powerups;
  projects: typeof projects;
  publicProfiles: typeof publicProfiles;
  recurrence: typeof recurrence;
  recurrenceValidators: typeof recurrenceValidators;
  revenueCatRest: typeof revenueCatRest;
  revenueCatWebhook: typeof revenueCatWebhook;
  scraper: typeof scraper;
  scraperEffect: typeof scraperEffect;
  scraperShared: typeof scraperShared;
  sentryNode: typeof sentryNode;
  socketSwap: typeof socketSwap;
  subscriptionReconciliation: typeof subscriptionReconciliation;
  subscriptions: typeof subscriptions;
  sugarPoolLocators: typeof sugarPoolLocators;
  sugarRuntime: typeof sugarRuntime;
  tasks: typeof tasks;
  telegram: typeof telegram;
  telegramAuthActions: typeof telegramAuthActions;
  telegramBot: typeof telegramBot;
  telegramCrypto: typeof telegramCrypto;
  telegramOAuth: typeof telegramOAuth;
  telegramValidators: typeof telegramValidators;
  user: typeof user;
  wallets: typeof wallets;
  web3: typeof web3;
  web3ActionValidators: typeof web3ActionValidators;
  web3Actions: typeof web3Actions;
  web3Execution: typeof web3Execution;
  web3Notify: typeof web3Notify;
  web3Prefs: typeof web3Prefs;
  "web3lib/actionLifecycle": typeof web3lib_actionLifecycle;
  "web3lib/crossmintRecords": typeof web3lib_crossmintRecords;
  "web3lib/crossmintWallet": typeof web3lib_crossmintWallet;
  "web3lib/eoaTracking": typeof web3lib_eoaTracking;
  "web3lib/executeConfirmed": typeof web3lib_executeConfirmed;
  "web3lib/shared": typeof web3lib_shared;
  "web3lib/socketOrchestration": typeof web3lib_socketOrchestration;
  "web3lib/socketRefresh": typeof web3lib_socketRefresh;
  "web3lib/sugarExecution": typeof web3lib_sugarExecution;
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
