import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { ButtonHandler, ModalHandler } from "../types/button-handler.js";
import type { LibraryEngine } from "./library-engine.js";

export class LibraryButtonHandler implements ButtonHandler, ModalHandler {
  constructor(private readonly engine: LibraryEngine) {}

  canHandle(customId: string): boolean {
    return customId.startsWith("library_");
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [action, ...params] = interaction.customId.split(":");

    switch (action) {
      case "library_approve":
        await this.handleApprove(interaction, parseInt(params[0]!, 10));
        break;
      case "library_deny":
        await this.handleDeny(interaction, parseInt(params[0]!, 10));
        break;
      case "library_return":
        await this.handleReturn(interaction, parseInt(params[0]!, 10));
        break;
      case "library_borrow":
        await this.handleBorrow(interaction, parseInt(params[0]!, 10));
        break;
      case "library_editnote":
        await this.showEditNoteModal(interaction, parseInt(params[0]!, 10));
        break;
    }
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const [action, ...params] = interaction.customId.split(":");

    if (action === "library_note") {
      await this.handleNoteSubmit(interaction, parseInt(params[0]!, 10));
    }
  }

  private async handleApprove(interaction: ButtonInteraction, borrowId: number): Promise<void> {
    await interaction.deferUpdate();

    const result = await this.engine.approveBorrow({
      borrowId,
      ownerId: interaction.user.id,
      approve: true,
      dueDate: null,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: "This borrow request no longer exists.",
        not_owner: "Only the book owner can approve this.",
        not_pending: "This request has already been handled.",
      };
      await interaction.editReply({ content: messages[result.reason] ?? "Something went wrong.", components: [] });
      return;
    }

    const dueDateStr = result.dueDate
      ? ` Due back: <t:${Math.floor(result.dueDate / 1000)}:D>`
      : "";
    await interaction.editReply({
      content: `Approved! <@${result.borrowerId}> can now pick up **${result.title}**.${dueDateStr}`,
      components: [],
    });

    // DM the borrower
    try {
      const borrower = await interaction.client.users.fetch(result.borrowerId!);
      await borrower.send(
        `Your borrow request for **${result.title}** was approved by <@${interaction.user.id}>!${dueDateStr}`,
      );
    } catch {
      // DMs disabled
    }
  }

  private async handleDeny(interaction: ButtonInteraction, borrowId: number): Promise<void> {
    await interaction.deferUpdate();

    const result = await this.engine.approveBorrow({
      borrowId,
      ownerId: interaction.user.id,
      approve: false,
      dueDate: null,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: "This borrow request no longer exists.",
        not_owner: "Only the book owner can deny this.",
        not_pending: "This request has already been handled.",
      };
      await interaction.editReply({ content: messages[result.reason] ?? "Something went wrong.", components: [] });
      return;
    }

    await interaction.editReply({
      content: `Denied the borrow request for **${result.title}**.`,
      components: [],
    });

    // DM the borrower
    try {
      const borrower = await interaction.client.users.fetch(result.borrowerId!);
      await borrower.send(
        `Your borrow request for **${result.title}** was declined by <@${interaction.user.id}>.`,
      );
    } catch {
      // DMs disabled
    }
  }

  private async handleReturn(interaction: ButtonInteraction, borrowId: number): Promise<void> {
    await interaction.deferUpdate();

    const result = await this.engine.returnBook({
      borrowId,
      userId: interaction.user.id,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: "This borrow record no longer exists.",
        not_active: "This book is not currently checked out.",
        not_authorized: "Only the borrower or owner can mark this as returned.",
      };
      await interaction.followUp({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
      return;
    }

    if (result.reason === "given_away") {
      await interaction.followUp({
        content: `**${result.title}** has been given away and removed from the library. Enjoy the book!`,
        flags: 64,
      });
    } else {
      await interaction.followUp({
        content: `**${result.title}** has been returned and is now available again.`,
        flags: 64,
      });
    }

    // Notify the other party
    const notifyUserId = interaction.user.id === result.borrowerId
      ? result.ownerId!
      : result.borrowerId!;
    try {
      const notifyUser = await interaction.client.users.fetch(notifyUserId);
      const verb = result.reason === "given_away" ? "given away" : "returned";
      await notifyUser.send(`**${result.title}** has been ${verb} by <@${interaction.user.id}>.`);
    } catch {
      // DMs disabled
    }
  }

  private async handleBorrow(interaction: ButtonInteraction, entryId: number): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const result = await this.engine.requestBorrow({
      entryId,
      borrowerId: interaction.user.id,
      guildId: interaction.guildId ?? "",
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: "This book no longer exists.",
        not_available: "This book is not currently available.",
        not_lendable: "This book is reference-only.",
        own_book: "You can't borrow your own book!",
        already_requested: "You already have a pending or active borrow for this book.",
        already_borrowing: "You already have a pending or active borrow for this book.",
      };
      await interaction.editReply(messages[result.reason] ?? "Something went wrong.");
      return;
    }

    await interaction.editReply(`Borrow request sent for **${result.title}**! The owner has been notified.`);

    // DM the owner with approve/deny buttons
    try {
      const owner = await interaction.client.users.fetch(result.ownerId!);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`library_approve:${result.borrowId}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`library_deny:${result.borrowId}`)
          .setLabel("Deny")
          .setStyle(ButtonStyle.Danger),
      );
      await owner.send({
        content: `<@${interaction.user.id}> wants to borrow **${result.title}** from your library.`,
        components: [row],
      });
    } catch {
      // DMs disabled
    }
  }

  private async showEditNoteModal(interaction: ButtonInteraction, entryId: number): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`library_note:${entryId}`)
      .setTitle("Edit Book Note")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("note")
            .setLabel("Note")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Add a note about this book (condition details, pickup instructions, etc.)")
            .setRequired(false)
            .setMaxLength(1000),
        ),
      );

    await interaction.showModal(modal);
  }

  private async handleNoteSubmit(interaction: ModalSubmitInteraction, entryId: number): Promise<void> {
    const note = interaction.fields.getTextInputValue("note");

    const result = await this.engine.updateNote({
      entryId,
      ownerId: interaction.user.id,
      note,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: "This book entry no longer exists.",
        not_owner: "Only the book owner can edit the note.",
      };
      await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
      return;
    }

    await interaction.reply({ content: "Note updated!", flags: 64 });
  }
}
