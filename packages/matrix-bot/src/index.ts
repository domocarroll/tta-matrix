// ──────────────────────────────────────────────────────
// TTA Matrix — Matrix Bot
// ──────────────────────────────────────────────────────
//
// Bridges the Matrix channel to the TipBot agent.
// Handles message events, image detection, command parsing,
// and response formatting.
//
// Bot commands:
// !tip <image>       → Extract tips from attached image
// !race <N>          → Show race aggregation
// !tipster <name>    → Show tipster stats
// !predict <horse>   → Make a prediction
// !leaderboard       → Top punters/tipsters
// !results           → Latest race results
// !quaddie           → Optimal quaddie combinations
// !help              → Command list

import {
  MatrixClient,
  SimpleFsStorageProvider,
  AutojoinRoomsMixin,
  RichConsoleLogger,
} from "matrix-bot-sdk";
import { TipBotAgent, loadConfig } from "@tta/agent";

const COMMAND_PREFIX = "!";

interface BotConfig {
  homeserverUrl: string;
  accessToken: string;
  dataPath: string;
}

function loadBotConfig(): BotConfig {
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const accessToken = process.env.MATRIX_ACCESS_TOKEN;

  if (!homeserverUrl || !accessToken) {
    throw new Error(
      "MATRIX_HOMESERVER_URL and MATRIX_ACCESS_TOKEN required",
    );
  }

  return {
    homeserverUrl,
    accessToken,
    dataPath: process.env.BOT_DATA_PATH ?? "./bot-data",
  };
}

async function main() {
  const botConfig = loadBotConfig();
  const agentConfig = loadConfig();
  const agent = new TipBotAgent(agentConfig);

  LogService.setLogger(new RichConsoleLogger());

  const storage = new SimpleFsStorageProvider(
    `${botConfig.dataPath}/bot.json`,
  );

  const client = new MatrixClient(
    botConfig.homeserverUrl,
    botConfig.accessToken,
    storage,
  );

  AutojoinRoomsMixin.setupOnClient(client);

  client.on("room.message", async (roomId: string, event: any) => {
    if (event.sender === (await client.getUserId())) return;
    if (!event.content) return;

    const msgtype = event.content.msgtype;
    const body: string = event.content.body ?? "";

    try {
      // Handle image messages (auto-extract)
      if (msgtype === "m.image") {
        const mxcUrl = event.content.url;
        if (!mxcUrl) return;

        const imageBuffer = await client.downloadContent(mxcUrl);
        const base64 = Buffer.from(imageBuffer.data).toString("base64");
        const mediaType = event.content.info?.mimetype ?? "image/jpeg";

        await client.sendText(roomId, "Processing tip sheet...");

        const response = await agent.processImage(
          base64,
          mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/gif",
          body || undefined,
        );

        await client.sendText(roomId, response.text);
        return;
      }

      // Handle text commands
      if (msgtype !== "m.text" || !body.startsWith(COMMAND_PREFIX)) return;

      const [command, ...args] = body.slice(1).split(" ");
      const argString = args.join(" ");

      let response;

      switch (command?.toLowerCase()) {
        case "tip":
          response = await agent.chat(
            `The user wants to see tips. ${argString ? `Context: ${argString}` : "Show today's tip summary."}`,
          );
          break;

        case "race":
          response = await agent.chat(
            `Show me the aggregation and consensus picks for race ${argString || "next race"}`,
          );
          break;

        case "tipster":
          response = await agent.chat(
            `Look up tipster "${argString}" — show their stats and recent form`,
          );
          break;

        case "predict":
          response = await agent.chat(
            `User ${event.sender} wants to predict: ${argString}`,
          );
          break;

        case "leaderboard":
          response = await agent.chat(
            `Show the ${argString || "tipster"} leaderboard`,
          );
          break;

        case "results":
          response = await agent.chat(
            `Show the latest race results${argString ? ` for ${argString}` : ""}`,
          );
          break;

        case "quaddie":
          response = await agent.chat(
            `Calculate the optimal quaddie for ${argString || "today's main meeting"}`,
          );
          break;

        case "help":
          await client.sendText(
            roomId,
            [
              "TipBot Commands:",
              "  !tip <image>          — Extract tips from attached image",
              "  !race <N>             — Show race aggregation",
              "  !tipster <name>       — Tipster stats & history",
              "  !predict <horse> <$>  — Make a prediction",
              "  !leaderboard          — Top performers",
              "  !results              — Latest race results",
              "  !quaddie              — Optimal quaddie combos",
              "  !help                 — This message",
              "",
              "Or just drop a tip sheet image — I'll auto-extract!",
            ].join("\n"),
          );
          return;

        default:
          return; // Ignore unknown commands
      }

      if (response) {
        await client.sendText(roomId, response.text);
      }
    } catch (err) {
      console.error("Error handling message:", err);
      await client.sendText(
        roomId,
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  });

  await client.start();
  console.log("TipBot Matrix bot started");
}

// Import LogService separately to handle the module structure
import { LogService } from "matrix-bot-sdk";

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
