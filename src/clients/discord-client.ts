import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandEngine } from "../engines/command-engine.js";
import type { EventHandler } from "../types/event.js";
import type { ButtonHandler, ModalHandler } from "../types/button-handler.js";
import * as logger from "../utilities/logger.js";

export class DiscordClient {
  private client: Client;

  constructor(
    private commandEngine: CommandEngine,
    events: EventHandler[],
    private prefix: string,
    private buttonHandlers: ButtonHandler[] = [],
    private modalHandlers: ModalHandler[] = [],
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
    this.registerSessionLogging();
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
      } else if (interaction.isButton()) {
        for (const handler of this.buttonHandlers) {
          if (handler.canHandle(interaction.customId)) {
            await handler.handleButton(interaction);
            break;
          }
        }
      } else if (interaction.isModalSubmit()) {
        for (const handler of this.modalHandlers) {
          if (handler.canHandle(interaction.customId)) {
            await handler.handleModal(interaction);
            break;
          }
        }
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.commandEngine.handlePrefixCommand(message, this.prefix);
    });
  }

  private registerSessionLogging(): void {
    // Log Discord WebSocket session lifecycle events. These are critical for
    // diagnosing orphan processes — if two PIDs both log "session opened"
    // before any "session closed", both are active and causing duplicate responses.
    this.client.once(Events.ClientReady, (client) => {
      logger.info(`Discord session opened — logged in as ${client.user.tag} (user ID: ${client.user.id})`);
    });

    this.client.on(Events.ShardDisconnect, (event, shardId) => {
      logger.warn(`Discord session closed — shard ${shardId} disconnected (code: ${event.code})`);
    });

    this.client.on(Events.ShardReconnecting, (shardId) => {
      logger.info(`Discord session reconnecting — shard ${shardId}`);
    });

    this.client.on(Events.ShardResume, (shardId, replayedEvents) => {
      logger.info(`Discord session resumed — shard ${shardId} (replayed ${replayedEvents} events)`);
    });

    this.client.on(Events.Invalidated, () => {
      logger.error("Discord session invalidated — token may be invalid or session limit hit");
    });
  }

  getClient(): Client {
    return this.client;
  }

  async start(token: string): Promise<void> {
    await this.client.login(token);
  }

  stop(): void {
    this.client.destroy();
  }
}
