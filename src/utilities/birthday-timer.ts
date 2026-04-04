import { ChannelType, EmbedBuilder, type Client } from "discord.js";
import type { BirthdayEngine } from "../engines/birthday-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { BirthdayEntry } from "../types/birthday-contracts.js";
import * as logger from "./logger.js";

const CHECK_INTERVAL_MS = 60_000;
const EMBED_COLOR = 0xe91e63;

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FAMOUS_BIRTHDAYS_PROMPT = `List 3-4 interesting or famous people born on the given date. Include a mix — historical figures, musicians, actors, scientists, athletes, etc. Keep each entry to one short line with the person's name and what they're known for.

Respond with ONLY the list, no intro or outro. Example format:
- Albert Einstein — theoretical physicist, developed the theory of relativity
- Will Smith — actor and rapper
- Ruth Bader Ginsburg — Supreme Court Justice and women's rights champion`;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function buildBirthdayEmbeds(
  ollamaAccessor: OllamaAccessor,
  birthdays: BirthdayEntry[],
  month: number,
  day: number,
): Promise<EmbedBuilder[]> {
  const famousList = await getFamousBirthdays(ollamaAccessor, month, day);
  return birthdays.map((b) => buildBirthdayEmbed(b, month, day, famousList));
}

async function getFamousBirthdays(
  ollamaAccessor: OllamaAccessor,
  month: number,
  day: number,
): Promise<string | null> {
  try {
    const response = await ollamaAccessor.chat([
      { role: "system", content: FAMOUS_BIRTHDAYS_PROMPT },
      { role: "user", content: `Who was born on ${MONTH_NAMES[month]} ${day}?` },
    ]);
    return response.trim();
  } catch (error) {
    logger.warn("Birthday timer: failed to fetch famous birthdays from Ollama:", error);
    return null;
  }
}

function buildBirthdayEmbed(
  entry: BirthdayEntry,
  month: number,
  day: number,
  famousList: string | null,
): EmbedBuilder {
  const title = entry.personName === null
    ? `Happy Birthday, <@${entry.userId}>!`
    : `Happy Birthday to <@${entry.userId}>'s ${entry.personName}!`;

  const embed = new EmbedBuilder()
    .setTitle(":birthday: Birthday! :tada:")
    .setDescription(title)
    .setColor(EMBED_COLOR)
    .setFooter({ text: `${MONTH_NAMES[month]} ${day}` });

  if (famousList) {
    embed.addFields({
      name: "Born on this day",
      value: famousList.slice(0, 1024),
    });
  }

  return embed;
}

export function startBirthdayTimer(
  client: Client,
  birthdayEngine: BirthdayEngine,
  ollamaAccessor: OllamaAccessor,
  channelId: string,
  guildId: string,
  dailyTime: string,
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

        const month = now.getMonth() + 1;
        const day = now.getDate();

        const birthdays = await birthdayEngine.getTodaysBirthdays(guildId, month, day);

        if (birthdays.length === 0) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type === ChannelType.GroupDM) return;
        if (!channel.isTextBased()) return;

        const embeds = await buildBirthdayEmbeds(ollamaAccessor, birthdays, month, day);

        await channel.send({ embeds });
        logger.info(`Posted ${birthdays.length} birthday announcement(s)`);
      }
    } catch (err) {
      logger.error("Birthday timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
