import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { WeatherEngine } from "../engines/weather-engine.js";
import { buildWeatherEmbed, buildWeatherAlertEmbed } from "../utilities/weather-embed.js";

export function createWeatherCommand(
  weatherEngine: WeatherEngine,
  defaultLocation: string,
): Command {
  return {
    name: "weather",
    description: "Get current weather and forecast for a location",
    slashData: new SlashCommandBuilder()
      .setName("weather")
      .setDescription("Get current weather and forecast for a location")
      .addStringOption((opt) =>
        opt
          .setName("location")
          .setDescription("Location (zip, city, or 'City, Country'). Defaults to server location.")
          .setRequired(false),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const location = interaction.options.getString("location") ?? defaultLocation;

      if (!location) {
        await interaction.reply({
          content: "No location provided and no default location configured. Use `/weather <location>` or set WEATHER_LOCATION.",
          flags: 64,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const result = await weatherEngine.getWeather({ location });
        const embeds = [buildWeatherEmbed(result)];

        for (const alert of result.alerts.slice(0, 3)) {
          embeds.push(buildWeatherAlertEmbed(alert, result.location));
        }

        await interaction.editReply({ embeds });
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        await interaction.editReply(`Failed to fetch weather: ${message}`);
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const location = context.args.join(" ") || defaultLocation;

      if (!location) {
        await message.reply(
          "No location provided and no default location configured. Use `!weather <location>` or set WEATHER_LOCATION.",
        );
        return;
      }

      try {
        const result = await weatherEngine.getWeather({ location });
        const embeds = [buildWeatherEmbed(result)];

        for (const alert of result.alerts.slice(0, 3)) {
          embeds.push(buildWeatherAlertEmbed(alert, result.location));
        }

        await message.reply({ embeds });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unknown error occurred.";
        await message.reply(`Failed to fetch weather: ${msg}`);
      }
    },
  };
}
