import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type Client,
  type TextBasedChannel,
} from "discord.js";
import type { MusicClubEngine } from "../engines/music-club-engine.js";
import type { MusicClubAccessor } from "../accessors/music-club-accessor.js";
import {
  buildRoundAnnouncementEmbed,
  buildPlaylistEmbed,
  buildResultsEmbed,
  buildSubmissionReminderEmbed,
  buildRatingReminderEmbed,
} from "./music-club-embed.js";
import * as logger from "./logger.js";

const CHECK_INTERVAL_MS = 60_000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function startMusicClubRoundTimer(
  client: Client,
  engine: MusicClubEngine,
  accessor: MusicClubAccessor,
  channelId: string,
  roundDay: number,
  roundTime: string,
  submissionDays: number,
  ratingDays: number,
  guildId: string,
): void {
  const startup = new Date();
  // If we're past the round time on the round day, don't post again today
  let lastPostDate =
    startup.getDay() === roundDay && toLocalTimeString(startup) >= roundTime
      ? toLocalDateString(startup)
      : "";

  setInterval(async () => {
    try {
      const now = new Date();
      const todayDate = toLocalDateString(now);
      const currentTime = toLocalTimeString(now);

      // Only start a new round on the configured day at the configured time
      if (
        now.getDay() === roundDay &&
        currentTime >= roundTime &&
        todayDate !== lastPostDate
      ) {
        lastPostDate = todayDate;

        // Check if there's already an active round
        const active = await engine.getActiveRound(guildId);
        if (active) {
          logger.info(`Music club: skipping new round, round #${active.id} is still ${active.status}`);
          return;
        }

        logger.info("Music club: starting new round");

        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type === ChannelType.GroupDM || !channel.isTextBased()) return;

        const result = await engine.startNewRound({
          guildId,
          channelId,
          submissionDays,
          ratingDays,
        });

        const memberCount = await engine.getMemberCount(guildId);
        const embed = buildRoundAnnouncementEmbed(result.roundId, result.submissionsCloseAt, memberCount);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`musicclub_submit:${result.roundId}`)
            .setLabel("Submit a Song")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`musicclub_playlist:${result.roundId}`)
            .setLabel("View Playlist")
            .setStyle(ButtonStyle.Secondary),
        );

        const message = await channel.send({ embeds: [embed], components: [row] });
        await accessor.setRoundMessageId(result.roundId, message.id);
        logger.info(`Music club round #${result.roundId} started.`);
      }
    } catch (err) {
      logger.error("Music club round timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}

export function startMusicClubTransitionTimer(
  client: Client,
  engine: MusicClubEngine,
  accessor: MusicClubAccessor,
): void {
  setInterval(async () => {
    try {
      const now = Date.now();

      // Submission closing soon reminders
      const submissionReminders = await accessor.getRoundsNeedingSubmissionReminder(now);
      for (const round of submissionReminders) {
        try {
          const channel = await client.channels.fetch(round.channelId);
          if (!channel?.isTextBased() || !channel.isSendable()) continue;

          const embed = buildSubmissionReminderEmbed(round.id, round.submissionsCloseAt);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`musicclub_submit:${round.id}`)
              .setLabel("Submit a Song")
              .setStyle(ButtonStyle.Primary),
          );
          await channel.send({ embeds: [embed], components: [row] });
          await accessor.markSubmissionReminderSent(round.id);
          logger.info(`Music club round #${round.id}: submission reminder sent.`);
        } catch (err) {
          logger.error(`Failed to send submission reminder for round #${round.id}:`, err);
        }
      }

      // Rating closing soon reminders
      const ratingReminders = await accessor.getRoundsNeedingRatingReminder(now);
      for (const round of ratingReminders) {
        try {
          const channel = await client.channels.fetch(round.channelId);
          if (!channel?.isTextBased() || !channel.isSendable()) continue;

          const embed = buildRatingReminderEmbed(round.id, round.ratingsCloseAt);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`musicclub_rate:${round.id}`)
              .setLabel("Rate Songs")
              .setStyle(ButtonStyle.Primary),
          );
          await channel.send({ embeds: [embed], components: [row] });
          await accessor.markRatingReminderSent(round.id);
          logger.info(`Music club round #${round.id}: rating reminder sent.`);
        } catch (err) {
          logger.error(`Failed to send rating reminder for round #${round.id}:`, err);
        }
      }

      // Transition open → listening (submissions closed, post playlist)
      const toListening = await engine.transitionToListening();
      for (const round of toListening) {
        try {
          const channel = await client.channels.fetch(round.channelId);
          if (!channel?.isTextBased()) continue;

          const playlist = await engine.getPlaylist(round.id);
          if (!playlist) continue;

          const embed = buildPlaylistEmbed(playlist);

          const rateRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`musicclub_rate:${round.id}`)
              .setLabel("Rate Songs")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`musicclub_playlist:${round.id}`)
              .setLabel("View Playlist")
              .setStyle(ButtonStyle.Secondary),
          );

          if (channel.isSendable()) {
            const msg = await channel.send({ embeds: [embed], components: [rateRow] });
            await accessor.setPlaylistMessageId(round.id, msg.id);
          }

          // Edit original announcement to remove submit button
          if (round.messageId) {
            try {
              const origMessage = await (channel as TextBasedChannel).messages.fetch(round.messageId);
              const viewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`musicclub_playlist:${round.id}`)
                  .setLabel("View Playlist")
                  .setStyle(ButtonStyle.Secondary),
              );
              await origMessage.edit({ components: [viewRow] });
            } catch {
              // Message may have been deleted
            }
          }

          logger.info(`Music club round #${round.id} transitioned to listening.`);
        } catch (err) {
          logger.error(`Failed to transition music club round #${round.id}:`, err);
        }
      }

      // Transition listening → closed (ratings closed, post results)
      const toClose = await engine.closeExpiredRounds();
      for (const round of toClose) {
        try {
          const channel = await client.channels.fetch(round.channelId);
          if (!channel?.isTextBased()) continue;

          const results = await engine.getResults(round.id);
          if (!results) continue;

          const embed = buildResultsEmbed(results);

          if (channel.isSendable()) {
            const msg = await channel.send({ embeds: [embed] });
            await accessor.setResultsMessageId(round.id, msg.id);
          }

          // Remove rating buttons from playlist message
          if (round.playlistMessageId) {
            try {
              const playlistMsg = await (channel as TextBasedChannel).messages.fetch(round.playlistMessageId);
              const resultsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`musicclub_results:${round.id}`)
                  .setLabel("View Results")
                  .setStyle(ButtonStyle.Secondary),
              );
              await playlistMsg.edit({ components: [resultsRow] });
            } catch {
              // Message may have been deleted
            }
          }

          logger.info(`Music club round #${round.id} closed, results posted.`);
        } catch (err) {
          logger.error(`Failed to close music club round #${round.id}:`, err);
        }
      }
    } catch (err) {
      logger.error("Music club transition timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
