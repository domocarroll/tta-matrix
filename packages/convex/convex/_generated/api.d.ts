/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aggregations from "../aggregations.js";
import type * as cfBrowserScraper from "../cfBrowserScraper.js";
import type * as crons from "../crons.js";
import type * as extractions from "../extractions.js";
import type * as horses from "../horses.js";
import type * as http from "../http.js";
import type * as meetings from "../meetings.js";
import type * as predictions from "../predictions.js";
import type * as races from "../races.js";
import type * as scraping from "../scraping.js";
import type * as seed from "../seed.js";
import type * as tips from "../tips.js";
import type * as tipsters from "../tipsters.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aggregations: typeof aggregations;
  cfBrowserScraper: typeof cfBrowserScraper;
  crons: typeof crons;
  extractions: typeof extractions;
  horses: typeof horses;
  http: typeof http;
  meetings: typeof meetings;
  predictions: typeof predictions;
  races: typeof races;
  scraping: typeof scraping;
  seed: typeof seed;
  tips: typeof tips;
  tipsters: typeof tipsters;
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
