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
import type * as firstFocus from "../firstFocus.js";
import type * as focusConstants from "../focusConstants.js";
import type * as focusDeletion from "../focusDeletion.js";
import type * as goals from "../goals.js";
import type * as helpers from "../helpers.js";
import type * as memories from "../memories.js";
import type * as memoryRelevance from "../memoryRelevance.js";
import type * as memoryValidators from "../memoryValidators.js";
import type * as posts from "../posts.js";
import type * as powerups from "../powerups.js";
import type * as projects from "../projects.js";
import type * as tasks from "../tasks.js";
import type * as user from "../user.js";
import type * as wallets from "../wallets.js";
import type * as webtree from "../webtree.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  firstFocus: typeof firstFocus;
  focusConstants: typeof focusConstants;
  focusDeletion: typeof focusDeletion;
  goals: typeof goals;
  helpers: typeof helpers;
  memories: typeof memories;
  memoryRelevance: typeof memoryRelevance;
  memoryValidators: typeof memoryValidators;
  posts: typeof posts;
  powerups: typeof powerups;
  projects: typeof projects;
  tasks: typeof tasks;
  user: typeof user;
  wallets: typeof wallets;
  webtree: typeof webtree;
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
