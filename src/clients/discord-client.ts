import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandEngine } from "../engines/command-engine.js";
import type { EventHandler } from "../types/event.js";
import type { ButtonHandler } from "../types/button-handler.js";

export class DiscordClient {
  private client: Client;

  constructor(
    private commandEngine: CommandEngine,
    events: EventHandler[],
    private prefix: string,
    private buttonHandler?: ButtonHandler,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.registerEvents(events);
    this.registerInteractionHandlers();
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

  private registerInteractionHandlers(): void {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.commandEngine.handleSlashCommand(interaction as ChatInputCommandInteraction);
      } else if (interaction.isButton() && this.buttonHandler) {
        await this.buttonHandler.handleButton(interaction);
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.commandEngine.handlePrefixCommand(message, this.prefix);
    });
  }

  getClient(): Client {
    return this.client;
  }

  async start(token: string): Promise<void> {
    await this.client.login(token);
  }
}
