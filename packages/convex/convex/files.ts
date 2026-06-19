// Convex file storage helpers for persisted source images.
//
// Flow: the browser asks for an upload URL, POSTs the image bytes directly to
// Convex (bypassing our Worker — no body-size ceiling, no double transfer),
// and gets back a storageId that is then saved on the relevant row
// (extractions.imageStorageId / userFields.imageStorageIds). `getUrl` returns a
// signed download URL so the bytes can be re-fetched for cross-session
// re-extraction.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
