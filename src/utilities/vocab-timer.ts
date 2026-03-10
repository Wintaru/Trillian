import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, type Client } from "discord.js";
import type { VocabEngine } from "../engines/vocab-engine.js";
import type { VocabAccessor } from "../accessors/vocab-accessor.js";
import { buildVocabEmbed } from "./vocab-embed.js";
import * as logger from "./logger.js";

const DAILY_CHECK_INTERVAL_MS = 60_000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function startVocabTimer(
  client: Client,
  vocabEngine: VocabEngine,
  vocabAccessor: VocabAccessor,
  channelId: string,
  dailyTime: string,
  defaultLanguage: string,
): void {
  const startup = new Date();
  let lastDailyPostDate = toLocalTimeString(startup) >= dailyTime
    ? toLocalDateString(startup)
    : "";

  setInterval(async () => {
    try {
      const now = new Date();
      const todayDate = toLocalDateString(now);
      const currentTime = toLocalTimeString(now);

      if (currentTime >= dailyTime && todayDate !== lastDailyPostDate) {
        lastDailyPostDate = todayDate;
        logger.info(`Generating daily vocabulary word (${defaultLanguage})`);

        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type === ChannelType.GroupDM) return;
        if (!channel.isTextBased()) return;

        const word = await vocabEngine.generateWord({ language: defaultLanguage });
        const { id } = await vocabAccessor.insertDailyWord(word, Date.now());

        const embed = buildVocabEmbed(word);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`vocab_save:${id}`)
            .setLabel("Save to Vocab")
            .setStyle(ButtonStyle.Primary),
        );

        await channel.send({ embeds: [embed], components: [row] });
        logger.info("Daily vocabulary word posted.");
      }
    } catch (err) {
      logger.error("Vocab daily timer error:", err);
    }
  }, DAILY_CHECK_INTERVAL_MS);
}
