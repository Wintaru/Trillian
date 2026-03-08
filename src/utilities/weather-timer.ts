import { ChannelType, type Client } from "discord.js";
import type { WeatherEngine } from "../engines/weather-engine.js";
import type { WeatherAlertAccessor } from "../accessors/weather-alert-accessor.js";
import { buildWeatherEmbed, buildWeatherAlertEmbed } from "./weather-embed.js";
import * as logger from "./logger.js";

const DAILY_CHECK_INTERVAL_MS = 60_000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function startWeatherTimer(
  client: Client,
  weatherEngine: WeatherEngine,
  weatherAlertAccessor: WeatherAlertAccessor,
  channelId: string,
  defaultLocation: string,
  dailyTime: string,
  alertIntervalMs: number,
): void {
  // If we start after the daily time has already passed, mark today as done
  // so we don't immediately fire a stale post (e.g. bot restarts at 6 PM
  // but dailyTime is "06:00").
  const startup = new Date();
  let lastDailyPostDate = toLocalTimeString(startup) >= dailyTime
    ? toLocalDateString(startup)
    : "";

  // Daily forecast check
  setInterval(async () => {
    try {
      const now = new Date();
      const todayDate = toLocalDateString(now);
      const currentTime = toLocalTimeString(now);

      if (currentTime >= dailyTime && todayDate !== lastDailyPostDate) {
        lastDailyPostDate = todayDate;
        logger.info(`Posting daily weather forecast for ${defaultLocation}`);

        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type === ChannelType.GroupDM) return;
        if (!channel.isTextBased()) return;

        const result = await weatherEngine.getWeather({ location: defaultLocation });
        const embed = buildWeatherEmbed(result);

        await channel.send({ embeds: [embed] });
        logger.info("Daily weather forecast posted.");
      }
    } catch (err) {
      logger.error("Weather daily timer error:", err);
    }
  }, DAILY_CHECK_INTERVAL_MS);

  // Warm the geocode cache at startup so the first alert tick doesn't cold-call Nominatim
  weatherEngine.getAlerts({ location: defaultLocation }).catch(() => {
    // Failure is fine — the interval will retry
  });

  // Alert check
  setInterval(async () => {
    try {
      const result = await weatherEngine.getAlerts({ location: defaultLocation });

      if (result.alerts.length === 0) return;

      const channel = await client.channels.fetch(channelId);
      if (!channel || channel.type === ChannelType.GroupDM) return;
      if (!channel.isTextBased()) return;

      for (const alert of result.alerts) {
        const alreadyPosted = await weatherAlertAccessor.hasBeenPosted(alert.id);
        if (alreadyPosted) continue;

        const embed = buildWeatherAlertEmbed(alert, result.location);
        await channel.send({ embeds: [embed] });
        await weatherAlertAccessor.markPosted(alert.id, channelId);
        logger.info(`Posted weather alert: ${alert.event}`);
      }

      // Prune old alerts occasionally
      await weatherAlertAccessor.pruneOldAlerts(SEVEN_DAYS_MS);
    } catch (err) {
      logger.error("Weather alert timer error:", err);
    }
  }, alertIntervalMs);
}
