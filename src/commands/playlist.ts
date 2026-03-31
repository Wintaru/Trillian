import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { PlaylistEngine } from "../engines/playlist-engine.js";
import {
  buildPlaylistViewEmbed,
  buildPlaylistListEmbed,
  buildPlaylistHelpEmbed,
} from "../utilities/playlist-embed.js";

const PLATFORM_CHOICES: { name: string; value: string }[] = [
  { name: "Spotify", value: "spotify" },
  { name: "Apple Music", value: "apple_music" },
  { name: "YouTube", value: "youtube" },
  { name: "Tidal", value: "tidal" },
  { name: "Amazon Music", value: "amazon_music" },
  { name: "SoundCloud", value: "soundcloud" },
  { name: "Other", value: "other" },
];

const VALID_SUBCOMMANDS = [
  "create", "edit", "close", "reopen", "delete",
  "list", "view", "add", "remove", "editsong",
  "link", "removelink", "help",
];

export function createPlaylistCommand(engine: PlaylistEngine): Command {
  return {
    name: "playlist",
    description: "Create and manage collaborative playlists",
    slashData: new SlashCommandBuilder()
      .setName("playlist")
      .setDescription("Create and manage collaborative playlists")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new playlist")
          .addStringOption((opt) =>
            opt.setName("title").setDescription("Playlist title / theme").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("description").setDescription("Optional description").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("Edit your playlist's title or description")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Playlist ID").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("title").setDescription("New title").setRequired(false),
          )
          .addStringOption((opt) =>
            opt.setName("description").setDescription("New description").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("close")
          .setDescription("Close your playlist to new submissions")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Playlist ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("reopen")
          .setDescription("Reopen a closed playlist")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Playlist ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Delete your playlist and all its songs")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Playlist ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List playlists")
          .addStringOption((opt) =>
            opt
              .setName("status")
              .setDescription("Filter by status")
              .setRequired(false)
              .addChoices(
                { name: "Open", value: "open" },
                { name: "Closed", value: "closed" },
                { name: "All", value: "all" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View a playlist's songs")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Playlist ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a song to a playlist")
          .addIntegerOption((opt) =>
            opt.setName("playlist").setDescription("Playlist ID").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("url").setDescription("Song URL").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("note").setDescription("Optional note about this song").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a song from a playlist")
          .addIntegerOption((opt) =>
            opt.setName("song").setDescription("Song ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("editsong")
          .setDescription("Edit a song's note")
          .addIntegerOption((opt) =>
            opt.setName("song").setDescription("Song ID").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("note").setDescription("New note text").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("link")
          .setDescription("Add or update a platform playlist link")
          .addIntegerOption((opt) =>
            opt.setName("playlist").setDescription("Playlist ID").setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("platform")
              .setDescription("Streaming platform")
              .setRequired(true)
              .addChoices(...PLATFORM_CHOICES),
          )
          .addStringOption((opt) =>
            opt.setName("url").setDescription("Playlist URL on that platform").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("removelink")
          .setDescription("Remove a platform playlist link")
          .addIntegerOption((opt) =>
            opt.setName("playlist").setDescription("Playlist ID").setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("platform")
              .setDescription("Streaming platform")
              .setRequired(true)
              .addChoices(...PLATFORM_CHOICES),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show available playlist commands"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId ?? "";

      switch (sub) {
        case "create":
          await handleCreate(interaction, engine, guildId);
          break;
        case "edit":
          await handleEdit(interaction, engine);
          break;
        case "close":
          await handleClose(interaction, engine);
          break;
        case "reopen":
          await handleReopen(interaction, engine);
          break;
        case "delete":
          await handleDelete(interaction, engine);
          break;
        case "list":
          await handleList(interaction, engine, guildId);
          break;
        case "view":
          await handleView(interaction, engine);
          break;
        case "add":
          await handleAdd(interaction, engine);
          break;
        case "remove":
          await handleRemove(interaction, engine);
          break;
        case "editsong":
          await handleEditSong(interaction, engine);
          break;
        case "link":
          await handleLink(interaction, engine);
          break;
        case "removelink":
          await handleRemoveLink(interaction, engine);
          break;
        case "help":
          await handleHelp(interaction);
          break;
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const sub = context.args[0]?.toLowerCase();
      const guildId = message.guildId ?? "";

      if (!sub || sub === "help" || !VALID_SUBCOMMANDS.includes(sub)) {
        await handleHelpPrefix(message);
        return;
      }

      switch (sub) {
        case "create":
          await handleCreatePrefix(message, context, engine, guildId);
          break;
        case "edit":
          await handleEditPrefix(message, context, engine);
          break;
        case "close":
          await handleClosePrefix(message, context, engine);
          break;
        case "reopen":
          await handleReopenPrefix(message, context, engine);
          break;
        case "delete":
          await handleDeletePrefix(message, context, engine);
          break;
        case "list":
          await handleListPrefix(message, context, engine, guildId);
          break;
        case "view":
          await handleViewPrefix(message, context, engine);
          break;
        case "add":
          await handleAddPrefix(message, context, engine);
          break;
        case "remove":
          await handleRemovePrefix(message, context, engine);
          break;
        case "editsong":
          await handleEditSongPrefix(message, context, engine);
          break;
        case "link":
          await handleLinkPrefix(message, context, engine);
          break;
        case "removelink":
          await handleRemoveLinkPrefix(message, context, engine);
          break;
      }
    },
  };
}

// --- Slash Handlers ---

async function handleCreate(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
  guildId: string,
): Promise<void> {
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description") ?? undefined;

  const result = await engine.createPlaylist({
    guildId,
    userId: interaction.user.id,
    title,
    description,
  });

  if (!result.success) {
    await interaction.reply({ content: "Title is too long (max 100 characters).", flags: 64 });
    return;
  }

  await interaction.reply(`Playlist **${title}** created! (ID: ${result.playlistId})`);
}

async function handleEdit(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("id", true);
  const title = interaction.options.getString("title") ?? undefined;
  const description = interaction.options.getString("description") ?? undefined;

  if (!title && description === undefined) {
    await interaction.reply({ content: "Provide at least a new title or description.", flags: 64 });
    return;
  }

  const result = await engine.editPlaylist({ playlistId, userId: interaction.user.id, title, description });

  const messages: Record<string, string> = {
    not_found: "Playlist not found.",
    not_creator: "Only the playlist creator can edit it.",
    title_too_long: "Title is too long (max 100 characters).",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Playlist updated.", flags: 64 });
}

async function handleClose(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("id", true);
  const result = await engine.closePlaylist({ playlistId, userId: interaction.user.id });

  const messages: Record<string, string> = {
    not_found: "Playlist not found.",
    not_creator: "Only the playlist creator can close it.",
    already_closed: "This playlist is already closed.",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Playlist closed. No new submissions will be accepted.", flags: 64 });
}

async function handleReopen(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("id", true);
  const result = await engine.reopenPlaylist({ playlistId, userId: interaction.user.id });

  const messages: Record<string, string> = {
    not_found: "Playlist not found.",
    not_creator: "Only the playlist creator can reopen it.",
    already_open: "This playlist is already open.",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Playlist reopened! Submissions are accepted again.", flags: 64 });
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("id", true);
  const result = await engine.deletePlaylist({ playlistId, userId: interaction.user.id });

  const messages: Record<string, string> = {
    not_found: "Playlist not found.",
    not_creator: "Only the playlist creator can delete it.",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Playlist deleted.", flags: 64 });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
  guildId: string,
): Promise<void> {
  const status = interaction.options.getString("status") ?? "open";
  const playlists = await engine.listPlaylists(guildId, status);
  const embed = buildPlaylistListEmbed(playlists, status);
  await interaction.reply({ embeds: [embed] });
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("id", true);
  const view = await engine.viewPlaylist(playlistId);

  if (!view) {
    await interaction.reply({ content: "Playlist not found.", flags: 64 });
    return;
  }

  const embed = buildPlaylistViewEmbed(view);
  await interaction.reply({ embeds: [embed] });
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("playlist", true);
  const url = interaction.options.getString("url", true);
  const note = interaction.options.getString("note") ?? undefined;

  await interaction.deferReply();

  const result = await engine.addSong({ playlistId, userId: interaction.user.id, url, note });

  const messages: Record<string, string> = {
    not_found: "Playlist not found.",
    playlist_not_open: "This playlist is closed and not accepting new songs.",
    invalid_url: "That doesn't look like a valid URL.",
  };

  if (!result.success) {
    await interaction.editReply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await interaction.editReply(`Song added to the playlist! (Song ID: ${result.songId})`);
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const songId = interaction.options.getInteger("song", true);
  const result = await engine.removeSong({ songId, userId: interaction.user.id });

  const messages: Record<string, string> = {
    not_found: "Song not found.",
    not_authorized: "You can only remove your own songs (or be the playlist creator).",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Song removed.", flags: 64 });
}

async function handleEditSong(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const songId = interaction.options.getInteger("song", true);
  const note = interaction.options.getString("note", true);
  const result = await engine.editSong({ songId, userId: interaction.user.id, note });

  const messages: Record<string, string> = {
    not_found: "Song not found.",
    not_authorized: "You can only edit your own songs (or be the playlist creator).",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Song note updated.", flags: 64 });
}

async function handleLink(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("playlist", true);
  const platform = interaction.options.getString("platform", true);
  const url = interaction.options.getString("url", true);

  const result = await engine.addLink({ playlistId, userId: interaction.user.id, platform, url });

  const messages: Record<string, string> = {
    not_found: "Playlist not found.",
    playlist_not_open: "This playlist is closed.",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  const verb = result.reason === "added" ? "added" : "updated";
  await interaction.reply({ content: `Platform link ${verb}.`, flags: 64 });
}

async function handleRemoveLink(
  interaction: ChatInputCommandInteraction,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = interaction.options.getInteger("playlist", true);
  const platform = interaction.options.getString("platform", true);

  const result = await engine.removeLink({ playlistId, userId: interaction.user.id, platform });

  const messages: Record<string, string> = {
    not_found: "Link not found.",
    not_authorized: "You can only remove your own links (or be the playlist creator).",
  };

  if (!result.success) {
    await interaction.reply({ content: messages[result.reason] ?? "Something went wrong.", flags: 64 });
    return;
  }

  await interaction.reply({ content: "Platform link removed.", flags: 64 });
}

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = buildPlaylistHelpEmbed();
  await interaction.reply({ embeds: [embed], flags: 64 });
}

// --- Prefix Handlers ---

async function handleCreatePrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
  guildId: string,
): Promise<void> {
  // !playlist create <title> | [description]
  const rest = context.args.slice(1).join(" ");
  if (!rest) {
    await message.reply("Usage: `!playlist create <title> [| description]`");
    return;
  }

  const [title, ...descParts] = rest.split("|");
  const description = descParts.join("|").trim() || undefined;

  const result = await engine.createPlaylist({
    guildId,
    userId: message.author.id,
    title: title.trim(),
    description,
  });

  if (!result.success) {
    await message.reply("Title is too long (max 100 characters).");
    return;
  }

  await message.reply(`Playlist **${title.trim()}** created! (ID: ${result.playlistId})`);
}

async function handleEditPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  // !playlist edit <id> <title> [| description]
  const id = Number(context.args[1]);
  if (!id) {
    await message.reply("Usage: `!playlist edit <id> <title> [| description]`");
    return;
  }

  const rest = context.args.slice(2).join(" ");
  if (!rest) {
    await message.reply("Provide at least a new title or description.");
    return;
  }

  const [title, ...descParts] = rest.split("|");
  const description = descParts.length > 0 ? descParts.join("|").trim() : undefined;

  const result = await engine.editPlaylist({
    playlistId: id,
    userId: message.author.id,
    title: title.trim() || undefined,
    description,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Playlist not found.",
      not_creator: "Only the playlist creator can edit it.",
      title_too_long: "Title is too long (max 100 characters).",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Playlist updated.");
}

async function handleClosePrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const id = Number(context.args[1]);
  if (!id) {
    await message.reply("Usage: `!playlist close <id>`");
    return;
  }

  const result = await engine.closePlaylist({ playlistId: id, userId: message.author.id });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Playlist not found.",
      not_creator: "Only the playlist creator can close it.",
      already_closed: "This playlist is already closed.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Playlist closed. No new submissions will be accepted.");
}

async function handleReopenPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const id = Number(context.args[1]);
  if (!id) {
    await message.reply("Usage: `!playlist reopen <id>`");
    return;
  }

  const result = await engine.reopenPlaylist({ playlistId: id, userId: message.author.id });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Playlist not found.",
      not_creator: "Only the playlist creator can reopen it.",
      already_open: "This playlist is already open.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Playlist reopened! Submissions are accepted again.");
}

async function handleDeletePrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const id = Number(context.args[1]);
  if (!id) {
    await message.reply("Usage: `!playlist delete <id>`");
    return;
  }

  const result = await engine.deletePlaylist({ playlistId: id, userId: message.author.id });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Playlist not found.",
      not_creator: "Only the playlist creator can delete it.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Playlist deleted.");
}

async function handleListPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
  guildId: string,
): Promise<void> {
  const status = context.args[1]?.toLowerCase() ?? "open";
  if (!["open", "closed", "all"].includes(status)) {
    await message.reply("Usage: `!playlist list [open|closed|all]`");
    return;
  }

  const playlists = await engine.listPlaylists(guildId, status);
  const embed = buildPlaylistListEmbed(playlists, status);
  await message.reply({ embeds: [embed] });
}

async function handleViewPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const id = Number(context.args[1]);
  if (!id) {
    await message.reply("Usage: `!playlist view <id>`");
    return;
  }

  const view = await engine.viewPlaylist(id);
  if (!view) {
    await message.reply("Playlist not found.");
    return;
  }

  const embed = buildPlaylistViewEmbed(view);
  await message.reply({ embeds: [embed] });
}

async function handleAddPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = Number(context.args[1]);
  const url = context.args[2];
  if (!playlistId || !url) {
    await message.reply("Usage: `!playlist add <playlist-id> <url> [note]`");
    return;
  }

  const note = context.args.slice(3).join(" ") || undefined;
  const result = await engine.addSong({ playlistId, userId: message.author.id, url, note });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Playlist not found.",
      playlist_not_open: "This playlist is closed and not accepting new songs.",
      invalid_url: "That doesn't look like a valid URL.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply(`Song added to the playlist! (Song ID: ${result.songId})`);
}

async function handleRemovePrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const songId = Number(context.args[1]);
  if (!songId) {
    await message.reply("Usage: `!playlist remove <song-id>`");
    return;
  }

  const result = await engine.removeSong({ songId, userId: message.author.id });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Song not found.",
      not_authorized: "You can only remove your own songs (or be the playlist creator).",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Song removed.");
}

async function handleEditSongPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const songId = Number(context.args[1]);
  const note = context.args.slice(2).join(" ");
  if (!songId || !note) {
    await message.reply("Usage: `!playlist editsong <song-id> <note>`");
    return;
  }

  const result = await engine.editSong({ songId, userId: message.author.id, note });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Song not found.",
      not_authorized: "You can only edit your own songs (or be the playlist creator).",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Song note updated.");
}

async function handleLinkPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = Number(context.args[1]);
  const platform = context.args[2]?.toLowerCase();
  const url = context.args[3];
  const validPlatforms = PLATFORM_CHOICES.map((c) => c.value);

  if (!playlistId || !platform || !url) {
    await message.reply(`Usage: \`!playlist link <playlist-id> <platform> <url>\`\nPlatforms: ${validPlatforms.join(", ")}`);
    return;
  }

  if (!validPlatforms.includes(platform)) {
    await message.reply(`Invalid platform. Choose from: ${validPlatforms.join(", ")}`);
    return;
  }

  const result = await engine.addLink({ playlistId, userId: message.author.id, platform, url });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Playlist not found.",
      playlist_not_open: "This playlist is closed.",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  const verb = result.reason === "added" ? "added" : "updated";
  await message.reply(`Platform link ${verb}.`);
}

async function handleRemoveLinkPrefix(
  message: Message,
  context: CommandContext,
  engine: PlaylistEngine,
): Promise<void> {
  const playlistId = Number(context.args[1]);
  const platform = context.args[2]?.toLowerCase();
  const validPlatforms = PLATFORM_CHOICES.map((c) => c.value);

  if (!playlistId || !platform) {
    await message.reply(`Usage: \`!playlist removelink <playlist-id> <platform>\`\nPlatforms: ${validPlatforms.join(", ")}`);
    return;
  }

  if (!validPlatforms.includes(platform)) {
    await message.reply(`Invalid platform. Choose from: ${validPlatforms.join(", ")}`);
    return;
  }

  const result = await engine.removeLink({ playlistId, userId: message.author.id, platform });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "Link not found.",
      not_authorized: "You can only remove your own links (or be the playlist creator).",
    };
    await message.reply(messages[result.reason] ?? "Something went wrong.");
    return;
  }

  await message.reply("Platform link removed.");
}

async function handleHelpPrefix(message: Message): Promise<void> {
  const embed = buildPlaylistHelpEmbed();
  await message.reply({ embeds: [embed] });
}
