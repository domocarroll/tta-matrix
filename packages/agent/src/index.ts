// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Entry Point
// ──────────────────────────────────────────────────────
//
// When run directly, starts a simple REPL for testing.
// In production, the agent is imported by the Matrix bot.

import { loadConfig } from "./config.ts";
import { TipBotAgent } from "./agent.ts";
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";

export { TipBotAgent } from "./agent.ts";
export { TTAConvexClient } from "./convex-client.ts";
export { extractTipsFromImage } from "./extract.ts";
export type { AgentMessage, AgentResponse } from "./agent.ts";
export type { Config } from "./config.ts";
export { loadConfig } from "./config.ts";

async function main() {
  const config = loadConfig();
  const agent = new TipBotAgent(config);

  console.log("TipBot Agent started. Type a message or drag an image path.");
  console.log("Commands: /quit, /image <path>");
  console.log("─".repeat(50));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "you> ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/quit") {
      rl.close();
      process.exit(0);
    }

    try {
      let response;

      if (input.startsWith("/image ")) {
        const imagePath = input.slice(7).trim();
        const resolved = path.resolve(imagePath);
        const imageBuffer = fs.readFileSync(resolved);
        const base64 = imageBuffer.toString("base64");
        const ext = path.extname(resolved).toLowerCase();
        const mediaType =
          ext === ".png"
            ? "image/png"
            : ext === ".webp"
              ? "image/webp"
              : "image/jpeg";

        console.log(`Processing image: ${resolved}`);
        response = await agent.processImage(
          base64,
          mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        );
      } else {
        response = await agent.chat(input);
      }

      console.log(`\nbot> ${response.text}`);
      if (response.toolsUsed.length > 0) {
        console.log(
          `  [tools: ${response.toolsUsed.join(", ")} | tokens: ${response.tokenUsage.input}in/${response.tokenUsage.output}out]`,
        );
      }
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
    }

    rl.prompt();
  });
}

// Run if executed directly
const isDirectExecution =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");

if (isDirectExecution) {
  main().catch(console.error);
}
