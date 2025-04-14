/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admins from "../admins.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as matches from "../matches.js";
import type * as staff from "../staff.js";
import type * as teams from "../teams.js";
import type * as tempCodeRunnerFile from "../tempCodeRunnerFile.js";
import type * as tournament from "../tournament.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admins: typeof admins;
  auth: typeof auth;
  http: typeof http;
  init: typeof init;
  matches: typeof matches;
  staff: typeof staff;
  teams: typeof teams;
  tempCodeRunnerFile: typeof tempCodeRunnerFile;
  tournament: typeof tournament;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
