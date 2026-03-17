import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { LibraryEngine } from "../engines/library-engine.js";
import type { BookCondition, AvailabilityType } from "../types/library-contracts.js";
import {
  buildBookInfoEmbed,
  buildListEmbed,
  buildSearchEmbed,
  buildShelfEmbed,
  buildWishlistEmbed,
  buildStatsEmbed,
  buildHelpEmbed,
  buildAddedBookEmbed,
  coverAttachment,
} from "../utilities/library-embed.js";

const PAGE_SIZE = 10;

const VALID_CONDITIONS = ["like_new", "good", "fair", "poor"];
const VALID_AVAILABILITY = ["lend", "give", "reference"];
const VALID_SUBCOMMANDS = [
  "add", "remove", "list", "search", "shelf", "info",
  "borrow", "wishlist", "review", "stats", "help",
];

export function createLibraryCommand(
  engine: LibraryEngine,
  channelId: string | undefined,
): Command {
  return {
    name: "library",
    description: "Community library — share, borrow, and discover books",
    slashData: new SlashCommandBuilder()
      .setName("library")
      .setDescription("Community library — share, borrow, and discover books")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a book to the library by ISBN or bookstore URL")
          .addStringOption((opt) =>
            opt.setName("isbn_or_url").setDescription("ISBN number or bookstore URL").setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("condition")
              .setDescription("Book condition")
              .setRequired(false)
              .addChoices(
                { name: "Like New", value: "like_new" },
                { name: "Good", value: "good" },
                { name: "Fair", value: "fair" },
                { name: "Poor", value: "poor" },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("availability")
              .setDescription("How you want to share this book")
              .setRequired(false)
              .addChoices(
                { name: "Lend (borrowable)", value: "lend" },
                { name: "Give Away (free to take)", value: "give" },
                { name: "Reference Only", value: "reference" },
              ),
          )
          .addStringOption((opt) =>
            opt.setName("note").setDescription("Optional note about this book").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove your book from the library")
          .addIntegerOption((opt) =>
            opt.setName("entry_id").setDescription("The book entry ID (shown in listings)").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("Browse all books in the library")
          .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("search")
          .setDescription("Search for books by title or author")
          .addStringOption((opt) =>
            opt.setName("query").setDescription("Search text").setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("shelf")
          .setDescription("View a member's shared books")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("Whose shelf to view (defaults to you)").setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("info")
          .setDescription("View detailed info about a book")
          .addIntegerOption((opt) =>
            opt.setName("entry_id").setDescription("The book entry ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("borrow")
          .setDescription("Request to borrow a book")
          .addIntegerOption((opt) =>
            opt.setName("entry_id").setDescription("The book entry ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("wishlist")
          .setDescription("Manage your book wishlist")
          .addStringOption((opt) =>
            opt
              .setName("action")
              .setDescription("What to do")
              .setRequired(true)
              .addChoices(
                { name: "Add a book", value: "add" },
                { name: "Remove a book", value: "remove" },
                { name: "List your wishlist", value: "list" },
              ),
          )
          .addStringOption((opt) =>
            opt.setName("query").setDescription("ISBN/URL (for add) or wish ID (for remove)").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("review")
          .setDescription("Rate and review a book")
          .addStringOption((opt) =>
            opt.setName("isbn_or_url").setDescription("ISBN or URL of the book").setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("rating")
              .setDescription("Rating from 1 to 5")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(5),
          )
          .addStringOption((opt) =>
            opt.setName("text").setDescription("Optional review text").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("stats").setDescription("View library statistics"),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show library help"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!channelId) {
        await interaction.reply({ content: "Library features are not configured. Ask an admin to set `LIBRARY_CHANNEL_ID`.", flags: 64 });
        return;
      }
      if (interaction.channelId !== channelId) {
        await interaction.reply({ content: `The library lives in <#${channelId}>.`, flags: 64 });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId ?? "";

      switch (sub) {
        case "add":
          await handleAdd(interaction, engine, guildId);
          break;
        case "remove":
          await handleRemove(interaction, engine, guildId);
          break;
        case "list":
          await handleList(interaction, engine, guildId);
          break;
        case "search":
          await handleSearch(interaction, engine, guildId);
          break;
        case "shelf":
          await handleShelf(interaction, engine, guildId);
          break;
        case "info":
          await handleInfo(interaction, engine, guildId);
          break;
        case "borrow":
          await handleBorrow(interaction, engine, guildId);
          break;
        case "wishlist":
          await handleWishlist(interaction, engine, guildId);
          break;
        case "review":
          await handleReview(interaction, engine, guildId);
          break;
        case "stats":
          await handleStats(interaction, engine, guildId);
          break;
        case "help":
          await interaction.reply({ embeds: [buildHelpEmbed()], flags: 64 });
          break;
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      if (!channelId) {
        await message.reply("Library features are not configured. Ask an admin to set `LIBRARY_CHANNEL_ID`.");
        return;
      }
      if (message.channelId !== channelId) {
        await message.reply(`The library lives in <#${channelId}>.`);
        return;
      }

      const sub = context.args[0]?.toLowerCase();
      const guildId = message.guildId ?? "";

      if (!sub || sub === "help" || !VALID_SUBCOMMANDS.includes(sub)) {
        await message.reply({ embeds: [buildHelpEmbed()] });
        return;
      }

      switch (sub) {
        case "add":
          await handleAddPrefix(message, context, engine, guildId);
          break;
        case "remove":
          await handleRemovePrefix(message, context, engine, guildId);
          break;
        case "list":
          await handleListPrefix(message, context, engine, guildId);
          break;
        case "search":
          await handleSearchPrefix(message, context, engine, guildId);
          break;
        case "shelf":
          await handleShelfPrefix(message, context, engine, guildId);
          break;
        case "info":
          await handleInfoPrefix(message, context, engine, guildId);
          break;
        case "borrow":
          await handleBorrowPrefix(message, context, engine, guildId);
          break;
        case "wishlist":
          await handleWishlistPrefix(message, context, engine, guildId);
          break;
        case "review":
          await handleReviewPrefix(message, context, engine, guildId);
          break;
        case "stats":
          await handleStatsPrefix(message, engine, guildId);
          break;
      }
    },
  };
}

// --- Slash Handlers ---

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply();

  const isbnOrUrl = interaction.options.getString("isbn_or_url", true);
  const condition = (interaction.options.getString("condition") ?? "good") as BookCondition;
  const availabilityType = (interaction.options.getString("availability") ?? "lend") as AvailabilityType;
  const note = interaction.options.getString("note") ?? "";

  const result = await engine.addBook({
    isbnOrUrl,
    guildId,
    ownerId: interaction.user.id,
    condition,
    availabilityType,
    note,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      isbn_not_found: "Could not find an ISBN in that input. Please provide a valid ISBN or a bookstore URL (Amazon, Barnes & Noble, etc.).",
      book_not_found: "No book found for that ISBN on Open Library. Double-check the number and try again.",
      already_own: "You already have this book in the library.",
    };
    await interaction.editReply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  const embed = buildAddedBookEmbed(result.entry!);
  const attachment = coverAttachment(result.entry!.coverImage);
  await interaction.editReply({
    embeds: [embed],
    files: attachment ? [attachment] : [],
  });

  // Notify wishlist matches via DM
  if (result.wishlistUserIds && result.wishlistUserIds.length > 0) {
    for (const userId of result.wishlistUserIds) {
      try {
        const user = await interaction.client.users.fetch(userId);
        await user.send(
          `A book on your wishlist was just added to the library!\n**${result.entry!.title}** by ${result.entry!.author} — shared by <@${interaction.user.id}>.\nUse \`/library info ${result.entry!.entryId}\` to see details.`,
        );
      } catch {
        // DMs may be disabled — silently skip
      }
    }
  }
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const entryId = interaction.options.getInteger("entry_id", true);
  const result = await engine.removeBook({ entryId, userId: interaction.user.id });

  const messages: Record<string, string> = {
    removed: "Book removed from the library.",
    not_found: "No book found with that entry ID.",
    not_owner: "You can only remove your own books.",
    currently_lent: "This book is currently lent out. It must be returned before you can remove it.",
  };
  await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const page = Math.max(1, interaction.options.getInteger("page") ?? 1);
  const result = await engine.listBooks({ guildId, page, pageSize: PAGE_SIZE });
  const embed = buildListEmbed(result.entries, result.page, result.totalPages, result.total);
  await interaction.reply({ embeds: [embed] });
}

async function handleSearch(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const query = interaction.options.getString("query", true);
  const page = Math.max(1, interaction.options.getInteger("page") ?? 1);
  const result = await engine.searchBooks({ guildId, query, page, pageSize: PAGE_SIZE });
  const embed = buildSearchEmbed(result.entries, result.query, result.page, result.totalPages, result.total);
  await interaction.reply({ embeds: [embed] });
}

async function handleShelf(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const page = Math.max(1, interaction.options.getInteger("page") ?? 1);
  const result = await engine.getShelf({ guildId, ownerId: targetUser.id, page, pageSize: PAGE_SIZE });
  const embed = buildShelfEmbed(result.entries, targetUser.id, result.page, result.totalPages, result.total);
  await interaction.reply({ embeds: [embed] });
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const entryId = interaction.options.getInteger("entry_id", true);
  const result = await engine.getBookInfo({ entryId, viewerId: interaction.user.id });

  if (!result.success) {
    await interaction.reply({ content: "No book found with that entry ID.", flags: 64 });
    return;
  }

  const reviews = result.entry
    ? await engine.getReviews(result.entry.bookId, guildId)
    : [];
  const embed = buildBookInfoEmbed(result, reviews);

  // Build action buttons based on viewer context
  const buttons: ButtonBuilder[] = [];
  const entry = result.entry!;
  const isOwner = entry.ownerId === interaction.user.id;

  if (isOwner) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`library_editnote:${entry.entryId}`)
        .setLabel("Edit Note")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  if (
    !isOwner &&
    entry.status === "available" &&
    entry.availabilityType !== "reference"
  ) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`library_borrow:${entry.entryId}`)
        .setLabel(entry.availabilityType === "give" ? "Claim Book" : "Request Borrow")
        .setStyle(ButtonStyle.Primary),
    );
  }

  if (result.activeBorrow) {
    const isActiveBorrower = result.activeBorrow.borrowerId === interaction.user.id;
    if (isActiveBorrower || isOwner) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`library_return:${result.activeBorrow.borrowId}`)
          .setLabel("Return Book")
          .setStyle(ButtonStyle.Success),
      );
    }
  }

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (buttons.length > 0) {
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
  }

  const attachment = coverAttachment(entry.coverImage);
  await interaction.reply({ embeds: [embed], components, files: attachment ? [attachment] : [] });
}

async function handleBorrow(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const entryId = interaction.options.getInteger("entry_id", true);
  const result = await engine.requestBorrow({
    entryId,
    borrowerId: interaction.user.id,
    guildId,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "No book found with that entry ID.",
      not_available: "This book is not currently available.",
      not_lendable: "This book is reference-only and cannot be borrowed.",
      own_book: "You can't borrow your own book!",
      already_requested: "You already have a pending or active borrow for this book.",
      already_borrowing: "You already have a pending or active borrow for this book.",
    };
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: `Borrow request sent for **${result.title}**! The owner has been notified.`, flags: 64 });

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
    // Owner has DMs disabled — they can use the info command to see pending requests
  }
}

async function handleWishlist(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const action = interaction.options.getString("action", true);
  const query = interaction.options.getString("query") ?? "";

  switch (action) {
    case "add": {
      if (!query) {
        await interaction.reply({ content: "Provide an ISBN or URL to add to your wishlist.", flags: 64 });
        return;
      }
      // Try to look up the book for metadata
      const { extractIsbn } = await import("../accessors/open-library-accessor.js");
      const isbn = extractIsbn(query);
      const result = await engine.addWish({
        guildId,
        userId: interaction.user.id,
        isbn: isbn ?? "",
        title: query,
        author: "",
      });
      if (!result.success && result.reason === "already_exists") {
        await interaction.reply({ content: "This book is already on your wishlist.", flags: 64 });
      } else {
        await interaction.reply({ content: "Added to your wishlist!", flags: 64 });
      }
      break;
    }
    case "remove": {
      if (!query) {
        await interaction.reply({ content: "Provide the wishlist entry ID to remove.", flags: 64 });
        return;
      }
      const wishId = parseInt(query, 10);
      if (isNaN(wishId)) {
        await interaction.reply({ content: "Invalid ID. Use `/library wishlist list` to see your wish IDs.", flags: 64 });
        return;
      }
      const result = await engine.removeWish({ wishId, userId: interaction.user.id });
      if (!result.success) {
        await interaction.reply({ content: "Wishlist entry not found or not yours.", flags: 64 });
      } else {
        await interaction.reply({ content: "Removed from your wishlist.", flags: 64 });
      }
      break;
    }
    case "list": {
      const result = await engine.listWishlist({ guildId, userId: interaction.user.id });
      const embed = buildWishlistEmbed(result.entries ?? [], interaction.user.id);
      await interaction.reply({ embeds: [embed], flags: 64 });
      break;
    }
  }
}

async function handleReview(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const isbnOrUrl = interaction.options.getString("isbn_or_url", true);
  const rating = interaction.options.getInteger("rating", true);
  const text = interaction.options.getString("text") ?? "";

  const result = await engine.reviewBook({
    isbnOrUrl,
    guildId,
    userId: interaction.user.id,
    rating,
    review: text,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      isbn_not_found: "Could not find an ISBN in that input.",
      book_not_found: "That book isn't in the library yet. It must be added before it can be reviewed.",
      invalid_rating: "Rating must be between 1 and 5.",
    };
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  const action = result.reason === "updated" ? "Updated" : "Added";
  await interaction.reply({
    content: `${action} your review for **${result.title}**! Average rating: ${result.averageRating!.toFixed(1)}/5 (${result.ratingCount} review${result.ratingCount === 1 ? "" : "s"})`,
  });
}

async function handleStats(
  interaction: ChatInputCommandInteraction,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const result = await engine.getStats({ guildId });
  const embed = buildStatsEmbed(result);
  await interaction.reply({ embeds: [embed] });
}

// --- Prefix Handlers ---

function parsePageArg(args: string[], startIndex: number): number {
  const lastArg = args[args.length - 1];
  if (lastArg && /^\d+$/.test(lastArg) && args.length > startIndex) {
    return Math.max(1, parseInt(lastArg, 10));
  }
  return 1;
}

async function handleAddPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  // !library add <isbn_or_url> [condition] [availability] [note...]
  const isbnOrUrl = context.args[1];
  if (!isbnOrUrl) {
    await message.reply("Usage: `!library add <isbn_or_url> [condition] [availability] [note]`");
    return;
  }

  let condition: BookCondition = "good";
  let availabilityType: AvailabilityType = "lend";
  let noteStartIndex = 2;

  if (context.args[2] && VALID_CONDITIONS.includes(context.args[2])) {
    condition = context.args[2] as BookCondition;
    noteStartIndex = 3;
  }
  if (context.args[noteStartIndex] && VALID_AVAILABILITY.includes(context.args[noteStartIndex]!)) {
    availabilityType = context.args[noteStartIndex] as AvailabilityType;
    noteStartIndex++;
  }

  const note = context.args.slice(noteStartIndex).join(" ");

  const reply = await message.reply("Looking up book...");

  const result = await engine.addBook({
    isbnOrUrl,
    guildId,
    ownerId: message.author.id,
    condition,
    availabilityType,
    note,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      isbn_not_found: "Could not find an ISBN in that input. Please provide a valid ISBN or a bookstore URL.",
      book_not_found: "No book found for that ISBN on Open Library.",
      already_own: "You already have this book in the library.",
    };
    await reply.edit(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  const attachment = coverAttachment(result.entry!.coverImage);
  await reply.edit({ content: "", embeds: [buildAddedBookEmbed(result.entry!)], files: attachment ? [attachment] : [] });

  if (result.wishlistUserIds && result.wishlistUserIds.length > 0) {
    for (const userId of result.wishlistUserIds) {
      try {
        const user = await message.client.users.fetch(userId);
        await user.send(
          `A book on your wishlist was just added to the library!\n**${result.entry!.title}** by ${result.entry!.author} — shared by <@${message.author.id}>.\nUse \`/library info ${result.entry!.entryId}\` to see details.`,
        );
      } catch {
        // DMs disabled
      }
    }
  }
}

async function handleRemovePrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const entryId = parseInt(context.args[1] ?? "", 10);
  if (isNaN(entryId)) {
    await message.reply("Usage: `!library remove <entry_id>`");
    return;
  }

  const result = await engine.removeBook({ entryId, userId: message.author.id });
  const messages: Record<string, string> = {
    removed: "Book removed from the library.",
    not_found: "No book found with that entry ID.",
    not_owner: "You can only remove your own books.",
    currently_lent: "This book is currently lent out. It must be returned first.",
  };
  await message.reply(messages[result.reason] ?? "Something went wrong.");
}

async function handleListPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const page = parsePageArg(context.args, 1);
  const result = await engine.listBooks({ guildId, page, pageSize: PAGE_SIZE });
  const embed = buildListEmbed(result.entries, result.page, result.totalPages, result.total);
  await message.reply({ embeds: [embed] });
}

async function handleSearchPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  // !library search <query> [page]
  const args = context.args.slice(1);
  if (args.length === 0) {
    await message.reply("Usage: `!library search <query> [page]`");
    return;
  }

  const page = parsePageArg(args, 1);
  const queryArgs = /^\d+$/.test(args[args.length - 1]!) && args.length > 1
    ? args.slice(0, -1)
    : args;
  const query = queryArgs.join(" ");

  const result = await engine.searchBooks({ guildId, query, page, pageSize: PAGE_SIZE });
  const embed = buildSearchEmbed(result.entries, result.query, result.page, result.totalPages, result.total);
  await message.reply({ embeds: [embed] });
}

async function handleShelfPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  // !library shelf [@user] [page]
  const mentioned = message.mentions.users.first();
  const ownerId = mentioned?.id ?? message.author.id;
  const page = parsePageArg(context.args, 1);

  const result = await engine.getShelf({ guildId, ownerId, page, pageSize: PAGE_SIZE });
  const embed = buildShelfEmbed(result.entries, ownerId, result.page, result.totalPages, result.total);
  await message.reply({ embeds: [embed] });
}

async function handleInfoPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const entryId = parseInt(context.args[1] ?? "", 10);
  if (isNaN(entryId)) {
    await message.reply("Usage: `!library info <entry_id>`");
    return;
  }

  const result = await engine.getBookInfo({ entryId, viewerId: message.author.id });
  if (!result.success) {
    await message.reply("No book found with that entry ID.");
    return;
  }

  const reviews = result.entry
    ? await engine.getReviews(result.entry.bookId, guildId)
    : [];
  const embed = buildBookInfoEmbed(result, reviews);
  const attachment = result.entry ? coverAttachment(result.entry.coverImage) : null;
  await message.reply({ embeds: [embed], files: attachment ? [attachment] : [] });
}

async function handleBorrowPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const entryId = parseInt(context.args[1] ?? "", 10);
  if (isNaN(entryId)) {
    await message.reply("Usage: `!library borrow <entry_id>`");
    return;
  }

  const result = await engine.requestBorrow({
    entryId,
    borrowerId: message.author.id,
    guildId,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "No book found with that entry ID.",
      not_available: "This book is not currently available.",
      not_lendable: "This book is reference-only.",
      own_book: "You can't borrow your own book!",
      already_requested: "You already have a pending or active borrow for this book.",
      already_borrowing: "You already have a pending or active borrow for this book.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply(`Borrow request sent for **${result.title}**! The owner has been notified.`);

  try {
    const owner = await message.client.users.fetch(result.ownerId!);
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
      content: `<@${message.author.id}> wants to borrow **${result.title}** from your library.`,
      components: [row],
    });
  } catch {
    // DMs disabled
  }
}

async function handleWishlistPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const action = context.args[1]?.toLowerCase();
  const query = context.args.slice(2).join(" ");

  if (!action || !["add", "remove", "list"].includes(action)) {
    await message.reply("Usage: `!library wishlist <add|remove|list> [isbn_or_title / wish_id]`");
    return;
  }

  switch (action) {
    case "add": {
      if (!query) {
        await message.reply("Provide an ISBN or URL to add to your wishlist.");
        return;
      }
      const { extractIsbn } = await import("../accessors/open-library-accessor.js");
      const isbn = extractIsbn(query);
      const result = await engine.addWish({
        guildId,
        userId: message.author.id,
        isbn: isbn ?? "",
        title: query,
        author: "",
      });
      if (!result.success && result.reason === "already_exists") {
        await message.reply("This book is already on your wishlist.");
      } else {
        await message.reply("Added to your wishlist!");
      }
      break;
    }
    case "remove": {
      const wishId = parseInt(query, 10);
      if (isNaN(wishId)) {
        await message.reply("Provide the wish ID to remove. Use `!library wishlist list` to see IDs.");
        return;
      }
      const result = await engine.removeWish({ wishId, userId: message.author.id });
      if (!result.success) {
        await message.reply("Wishlist entry not found or not yours.");
      } else {
        await message.reply("Removed from your wishlist.");
      }
      break;
    }
    case "list": {
      const result = await engine.listWishlist({ guildId, userId: message.author.id });
      const embed = buildWishlistEmbed(result.entries ?? [], message.author.id);
      await message.reply({ embeds: [embed] });
      break;
    }
  }
}

async function handleReviewPrefix(
  message: Message,
  context: CommandContext,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  // !library review <isbn_or_url> <rating> [text...]
  const isbnOrUrl = context.args[1];
  const ratingStr = context.args[2];
  if (!isbnOrUrl || !ratingStr) {
    await message.reply("Usage: `!library review <isbn_or_url> <rating 1-5> [text]`");
    return;
  }

  const rating = parseInt(ratingStr, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    await message.reply("Rating must be between 1 and 5.");
    return;
  }

  const text = context.args.slice(3).join(" ");
  const result = await engine.reviewBook({
    isbnOrUrl,
    guildId,
    userId: message.author.id,
    rating,
    review: text,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      isbn_not_found: "Could not find an ISBN in that input.",
      book_not_found: "That book isn't in the library yet.",
      invalid_rating: "Rating must be between 1 and 5.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  const action = result.reason === "updated" ? "Updated" : "Added";
  await message.reply(
    `${action} your review for **${result.title}**! Average rating: ${result.averageRating!.toFixed(1)}/5 (${result.ratingCount} review${result.ratingCount === 1 ? "" : "s"})`,
  );
}

async function handleStatsPrefix(
  message: Message,
  engine: LibraryEngine,
  guildId: string,
): Promise<void> {
  const result = await engine.getStats({ guildId });
  const embed = buildStatsEmbed(result);
  await message.reply({ embeds: [embed] });
}
