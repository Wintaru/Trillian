import { ChannelType, type Client } from "discord.js";
import type { BirthdayEngine } from "../engines/birthday-engine.js";
import * as logger from "./logger.js";

const CHECK_INTERVAL_MS = 60_000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function startBirthdayTimer(
  client: Client,
  birthdayEngine: BirthdayEngine,
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

        const birthdays = await birthdayEngine.getTodaysBirthdays(
          guildId,
          now.getMonth() + 1,
          now.getDate(),
        );

        if (birthdays.length === 0) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type === ChannelType.GroupDM) return;
        if (!channel.isTextBased()) return;

        const lines = birthdays.map((b) => {
          if (b.personName === null) {
            return `Happy Birthday, <@${b.userId}>! :birthday: :tada:`;
          }
          return `Happy Birthday to <@${b.userId}>'s ${b.personName}! :birthday: :tada:`;
        });

        await channel.send(lines.join("\n"));
        logger.info(`Posted ${birthdays.length} birthday announcement(s)`);
      }
    } catch (err) {
      logger.error("Birthday timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
