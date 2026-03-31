import type { OllamaAccessor, OllamaChatMessage } from "../accessors/ollama-accessor.js";
import * as logger from "../utilities/logger.js";

const DISCORD_MAX_LENGTH = 2000;

const SYSTEM_PROMPT = `You are Trillian, a Discord chat bot. You're friendly, witty, and a little sassy — but never mean. You keep responses concise (1-3 sentences usually). You're helpful when asked questions but also enjoy playful banter. Your name is a nod to The Hitchhiker's Guide to the Galaxy, but you have your own personality — you rarely reference it directly.

IMPORTANT RULES:
- Never prefix your responses with your name or "Trillian:" — just respond naturally.
- Focus on what the user is CURRENTLY saying to you. Their message is your primary input.
- You may receive recent chat history as background context. Only reference it if it's directly relevant to what the user is asking right now. Do NOT continue or respond to earlier topics unless the user brings them up.`;

const FALLBACK_MESSAGE =
  "My circuits are a bit fuzzy right now. Try again in a moment!";

export interface ChannelMessage {
  authorName: string;
  authorIsBot: boolean;
  content: string;
}

export class ChatEngine {
  private readonly accessor: OllamaAccessor;

  constructor(accessor: OllamaAccessor) {
    this.accessor = accessor;
  }

  static stripMentions(text: string): string {
    return text.replace(/<@!?\d+>/g, "").trim();
  }

  static stripNamePrefix(text: string): string {
    return text.replace(/^(?:Trillian:\s*|"?Trillian"?:\s*)/i, "").trim();
  }

  async respond(
    userMessage: string,
    username: string,
    recentMessages: ChannelMessage[],
  ): Promise<string> {
    const cleaned = ChatEngine.stripMentions(userMessage);
    const prompt = cleaned || `${username} just said hi to me!`;

    // Build context summary as background info in the system prompt
    const contextLines: string[] = [];
    for (const msg of recentMessages) {
      const stripped = ChatEngine.stripMentions(msg.content);
      if (!stripped) continue;
      const name = msg.authorIsBot ? "Trillian (you)" : msg.authorName;
      contextLines.push(`${name}: ${stripped}`);
    }

    let systemPrompt = `${SYSTEM_PROMPT}\n\nYou are currently being addressed by "${username}". Respond directly to them.`;
    if (contextLines.length > 0) {
      systemPrompt += `\n\nRecent chat history with this user (for background only — respond to their current message, not to this history):\n${contextLines.join("\n")}`;
    }

    const messages: OllamaChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    try {
      const raw = await this.accessor.chat(messages);
      const response = ChatEngine.stripNamePrefix(raw);
      if (response.length > DISCORD_MAX_LENGTH) {
        return response.slice(0, DISCORD_MAX_LENGTH);
      }
      return response;
    } catch (error) {
      logger.error("Ollama chat failed:", error);
      return FALLBACK_MESSAGE;
    }
  }
}
