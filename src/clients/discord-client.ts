import { Client, GatewayIntentBits, Events } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandEngine } from "../engines/command-engine.js";
import type { EventHandler } from "../types/event.js";

export class DiscordClient {
  private client: Client;

  constructor(
    private commandEngine: CommandEngine,
    events: EventHandler[],
    private prefix: string,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.registerEvents(events);
    this.registerCommandHandlers();
  }

  private registerEvents(events: EventHandler[]): void {
    for (const handler of events) {
      if (handler.once) {
        this.client.once(handler.event, (...args) => handler.execute(...args));
      } else {
        this.client.on(handler.event, (...args) => handler.execute(...args));
      }
    }
  }

  private registerCommandHandlers(): void {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.commandEngine.handleSlashCommand(interaction as ChatInputCommandInteraction);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.commandEngine.handlePrefixCommand(message, this.prefix);
    });
  }

  async start(token: string): Promise<void> {
    await this.client.login(token);
  }
}
