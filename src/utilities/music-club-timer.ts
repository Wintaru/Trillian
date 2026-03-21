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
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function startNewRound(
  client: Client,
  engine: MusicClubEngine,
  accessor: MusicClubAccessor,
  channelId: string,
  guildId: string,
  submissionDays: number,
  ratingDays: number,
): Promise<void> {
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

  const memberIds = await accessor.getMemberUserIds(guildId);
  const mentions = memberIds.map((id) => `<@${id}>`).join(" ");

  const message = await channel.send({
    content: mentions,
    embeds: [embed],
    components: [row],
  });
  await accessor.setRoundMessageId(result.roundId, message.id);
  logger.info(`Music club round #${result.roundId} started.`);
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
  let lastPostDate = "";

  setInterval(async () => {
    try {
      const now = new Date();
      const todayDate = toLocalDateString(now);
      const currentTime = toLocalTimeString(now);

      if (todayDate === lastPostDate || currentTime < roundTime) return;

      // Check if there's already an active round
      const active = await engine.getActiveRound(guildId);
      if (active) {
        // Mark today so we don't keep querying
        lastPostDate = todayDate;
        return;
      }

      // If a previous round exists and is closed, start the next round now
      // (covers bot restarts where the transition timer didn't get to start one)
      const lastClosed = await accessor.getLatestClosedRound(guildId);
      if (lastClosed) {
        lastPostDate = todayDate;
        await startNewRound(client, engine, accessor, channelId, guildId, submissionDays, ratingDays);
        return;
      }

      // Fallback: weekly schedule starts the very first round
      if (now.getDay() === roundDay) {
        lastPostDate = todayDate;
        await startNewRound(client, engine, accessor, channelId, guildId, submissionDays, ratingDays);
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
  channelId: string,
  guildId: string,
  submissionDays: number,
  ratingDays: number,
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

      // Early transition: all members have submitted
      const earlyTransitions = await engine.transitionFullRoundsToListening();
      for (const round of earlyTransitions) {
        try {
          const channel = await client.channels.fetch(round.channelId);
          if (!channel?.isTextBased()) continue;

          const playlist = await engine.getPlaylist(round.id);
          if (!playlist) continue;

          const embed = buildPlaylistEmbed(playlist);
          const existingDesc = embed.data.description ?? "";
          embed.setDescription(
            `Everyone submitted! Submissions closed early.\n\n${existingDesc}`,
          );

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

          logger.info(`Music club round #${round.id} closed early — all members submitted.`);
        } catch (err) {
          logger.error(`Failed to early-transition music club round #${round.id}:`, err);
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

      // Early close: all members have rated all songs
      const earlyClose = await engine.closeFullyRatedRounds();
      for (const round of earlyClose) {
        try {
          await postRoundResults(client, engine, accessor, round, "Everyone rated! Results are in early.");
          await startNewRound(client, engine, accessor, channelId, guildId, submissionDays, ratingDays);
        } catch (err) {
          logger.error(`Failed to early-close music club round #${round.id}:`, err);
        }
      }

      // Transition listening → closed (ratings expired, post results)
      const toClose = await engine.closeExpiredRounds();
      for (const round of toClose) {
        try {
          await postRoundResults(client, engine, accessor, round);
          await startNewRound(client, engine, accessor, channelId, guildId, submissionDays, ratingDays);
        } catch (err) {
          logger.error(`Failed to close music club round #${round.id}:`, err);
        }
      }
    } catch (err) {
      logger.error("Music club transition timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}

async function postRoundResults(
  client: Client,
  engine: MusicClubEngine,
  accessor: MusicClubAccessor,
  round: { id: number; channelId: string; playlistMessageId: string },
  prefixMessage?: string,
): Promise<void> {
  const channel = await client.channels.fetch(round.channelId);
  if (!channel?.isTextBased()) return;

  const results = await engine.getResults(round.id);
  if (!results) return;

  const embed = buildResultsEmbed(results);
  if (prefixMessage) {
    const existingDesc = embed.data.description ?? "";
    embed.setDescription(`${prefixMessage}\n\n${existingDesc}`);
  }

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
}
