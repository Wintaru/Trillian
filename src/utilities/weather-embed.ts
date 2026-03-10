import { EmbedBuilder } from "discord.js";
import type { GetWeatherResponse, WeatherAlert, GeocodedLocation } from "../types/weather-contracts.js";

function temperatureColor(tempF: number): number {
  if (tempF <= 32) return 0x5dadec; // blue - freezing
  if (tempF <= 75) return 0x57f287; // green - pleasant
  if (tempF <= 90) return 0xfee75c; // yellow - warm
  return 0xed4245; // red - hot
}

function severityColor(severity: string): number {
  switch (severity.toLowerCase()) {
    case "extreme":
    case "severe":
      return 0xed4245; // red
    case "moderate":
      return 0xe67e22; // orange
    default:
      return 0xfee75c; // yellow
  }
}

function weatherEmoji(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("thunder") || d.includes("storm")) return "\u26C8\uFE0F";
  if (d.includes("rain") || d.includes("shower")) return "\uD83C\uDF27\uFE0F";
  if (d.includes("snow") || d.includes("blizzard")) return "\uD83C\uDF28\uFE0F";
  if (d.includes("fog") || d.includes("mist") || d.includes("haze")) return "\uD83C\uDF2B\uFE0F";
  if (d.includes("cloud") || d.includes("overcast")) return "\u2601\uFE0F";
  if (d.includes("partly")) return "\u26C5";
  if (d.includes("clear") || d.includes("sunny") || d.includes("fair")) return "\u2600\uFE0F";
  if (d.includes("wind")) return "\uD83D\uDCA8";
  return "\uD83C\uDF24\uFE0F";
}

export function buildWeatherEmbed(response: GetWeatherResponse): EmbedBuilder {
  if (response.targetDate) {
    return buildDateForecastEmbed(response);
  }

  const { current, forecast, location, forecastUrl, provider } = response;
  const emoji = weatherEmoji(current.description);

  const currentText = [
    `${emoji} **${current.description}**`,
    `\uD83C\uDF21\uFE0F **Temperature:** ${current.temperature}\u00B0F (${current.temperatureC}\u00B0C)`,
    `\uD83E\uDD75 **Feels Like:** ${current.feelsLike}\u00B0F (${current.feelsLikeC}\u00B0C)`,
    `\uD83D\uDCA7 **Humidity:** ${current.humidity}%`,
    `\uD83D\uDCA8 **Wind:** ${current.windSpeed} mph ${current.windDirection}`,
  ].join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`Weather for ${shortenDisplayName(location.displayName)}`)
    .setURL(forecastUrl)
    .setDescription(currentText)
    .setColor(temperatureColor(current.temperature))
    .setTimestamp()
    .setFooter({ text: `via ${provider === "nws" ? "National Weather Service" : "WeatherAPI.com"}` });

  const periodsToShow = forecast.slice(0, 4);
  for (const period of periodsToShow) {
    const periodEmoji = weatherEmoji(period.shortForecast);
    embed.addFields({
      name: `${periodEmoji} ${period.name}`,
      value: `${period.shortForecast}\n${period.temperature}\u00B0${period.temperatureUnit} | Wind: ${period.windSpeed}`,
      inline: true,
    });
  }

  return embed;
}

function buildDateForecastEmbed(response: GetWeatherResponse): EmbedBuilder {
  const { forecast, location, forecastUrl, provider, targetDate } = response;

  const dateLabel = targetDate!.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const embed = new EmbedBuilder()
    .setTitle(`Forecast for ${shortenDisplayName(location.displayName)} \u2014 ${dateLabel}`)
    .setURL(forecastUrl)
    .setColor(temperatureColor(forecast[0]?.temperature ?? 60))
    .setTimestamp()
    .setFooter({ text: `via ${provider === "nws" ? "National Weather Service" : "WeatherAPI.com"}` });

  for (const period of forecast) {
    const periodEmoji = weatherEmoji(period.shortForecast);
    const detail = period.detailedForecast || period.shortForecast;
    embed.addFields({
      name: `${periodEmoji} ${period.name}`,
      value: `${detail}\n**${period.temperature}\u00B0${period.temperatureUnit}** | Wind: ${period.windSpeed}`,
    });
  }

  return embed;
}

export function buildWeatherAlertEmbed(
  alert: WeatherAlert,
  location: GeocodedLocation,
): EmbedBuilder {
  const description = alert.description.length > 1024
    ? alert.description.slice(0, 1021) + "..."
    : alert.description;

  const embed = new EmbedBuilder()
    .setTitle(`\u26A0\uFE0F ${alert.event}`)
    .setDescription(`**${alert.headline}**\n\n${description}`)
    .setColor(severityColor(alert.severity))
    .setTimestamp();

  if (alert.expires) {
    const expiresUnix = Math.floor(new Date(alert.expires).getTime() / 1000);
    embed.addFields({
      name: "Expires",
      value: `<t:${expiresUnix}:R> (<t:${expiresUnix}:f>)`,
      inline: true,
    });
  }

  embed.addFields({
    name: "Location",
    value: shortenDisplayName(location.displayName),
    inline: true,
  });

  if (alert.senderName) {
    embed.setFooter({ text: alert.senderName });
  }

  return embed;
}

function shortenDisplayName(name: string): string {
  const parts = name.split(", ");
  if (parts.length <= 3) return name;
  return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
}
