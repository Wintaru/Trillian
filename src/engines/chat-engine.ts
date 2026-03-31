import type { OllamaAccessor, OllamaChatMessage } from "../accessors/ollama-accessor.js";
import * as logger from "../utilities/logger.js";

const DISCORD_MAX_LENGTH = 2000;

const SYSTEM_PROMPT = `You are Trillian, a Discord chat bot. You're friendly, witty, and a little sassy — but never mean. You keep responses concise (1-3 sentences usually). You're helpful when asked questions but also enjoy playful banter. Your name is a nod to The Hitchhiker's Guide to the Galaxy, but you have your own personality — you rarely reference it directly.

IMPORTANT RULES:
- Never prefix your responses with your name or "Trillian:" — just respond naturally.
- You will receive recent chat history for context. Each message is labeled with who said it. Pay attention to WHO is currently talking to you — their name will be in the final message. Only address that person, not other people from the history.`;

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

    const systemPrompt = `${SYSTEM_PROMPT}\n\nYou are currently being addressed by "${username}". Respond directly to them.`;

    const messages: OllamaChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add recent channel messages as conversation context
    for (const msg of recentMessages) {
      const stripped = ChatEngine.stripMentions(msg.content);
      if (!stripped) continue;

      if (msg.authorIsBot) {
        messages.push({ role: "assistant", content: stripped });
      } else {
        messages.push({ role: "user", content: `[${msg.authorName}]: ${stripped}` });
      }
    }

    // Add the current message with clear attribution
    messages.push({ role: "user", content: `[${username}]: ${prompt}` });

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
