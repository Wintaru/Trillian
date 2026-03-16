import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { ButtonHandler, ModalHandler } from "../types/button-handler.js";
import type { MusicClubEngine } from "./music-club-engine.js";
import type { MusicClubSongEntry } from "../types/music-club-contracts.js";
import { buildPlaylistEmbed, buildResultsEmbed, buildPlatformLinks } from "../utilities/music-club-embed.js";
import * as logger from "../utilities/logger.js";

const EMBED_COLOR = 0xe91e63;

function buildSongRatingEmbed(
  song: MusicClubSongEntry,
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

function buildRatingButtons(roundId: number, songId: number): ActionRowBuilder<ButtonBuilder>[] {
  // Two rows: 1-5, 6-10
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`musicclub_wizardrate:${roundId}:${songId}:${n}`)
        .setLabel(`${n}`)
        .setStyle(n <= 3 ? ButtonStyle.Danger : n <= 6 ? ButtonStyle.Primary : ButtonStyle.Success),
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


export class MusicClubButtonHandler implements ButtonHandler, ModalHandler {
  constructor(private readonly engine: MusicClubEngine) {}

  canHandle(customId: string): boolean {
    return customId.startsWith("musicclub_");
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith("musicclub_submit:")) {
      await this.showSubmitModal(interaction);
    } else if (customId.startsWith("musicclub_rate:")) {
      await this.startRatingWizard(interaction);
    } else if (customId.startsWith("musicclub_wizardrate:")) {
      await this.handleWizardRate(interaction);
    } else if (customId.startsWith("musicclub_wizardskip:")) {
      await this.handleWizardSkip(interaction);
    } else if (customId.startsWith("musicclub_playlist:")) {
      await this.handlePlaylist(interaction);
    } else if (customId.startsWith("musicclub_results:")) {
      await this.handleResults(interaction);
    }
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith("musicclub_modal_submit:")) {
      await this.handleSubmission(interaction);
    }
  }

  // --- Submit ---

  private async showSubmitModal(interaction: ButtonInteraction): Promise<void> {
    const roundId = interaction.customId.split(":")[1];

    const modal = new ModalBuilder()
      .setCustomId(`musicclub_modal_submit:${roundId}`)
      .setTitle("Submit a Song")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("song_url")
            .setLabel("Song URL (Spotify, YouTube, etc.)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("https://open.spotify.com/track/...")
            .setRequired(true)
            .setMaxLength(500),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("song_reason")
            .setLabel("Why this song? (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Tell everyone why you picked this song...")
            .setRequired(false)
            .setMaxLength(500),
        ),
      );

    await interaction.showModal(modal);
  }

  private async handleSubmission(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const roundId = parseInt(interaction.customId.split(":")[1], 10);
    const url = interaction.fields.getTextInputValue("song_url").trim();
    const reason = interaction.fields.getTextInputValue("song_reason").trim();

    if (!url) {
      await interaction.editReply("Please provide a song URL.");
      return;
    }

    try {
      const result = await this.engine.submitSong({
        roundId,
        userId: interaction.user.id,
        guildId: interaction.guildId ?? "",
        url,
        reason: reason || undefined,
      });

      if (!result.success) {
        const messages: Record<string, string> = {
          not_member: "You need to join the music club first! Use `/musicclub join`.",
          invalid_url: "That doesn't look like a valid URL. Please provide a link to a song.",
          round_not_found: "This round was not found.",
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
    } catch (err) {
      logger.error("Failed to submit music club song:", err);
      await interaction.editReply("An error occurred while submitting your song. Please try again.");
    }
  }

  // --- Rating Wizard ---

  private async startRatingWizard(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const roundId = parseInt(interaction.customId.split(":")[1], 10);
    const userId = interaction.user.id;
    const guildId = interaction.guildId ?? "";

    try {
      const isMember = await this.engine.getActiveRound(guildId);
      if (!isMember) {
        await interaction.editReply("No active round found.");
        return;
      }

      const playlist = await this.engine.getPlaylist(roundId);
      if (!playlist) {
        await interaction.editReply("Round not found.");
        return;
      }

      if (playlist.status !== "listening") {
        await interaction.editReply("This round is not currently accepting ratings.");
        return;
      }

      // Filter out the user's own song
      const songsToRate = playlist.songs.filter((s) => s.userId !== userId);
      if (songsToRate.length === 0) {
        await interaction.editReply("There are no songs to rate (you submitted the only song!).");
        return;
      }

      // Skip already-rated songs
      const existingRatings = await this.engine.getUserRatingsForRound(roundId, userId);
      const unratedSongs = songsToRate.filter((s) => !existingRatings.has(s.id));

      if (unratedSongs.length === 0) {
        const summaryLines = songsToRate.map((song) => {
          const name = song.title && song.artist
            ? `${song.title} — ${song.artist}`
            : "Unknown";
          const r = existingRatings.get(song.id);
          return r !== undefined ? `${name}: **${r}/10**` : `${name}: Skipped`;
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
      const embed = buildSongRatingEmbed(firstSong, indexInFull, songsToRate.length);
      embed.setFooter({
        text: `Song ${indexInFull + 1} of ${songsToRate.length} (${unratedSongs.length} unrated remaining)`,
      });
      const components = buildRatingButtons(roundId, firstSong.id);
      await interaction.editReply({ embeds: [embed], components });
    } catch (err) {
      logger.error("Failed to start rating wizard:", err);
      await interaction.editReply("An error occurred. Please try again.");
    }
  }

  private async handleWizardRate(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const parts = interaction.customId.split(":");
    const roundId = parseInt(parts[1], 10);
    const songId = parseInt(parts[2], 10);
    const rating = parseInt(parts[3], 10);
    const userId = interaction.user.id;
    const guildId = interaction.guildId ?? "";

    try {
      // Record the rating
      const result = await this.engine.rateSong({ songId, userId, guildId, rating });
      if (!result.success) {
        const messages: Record<string, string> = {
          not_member: "You need to join the music club first!",
          song_not_found: "Song not found.",
          own_song: "You can't rate your own song!",
          round_not_listening: "This round is no longer accepting ratings.",
          invalid_rating: "Invalid rating.",
        };
        await interaction.editReply({
          content: messages[result.reason] ?? "Failed to rate.",
          embeds: [],
          components: [],
        });
        return;
      }

      // Show next song or summary
      await this.advanceWizard(interaction, roundId, songId, userId, rating);
    } catch (err) {
      logger.error("Failed to rate in wizard:", err);
      await interaction.editReply({
        content: "An error occurred. Please try again.",
        embeds: [],
        components: [],
      });
    }
  }

  private async handleWizardSkip(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const parts = interaction.customId.split(":");
    const roundId = parseInt(parts[1], 10);
    const songId = parseInt(parts[2], 10);
    const userId = interaction.user.id;

    try {
      await this.advanceWizard(interaction, roundId, songId, userId, null);
    } catch (err) {
      logger.error("Failed to skip in wizard:", err);
      await interaction.editReply({
        content: "An error occurred. Please try again.",
        embeds: [],
        components: [],
      });
    }
  }

  private async advanceWizard(
    interaction: ButtonInteraction,
    roundId: number,
    currentSongId: number,
    userId: string,
    ratingGiven: number | null,
  ): Promise<void> {
    const playlist = await this.engine.getPlaylist(roundId);
    if (!playlist) {
      await interaction.editReply({ content: "Round not found.", embeds: [], components: [] });
      return;
    }

    const songsToRate = playlist.songs.filter((s) => s.userId !== userId);
    const currentIndex = songsToRate.findIndex((s) => s.id === currentSongId);

    // Find the song that was just rated for the summary
    const ratedSong = songsToRate[currentIndex];
    const ratedLabel = ratedSong
      ? `${ratedSong.title || "Song"}: ${ratingGiven !== null ? `**${ratingGiven}/10**` : "Skipped"}`
      : "";

    // Find next unrated song (skip already-rated ones)
    const userRatings = await this.engine.getUserRatingsForRound(roundId, userId);
    let nextSong: MusicClubSongEntry | undefined;
    let nextIndex = -1;
    for (let i = currentIndex + 1; i < songsToRate.length; i++) {
      if (!userRatings.has(songsToRate[i].id)) {
        nextSong = songsToRate[i];
        nextIndex = i;
        break;
      }
    }

    if (!nextSong) {
      // Wizard complete — show summary with all ratings from DB
      const summaryLines = songsToRate.map((song) => {
        const name = song.title && song.artist
          ? `${song.title} — ${song.artist}`
          : "Unknown";
        const r = userRatings.get(song.id);
        return r !== undefined ? `${name}: **${r}/10**` : `${name}: Skipped`;
      });

      const unratedCount = songsToRate.filter((s) => !userRatings.has(s.id)).length;
      const summaryEmbed = new EmbedBuilder()
        .setTitle("Rating Complete!")
        .setDescription(summaryLines.join("\n"))
        .setColor(EMBED_COLOR)
        .setFooter({
          text: unratedCount > 0
            ? `${unratedCount} song(s) skipped — run the wizard again to rate them`
            : "Use /musicclub rate <number> to change a rating",
        });

      await interaction.editReply({
        content: null,
        embeds: [summaryEmbed],
        components: [],
      });
      return;
    }

    // Show next unrated song
    const unratedRemaining = songsToRate.filter(
      (s, i) => i > nextIndex && !userRatings.has(s.id),
    ).length + 1; // +1 for the current one being shown

    const embed = buildSongRatingEmbed(nextSong, nextIndex, songsToRate.length);
    embed.setFooter({
      text: `Song ${nextIndex + 1} of ${songsToRate.length} (${unratedRemaining} unrated remaining)`,
    });
    const components = buildRatingButtons(roundId, nextSong.id);
    await interaction.editReply({
      content: ratedLabel,
      embeds: [embed],
      components,
    });
  }

  // --- View handlers ---

  private async handlePlaylist(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const roundId = parseInt(interaction.customId.split(":")[1], 10);

    try {
      const playlist = await this.engine.getPlaylist(roundId);
      if (!playlist) {
        await interaction.editReply("Round not found.");
        return;
      }
      const embed = buildPlaylistEmbed(playlist);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error("Failed to load music club playlist:", err);
      await interaction.editReply("An error occurred loading the playlist.");
    }
  }

  private async handleResults(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const roundId = parseInt(interaction.customId.split(":")[1], 10);

    try {
      const results = await this.engine.getResults(roundId);
      if (!results) {
        await interaction.editReply("Round not found.");
        return;
      }
      const embed = buildResultsEmbed(results);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error("Failed to load music club results:", err);
      await interaction.editReply("An error occurred loading results.");
    }
  }
}
