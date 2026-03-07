import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";

export interface ButtonHandler {
  canHandle(customId: string): boolean;
  handleButton(interaction: ButtonInteraction): Promise<void>;
}

export interface ModalHandler {
  canHandle(customId: string): boolean;
  handleModal(interaction: ModalSubmitInteraction): Promise<void>;
}
