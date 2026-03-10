import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, type Client, type TextBasedChannel } from "discord.js";
import type { ChallengeEngine } from "../engines/challenge-engine.js";
import type { ChallengeAccessor } from "../accessors/challenge-accessor.js";
import { buildChallengeEmbed, buildResultsEmbed } from "./challenge-embed.js";
import * as logger from "./logger.js";

const DAILY_CHECK_INTERVAL_MS = 60_000;
const CLOSE_CHECK_INTERVAL_MS = 30_000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function startChallengePostTimer(
  client: Client,
  challengeEngine: ChallengeEngine,
  challengeAccessor: ChallengeAccessor,
  channelId: string,
  dailyTime: string,
  language: string,
  direction: string,
  durationMinutes: number,
  guildId: string,
): void {
  const startup = new Date();
  let lastPostDate = toLocalTimeString(startup) >= dailyTime
    ? toLocalDateString(startup)
    : "";

  setInterval(async () => {
    try {
      const now = new Date();
      const todayDate = toLocalDateString(now);
      const currentTime = toLocalTimeString(now);

      if (currentTime >= dailyTime && todayDate !== lastPostDate) {
        lastPostDate = todayDate;
        logger.info(`Generating daily translation challenge (${language}, ${direction})`);

        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type === ChannelType.GroupDM) return;
        if (!channel.isTextBased()) return;

        const recentWords = await challengeAccessor.getRecentDailyWords(language, 5);

        const challenge = await challengeEngine.generateChallenge({
          language,
          direction: direction as "to_english" | "from_english",
          recentWords,
        });

        const closesAt = Date.now() + durationMinutes * 60_000;

        const { id } = await challengeAccessor.createChallenge(
          guildId,
          channelId,
          language,
          direction,
          challenge.sentence,
          challenge.referenceTranslation,
          challenge.context,
          closesAt,
          Date.now(),
        );

        const embed = buildChallengeEmbed(
          challenge.sentence,
          language,
          direction,
          closesAt,
          challenge.context,
        );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`challenge_submit:${id}`)
            .setLabel("Submit Translation")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`challenge_results:${id}`)
            .setLabel("View Results")
            .setStyle(ButtonStyle.Secondary),
        );

        const message = await channel.send({ embeds: [embed], components: [row] });
        await challengeAccessor.setChallengeMessageId(id, message.id);
        logger.info("Daily translation challenge posted.");
      }
    } catch (err) {
      logger.error("Challenge daily timer error:", err);
    }
  }, DAILY_CHECK_INTERVAL_MS);
}

export function startChallengeCloseTimer(
  client: Client,
  challengeEngine: ChallengeEngine,
): void {
  setInterval(async () => {
    try {
      const expired = await challengeEngine.closeExpiredChallenges();

      for (const challenge of expired) {
        try {
          const channel = await client.channels.fetch(challenge.channelId);
          if (!channel?.isTextBased()) continue;

          const results = await challengeEngine.getResults({ challengeId: challenge.id });
          if (!results) continue;

          // Edit original message to remove submit button
          if (challenge.messageId) {
            try {
              const message = await (channel as TextBasedChannel).messages.fetch(challenge.messageId);
              const resultsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`challenge_results:${challenge.id}`)
                  .setLabel("View Results")
                  .setStyle(ButtonStyle.Secondary),
              );
              await message.edit({ components: [resultsRow] });
            } catch {
              // Message may have been deleted
            }
          }

          // Post results as a new message
          const embed = buildResultsEmbed(results);
          if (channel.isSendable()) {
            await channel.send({ embeds: [embed] });
          }
          logger.info(`Challenge ${challenge.id} closed and results posted.`);
        } catch (err) {
          logger.error(`Failed to close challenge ${challenge.id}:`, err);
        }
      }
    } catch (err) {
      logger.error("Challenge close timer error:", err);
    }
  }, CLOSE_CHECK_INTERVAL_MS);
}
