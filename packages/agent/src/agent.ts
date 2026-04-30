// ──────────────────────────────────────────────────────
// TTA Matrix — TipBot Agent
// ──────────────────────────────────────────────────────
//
// The core agentic loop. Receives a message (from Matrix
// bot or direct invocation), runs the Anthropic API with
// tools, executes tool calls, and returns the final
// response.
//
// This is NOT a chatbot — it's an agent that can see
// images, query data, and take actions. The Matrix bot
// wraps this with message handling and image detection.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { TOOLS } from "./tools.ts";
import { ToolHandler } from "./tool-handler.ts";
import { TTAConvexClient } from "./convex-client.ts";
import type { Config } from "./config.ts";

const MAX_TOOL_ITERATIONS = 10;

export interface AgentMessage {
  readonly role: "user" | "assistant";
  readonly content: string | Anthropic.ContentBlockParam[];
}

export interface AgentResponse {
  readonly text: string;
  readonly toolsUsed: ReadonlyArray<string>;
  readonly tokenUsage: {
    readonly input: number;
    readonly output: number;
  };
}

export class TipBotAgent {
  private readonly anthropic: Anthropic;
  private readonly convex: TTAConvexClient;
  private readonly toolHandler: ToolHandler;
  private readonly model: string;

  constructor(config: Config, model?: string) {
    this.model = model ?? "claude-sonnet-4-6";
    this.anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    this.convex = new TTAConvexClient(config.CONVEX_URL);
    this.toolHandler = new ToolHandler(
      this.convex,
      this.anthropic,
      this.model,
    );
  }

  /**
   * Run the agent with a conversation and return the response.
   *
   * The agent loop:
   * 1. Send messages + tools to Claude
   * 2. If Claude calls tools, execute them and append results
   * 3. Repeat until Claude returns a text response (no tool calls)
   * 4. Return the final text
   */
  async run(messages: AgentMessage[]): Promise<AgentResponse> {
    const conversationMessages: Anthropic.MessageParam[] = messages.map(
      (m) => ({
        role: m.role,
        content: m.content as string | Anthropic.ContentBlockParam[],
      }),
    );

    const toolsUsed: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversationMessages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Check if response contains tool calls
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (toolUseBlocks.length === 0) {
        // No tool calls — extract final text
        const text = response.content
          .filter(
            (block): block is Anthropic.TextBlock => block.type === "text",
          )
          .map((block) => block.text)
          .join("");

        return {
          text,
          toolsUsed,
          tokenUsage: {
            input: totalInputTokens,
            output: totalOutputTokens,
          },
        };
      }

      // Execute tool calls
      conversationMessages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);
        const result = await this.toolHandler.execute(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      conversationMessages.push({
        role: "user",
        content: toolResults,
      });
    }

    // Safety: max iterations reached
    return {
      text: "I've reached the maximum number of tool calls for this request. Please try a more specific query.",
      toolsUsed,
      tokenUsage: {
        input: totalInputTokens,
        output: totalOutputTokens,
      },
    };
  }

  /**
   * Convenience: send a simple text message and get a response.
   */
  async chat(userMessage: string): Promise<AgentResponse> {
    return this.run([{ role: "user", content: userMessage }]);
  }

  /**
   * Convenience: process an image with an optional text prompt.
   */
  async processImage(
    imageBase64: string,
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
    prompt?: string,
  ): Promise<AgentResponse> {
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: imageBase64,
        },
      },
    ];

    if (prompt) {
      content.push({ type: "text", text: prompt });
    } else {
      content.push({
        type: "text",
        text: "Extract the tips from this image and persist them. Tell me what you found.",
      });
    }

    return this.run([{ role: "user", content }]);
  }
}
