import type { ButtonInteraction } from "discord.js";

export interface ButtonHandler {
  handleButton(interaction: ButtonInteraction): Promise<void>;
}
