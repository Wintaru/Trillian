import type { Client } from "discord.js";
import type { EventHandler } from "../types/event.js";
import * as logger from "../utilities/logger.js";

const ready: EventHandler<"clientReady"> = {
  event: "clientReady",
  once: true,

  async execute(client: Client<true>): Promise<void> {
    logger.info(`Logged in as ${client.user.tag}`);
  },
};

export default ready;
