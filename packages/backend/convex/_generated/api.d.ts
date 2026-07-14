/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentFocus from "../agentFocus.js";
import type * as chat from "../chat.js";
import type * as chatgptAuth from "../chatgptAuth.js";
import type * as chatgptAuthActions from "../chatgptAuthActions.js";
import type * as chatgptAuthValidators from "../chatgptAuthValidators.js";
import type * as chatgptCrypto from "../chatgptCrypto.js";
import type * as chatgptOpenAi from "../chatgptOpenAi.js";
import type * as crons from "../crons.js";
import type * as economy from "../economy.js";
import type * as economyPolicy from "../economyPolicy.js";
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
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as memories from "../memories.js";
import type * as memoryRelevance from "../memoryRelevance.js";
import type * as memoryValidators from "../memoryValidators.js";
import type * as posts from "../posts.js";
import type * as powerups from "../powerups.js";
import type * as projects from "../projects.js";
import type * as recurrence from "../recurrence.js";
import type * as recurrenceValidators from "../recurrenceValidators.js";
import type * as sentryNode from "../sentryNode.js";
import type * as tasks from "../tasks.js";
import type * as user from "../user.js";
import type * as wallets from "../wallets.js";
import type * as web3 from "../web3.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentFocus: typeof agentFocus;
  chat: typeof chat;
  chatgptAuth: typeof chatgptAuth;
  chatgptAuthActions: typeof chatgptAuthActions;
  chatgptAuthValidators: typeof chatgptAuthValidators;
  chatgptCrypto: typeof chatgptCrypto;
  chatgptOpenAi: typeof chatgptOpenAi;
  crons: typeof crons;
  economy: typeof economy;
  economyPolicy: typeof economyPolicy;
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
  helpers: typeof helpers;
  http: typeof http;
  memories: typeof memories;
  memoryRelevance: typeof memoryRelevance;
  memoryValidators: typeof memoryValidators;
  posts: typeof posts;
  powerups: typeof powerups;
  projects: typeof projects;
  recurrence: typeof recurrence;
  recurrenceValidators: typeof recurrenceValidators;
  sentryNode: typeof sentryNode;
  tasks: typeof tasks;
  user: typeof user;
  wallets: typeof wallets;
  web3: typeof web3;
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
