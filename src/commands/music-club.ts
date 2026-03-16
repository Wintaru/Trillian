import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { MusicClubEngine } from "../engines/music-club-engine.js";
import {
  buildPlaylistEmbed,
  buildResultsEmbed,
  buildPlatformLinks,
} from "../utilities/music-club-embed.js";

export function createMusicClubCommand(engine: MusicClubEngine): Command {
  return {
    name: "musicclub",
    description: "Weekly music club — submit songs, rate, and discover new music",
    slashData: new SlashCommandBuilder()
      .setName("musicclub")
      .setDescription("Weekly music club — submit songs, rate, and discover new music")
      .addSubcommand((sub) =>
        sub.setName("join").setDescription("Join the music club"),
      )
      .addSubcommand((sub) =>
        sub.setName("leave").setDescription("Leave the music club"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("submit")
          .setDescription("Submit a song for the current round")
          .addStringOption((opt) =>
            opt.setName("url").setDescription("Song URL (Spotify, YouTube, etc.)").setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Why did you pick this song?").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("rate")
          .setDescription("Start the rating wizard for the current round")
          .addIntegerOption((opt) =>
            opt.setName("song").setDescription("Song number to rate/re-rate (from the playlist)").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("playlist")
          .setDescription("View the current round's playlist")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Round ID (defaults to current)").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("results")
          .setDescription("View results for a completed round")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Round ID (defaults to most recent)").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("myratings").setDescription("View your ratings for the current round"),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show available music club commands"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId ?? "";

      switch (sub) {
        case "join":
          await handleJoin(interaction, engine, guildId);
          break;
        case "leave":
          await handleLeave(interaction, engine, guildId);
          break;
        case "submit":
          await handleSubmit(interaction, engine, guildId);
          break;
        case "rate":
          await handleRate(interaction, engine, guildId);
          break;
        case "playlist":
          await handlePlaylist(interaction, engine, guildId);
          break;
        case "results":
          await handleResults(interaction, engine, guildId);
          break;
        case "myratings":
          await handleMyRatings(interaction, engine, guildId);
          break;
        case "help":
          await handleHelp(interaction);
          break;
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const sub = context.args[0]?.toLowerCase();
      const guildId = message.guildId ?? "";

      if (!sub || sub === "help" || !["join", "leave", "submit", "rate", "playlist", "results", "myratings"].includes(sub)) {
        await handleHelpPrefix(message);
        return;
      }

      switch (sub) {
        case "join":
          await handleJoinPrefix(message, engine, guildId);
          break;
        case "leave":
          await handleLeavePrefix(message, engine, guildId);
          break;
        case "submit":
          await handleSubmitPrefix(message, context, engine, guildId);
          break;
        case "rate":
          await handleRatePrefix(message, context, engine, guildId);
          break;
        case "playlist":
          await handlePlaylistPrefix(message, context, engine, guildId);
          break;
        case "results":
          await handleResultsPrefix(message, context, engine, guildId);
          break;
        case "myratings":
          await handleMyRatingsPrefix(message, engine, guildId);
          break;
      }
    },
  };
}

const EMBED_COLOR = 0xe91e63;

function buildWizardSongEmbed(
  song: { title: string; artist: string; originalUrl: string; userId: string; reason: string; links: { spotify?: string; youtube?: string; appleMusic?: string; tidal?: string; pageUrl: string } },
  songIndex: number,
  totalSongs: number,
): EmbedBuilder {
  const title = song.title && song.artist
    ? `${song.title} — ${song.artist}`
    : "Unknown Song";

  const description = [
    `Submitted by <@${song.userId}>`,
    song.reason ? `> ${song.reason}` : "",
    buildPlatformLinks(song.links, song.originalUrl),
  ].filter(Boolean).join("\n");

  return new EmbedBuilder()
    .setTitle(`Rate: ${title}`)
    .setDescription(description)
    .setColor(EMBED_COLOR)
    .setFooter({ text: `Song ${songIndex + 1} of ${totalSongs}` });
}

function buildWizardRatingButtons(roundId: number, songId: number): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`musicclub_wizardrate:${roundId}:${songId}:${n}`)
        .setLabel(`${n}`)
        .setStyle(n <= 3 ? ButtonStyle.Danger : ButtonStyle.Primary),
    ),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[6, 7, 8, 9, 10].map((n) =>
      new ButtonBuilder()
        .setCustomId(`musicclub_wizardrate:${roundId}:${songId}:${n}`)
        .setLabel(`${n}`)
        .setStyle(n <= 6 ? ButtonStyle.Primary : ButtonStyle.Success),
    ),
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`musicclub_wizardskip:${roundId}:${songId}`)
      .setLabel("Skip")
      .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

const HELP_DESCRIPTION = [
  "**Music Club** — Discover new music together!",
  "",
  "**How it works:**",
  "Each round, members submit one song. The bot announces when the round opens " +
  "and sends reminders before each deadline. After submissions close, a playlist " +
  "is posted with links for every major streaming platform. Everyone listens and " +
  "rates each song 1-10. When ratings close, results are posted ranked by average " +
  "rating, along with each rater's total points given.",
  "",
  "**Commands:**",
  "`/musicclub join` — Join the music club",
  "`/musicclub leave` — Leave the music club",
  "`/musicclub submit <url> [reason]` — Submit a song for the current round",
  "`/musicclub rate` — Rate unrated songs with an interactive wizard (1-10)",
  "`/musicclub rate <number>` — Rate or re-rate a specific song by its playlist number",
  "`/musicclub myratings` — View your ratings for the current round (private)",
  "`/musicclub playlist [id]` — View the current or a past round's playlist",
  "`/musicclub results [id]` — View results for a completed round",
  "",
  "**Timeline:**",
  "Round opens → Submit songs → Reminder before deadline → " +
  "Submissions close → Listen & rate → Reminder before deadline → " +
  "Ratings close → Results posted",
].join("\n");

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Music Club — Help")
    .setDescription(HELP_DESCRIPTION)
    .setColor(EMBED_COLOR);
}

// --- Slash handlers ---

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ embeds: [buildHelpEmbed()], flags: 64 });
}

async function handleJoin(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });
  const result = await engine.join({ userId: interaction.user.id, guildId });
  if (result.reason === "already_member") {
    await interaction.editReply("You're already a member of the music club!");
    return;
  }
  let msg = "Welcome to the music club! You'll be able to submit and rate songs each round.";
  const activeRound = await engine.getActiveRound(guildId);
  if (activeRound && activeRound.status === "open") {
    msg += `\n\nA round is open right now! Use \`/musicclub submit <url>\` to submit a song.`;
  }
  await interaction.editReply(msg);
}

async function handleLeave(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });
  const result = await engine.leave({ userId: interaction.user.id, guildId });
  const msg = result.reason === "not_member"
    ? "You're not a member of the music club."
    : "You've left the music club. You can rejoin anytime with `/musicclub join`.";
  await interaction.editReply(msg);
}

async function handleSubmit(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const url = interaction.options.getString("url", true);
  const reason = interaction.options.getString("reason") ?? undefined;

  const activeRound = await engine.getActiveRound(guildId);
  if (!activeRound || activeRound.status !== "open") {
    await interaction.editReply("There's no round currently accepting submissions.");
    return;
  }

  const result = await engine.submitSong({
    roundId: activeRound.id,
    userId: interaction.user.id,
    guildId,
    url,
    reason,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_member: "You need to join the music club first! Use `/musicclub join`.",
      invalid_url: "That doesn't look like a valid URL.",
      round_not_found: "Round not found.",
      round_not_open: "This round is no longer accepting submissions.",
    };
    await interaction.editReply(messages[result.reason] ?? "Failed to submit song.");
    return;
  }

  const label = result.reason === "resubmitted" ? "Song updated!" : "Song submitted!";
  const songInfo = result.song?.title
    ? `**${result.song.title}** — ${result.song.artist}`
    : url;
  await interaction.editReply(`${label}\n${songInfo}`);
}

async function handleRate(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const activeRound = await engine.getActiveRound(guildId);
  if (!activeRound || activeRound.status !== "listening") {
    await interaction.editReply("There's no round currently accepting ratings.");
    return;
  }

  const playlist = await engine.getPlaylist(activeRound.id);
  if (!playlist) {
    await interaction.editReply("Round not found.");
    return;
  }

  const userId = interaction.user.id;
  const songsToRate = playlist.songs.filter((s) => s.userId !== userId);
  if (songsToRate.length === 0) {
    await interaction.editReply("There are no songs to rate.");
    return;
  }

  const songNumber = interaction.options.getInteger("song");

  if (songNumber !== null) {
    // Single-song rating mode
    const index = songNumber - 1;
    if (index < 0 || index >= songsToRate.length) {
      await interaction.editReply(
        `Invalid song number. Choose between 1 and ${songsToRate.length}.`,
      );
      return;
    }
    const song = songsToRate[index];
    const existingRatings = await engine.getUserRatingsForRound(activeRound.id, userId);
    const existing = existingRatings.get(song.id);
    const embed = buildWizardSongEmbed(song, index, songsToRate.length);
    if (existing !== undefined) {
      embed.setFooter({ text: `Song ${index + 1} of ${songsToRate.length} · Current rating: ${existing}/10` });
    }
    const components = buildWizardRatingButtons(activeRound.id, song.id);
    await interaction.editReply({ embeds: [embed], components });
    return;
  }

  // Wizard mode — skip already-rated songs
  const existingRatings = await engine.getUserRatingsForRound(activeRound.id, userId);
  const unratedSongs = songsToRate.filter((s) => !existingRatings.has(s.id));

  if (unratedSongs.length === 0) {
    const summaryLines = songsToRate.map((song, i) => {
      const name = song.title && song.artist
        ? `${song.title} — ${song.artist}`
        : "Unknown";
      const r = existingRatings.get(song.id);
      return r !== undefined
        ? `${i + 1}. ${name}: **${r}/10**`
        : `${i + 1}. ${name}: Skipped`;
    });
    const embed = new EmbedBuilder()
      .setTitle("All Songs Rated!")
      .setDescription(
        `You've already rated every song.\n\n${summaryLines.join("\n")}`,
      )
      .setColor(EMBED_COLOR)
      .setFooter({ text: "Use /musicclub rate <number> to change a rating" });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Show the first unrated song
  const firstSong = unratedSongs[0];
  const indexInFull = songsToRate.indexOf(firstSong);
  const embed = buildWizardSongEmbed(firstSong, indexInFull, songsToRate.length);
  embed.setFooter({
    text: `Song ${indexInFull + 1} of ${songsToRate.length} (${unratedSongs.length} unrated remaining)`,
  });
  const components = buildWizardRatingButtons(activeRound.id, firstSong.id);
  await interaction.editReply({ embeds: [embed], components });
}

async function handlePlaylist(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const roundId = interaction.options.getInteger("id");
  const playlist = roundId
    ? await engine.getPlaylist(roundId)
    : await engine.getLatestPlaylist(guildId);

  if (!playlist) {
    await interaction.editReply("No rounds found.");
    return;
  }

  const embed = buildPlaylistEmbed(playlist);
  await interaction.editReply({ embeds: [embed] });
}

async function handleResults(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const roundId = interaction.options.getInteger("id");
  const results = roundId
    ? await engine.getResults(roundId)
    : await engine.getLatestResults(guildId);

  if (!results) {
    await interaction.editReply("No results found.");
    return;
  }

  const embed = buildResultsEmbed(results);
  await interaction.editReply({ embeds: [embed] });
}

async function handleMyRatings(
  interaction: ChatInputCommandInteraction,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const activeRound = await engine.getActiveRound(guildId);
  if (!activeRound) {
    await interaction.editReply("No active round found.");
    return;
  }

  const playlist = await engine.getPlaylist(activeRound.id);
  if (!playlist) {
    await interaction.editReply("Round not found.");
    return;
  }

  const userId = interaction.user.id;
  const songsToRate = playlist.songs.filter((s) => s.userId !== userId);
  const userRatings = await engine.getUserRatingsForRound(activeRound.id, userId);

  const lines = songsToRate.map((song, i) => {
    const name = song.title && song.artist
      ? `${song.title} — ${song.artist}`
      : "Unknown";
    const r = userRatings.get(song.id);
    return r !== undefined
      ? `${i + 1}. ${name}: **${r}/10**`
      : `${i + 1}. ${name}: *Not rated*`;
  });

  const rated = songsToRate.filter((s) => userRatings.has(s.id)).length;
  const embed = new EmbedBuilder()
    .setTitle(`Your Ratings — Round #${activeRound.id}`)
    .setDescription(lines.join("\n"))
    .setColor(EMBED_COLOR)
    .setFooter({ text: `${rated}/${songsToRate.length} songs rated` });

  await interaction.editReply({ embeds: [embed] });
}

// --- Prefix handlers ---

async function handleJoinPrefix(message: Message, engine: MusicClubEngine, guildId: string): Promise<void> {
  const result = await engine.join({ userId: message.author.id, guildId });
  if (result.reason === "already_member") {
    await message.reply("You're already a member of the music club!");
    return;
  }
  let msg = "Welcome to the music club!";
  const activeRound = await engine.getActiveRound(guildId);
  if (activeRound && activeRound.status === "open") {
    msg += `\n\nA round is open right now! Use \`!musicclub submit <url>\` to submit a song.`;
  }
  await message.reply(msg);
}

async function handleLeavePrefix(message: Message, engine: MusicClubEngine, guildId: string): Promise<void> {
  const result = await engine.leave({ userId: message.author.id, guildId });
  const msg = result.reason === "not_member"
    ? "You're not a member of the music club."
    : "You've left the music club.";
  await message.reply(msg);
}

async function handleSubmitPrefix(
  message: Message,
  context: CommandContext,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  const url = context.args[1];
  if (!url) {
    await message.reply("Usage: `!musicclub submit <url> [reason]`");
    return;
  }

  const activeRound = await engine.getActiveRound(guildId);
  if (!activeRound || activeRound.status !== "open") {
    await message.reply("There's no round currently accepting submissions.");
    return;
  }

  const reason = context.args.slice(2).join(" ") || undefined;
  const result = await engine.submitSong({
    roundId: activeRound.id,
    userId: message.author.id,
    guildId,
    url,
    reason,
  });

  if (!result.success) {
    const messages: Record<string, string> = {
      not_member: "You need to join the music club first! Use `!musicclub join`.",
      invalid_url: "That doesn't look like a valid URL.",
      round_not_found: "Round not found.",
      round_not_open: "This round is no longer accepting submissions.",
    };
    await message.reply(messages[result.reason] ?? "Failed to submit song.");
    return;
  }

  const label = result.reason === "resubmitted" ? "Song updated!" : "Song submitted!";
  await message.reply(label);
}

async function handleRatePrefix(
  message: Message,
  _context: CommandContext,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  const activeRound = await engine.getActiveRound(guildId);
  if (!activeRound || activeRound.status !== "listening") {
    await message.reply("There's no round currently accepting ratings. Use the slash command `/musicclub rate` for the interactive wizard.");
    return;
  }

  await message.reply("Use the slash command `/musicclub rate` or click the **Rate Songs** button on the playlist to start the rating wizard.");
}

async function handlePlaylistPrefix(
  message: Message,
  context: CommandContext,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  const roundId = parseInt(context.args[1], 10);
  const playlist = isNaN(roundId)
    ? await engine.getLatestPlaylist(guildId)
    : await engine.getPlaylist(roundId);

  if (!playlist) {
    await message.reply("No rounds found.");
    return;
  }

  const embed = buildPlaylistEmbed(playlist);
  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleResultsPrefix(
  message: Message,
  context: CommandContext,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  const roundId = parseInt(context.args[1], 10);
  const results = isNaN(roundId)
    ? await engine.getLatestResults(guildId)
    : await engine.getResults(roundId);

  if (!results) {
    await message.reply("No results found.");
    return;
  }

  const embed = buildResultsEmbed(results);
  if (message.channel.isSendable()) {
    await message.channel.send({ embeds: [embed] });
  }
}

async function handleMyRatingsPrefix(
  message: Message,
  engine: MusicClubEngine,
  guildId: string,
): Promise<void> {
  const activeRound = await engine.getActiveRound(guildId);
  if (!activeRound) {
    await message.reply("No active round found.");
    return;
  }

  const playlist = await engine.getPlaylist(activeRound.id);
  if (!playlist) {
    await message.reply("Round not found.");
    return;
  }

  const userId = message.author.id;
  const songsToRate = playlist.songs.filter((s) => s.userId !== userId);
  const userRatings = await engine.getUserRatingsForRound(activeRound.id, userId);

  const lines = songsToRate.map((song, i) => {
    const name = song.title && song.artist
      ? `${song.title} — ${song.artist}`
      : "Unknown";
    const r = userRatings.get(song.id);
    return r !== undefined
      ? `${i + 1}. ${name}: **${r}/10**`
      : `${i + 1}. ${name}: *Not rated*`;
  });

  const rated = songsToRate.filter((s) => userRatings.has(s.id)).length;
  const embed = new EmbedBuilder()
    .setTitle(`Your Ratings — Round #${activeRound.id}`)
    .setDescription(lines.join("\n"))
    .setColor(EMBED_COLOR)
    .setFooter({ text: `${rated}/${songsToRate.length} songs rated` });

  // Send as ephemeral-like DM reply so only the user sees it
  await message.reply({ embeds: [embed] });
}

async function handleHelpPrefix(message: Message): Promise<void> {
  await message.reply({ embeds: [buildHelpEmbed()] });
}

