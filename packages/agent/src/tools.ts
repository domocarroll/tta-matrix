// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Tool Definitions
// ──────────────────────────────────────────────────────
//
// Each tool maps to a Convex operation. The agent
// uses these tools to interact with the data layer.
// Tools are defined as Anthropic API tool schemas.

import type Anthropic from "@anthropic-ai/sdk";

/** All tools available to the TipBot agent */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "extract_tips",
    description:
      "Extract horse racing tips from a tip sheet image. The image should contain tipster selections for one or more races. Returns structured tip data.",
    input_schema: {
      type: "object" as const,
      properties: {
        image_base64: {
          type: "string",
          description: "Base64-encoded image data",
        },
        media_type: {
          type: "string",
          enum: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          description: "MIME type of the image",
        },
        category: {
          type: "string",
          enum: ["SR", "MR", "BR", "PR", "AR", "OR"],
          description:
            "Racing category: SR=Sydney, MR=Melbourne, BR=Brisbane, PR=Perth, AR=Adelaide, OR=Other",
        },
        meeting_name: {
          type: "string",
          description: "Name of the meeting (e.g. Randwick, Flemington)",
        },
      },
      required: ["image_base64", "media_type", "category", "meeting_name"],
    },
  },
  {
    name: "query_race",
    description:
      "Look up race data including horses, tips, and aggregation for a specific race. Returns race details, field, current tips, and consensus picks.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Race date in YYYY-MM-DD format",
        },
        meeting_name: {
          type: "string",
          description: "Meeting name (e.g. Randwick)",
        },
        race_number: {
          type: "number",
          description: "Race number (1-10)",
        },
      },
      required: ["date", "meeting_name", "race_number"],
    },
  },
  {
    name: "query_tipster",
    description:
      "Look up a tipster's profile, historical stats, and recent tips. Shows strike rate, ROI, and recent form.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Tipster name to look up",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "make_prediction",
    description:
      "Record a prediction (bet) on a horse in a specific race. Uses play money. Records the selection, stake, and current odds.",
    input_schema: {
      type: "object" as const,
      properties: {
        race_id: {
          type: "string",
          description: "Convex race ID",
        },
        user_id: {
          type: "string",
          description: "Matrix user ID of the punter",
        },
        horse_name: {
          type: "string",
          description: "Name of the horse to back",
        },
        horse_number: {
          type: "number",
          description: "TAB number of the horse (optional)",
        },
        bet_type: {
          type: "string",
          enum: ["win", "place", "each-way"],
          description: "Type of bet",
        },
        stake: {
          type: "number",
          description: "Amount to stake (play money units)",
        },
      },
      required: ["race_id", "user_id", "horse_name", "bet_type", "stake"],
    },
  },
  {
    name: "get_leaderboard",
    description:
      "Get tipster or punter leaderboard rankings. Shows top performers by strike rate, ROI, or total wins.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["tipsters", "punters"],
          description: "Leaderboard type: tipsters (by tip accuracy) or punters (by prediction P&L)",
        },
        sort_by: {
          type: "string",
          enum: ["strikeRate", "roi", "wins"],
          description: "Sort metric (default: strikeRate for tipsters, roi for punters)",
        },
        limit: {
          type: "number",
          description: "Number of entries to return (default: 10)",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "get_aggregation",
    description:
      "Get the aggregated tip consensus for a race. Shows which horses have the most support, win picks, place picks, and tipster agreement percentage.",
    input_schema: {
      type: "object" as const,
      properties: {
        race_id: {
          type: "string",
          description: "Convex race ID",
        },
      },
      required: ["race_id"],
    },
  },
  {
    name: "record_result",
    description:
      "Record race results. Automatically settles all open predictions and updates tipster stats. Typically called by the scraper, but can be used manually.",
    input_schema: {
      type: "object" as const,
      properties: {
        race_id: {
          type: "string",
          description: "Convex race ID",
        },
        result: {
          type: "array",
          items: {
            type: "object",
            properties: {
              position: { type: "number", description: "Finishing position (1=winner)" },
              horse_name: { type: "string", description: "Horse name" },
              horse_number: { type: "number", description: "TAB number" },
            },
            required: ["position", "horse_name", "horse_number"],
          },
          description: "Race result (at least 1st, 2nd, 3rd)",
        },
      },
      required: ["race_id", "result"],
    },
  },
  {
    name: "get_todays_meetings",
    description:
      "Get all race meetings for today (or a specific date). Shows meeting name, category, status, and race count.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (defaults to today)",
        },
      },
      required: [],
    },
  },
  {
    name: "calculate_quaddie",
    description:
      "Calculate optimal quaddie combinations for a meeting. Returns top 3 horses for each of the last 4 races.",
    input_schema: {
      type: "object" as const,
      properties: {
        meeting_id: {
          type: "string",
          description: "Convex meeting ID",
        },
      },
      required: ["meeting_id"],
    },
  },
];
