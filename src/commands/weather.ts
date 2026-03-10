import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { WeatherEngine } from "../engines/weather-engine.js";
import { buildWeatherEmbed, buildWeatherAlertEmbed } from "../utilities/weather-embed.js";
import { parseWeatherInput } from "../utilities/parse-weather-input.js";

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
          .setDescription("Where and when (e.g. 'Denver next tuesday', '90210', 'Seoul')")
          .setRequired(false),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const rawInput = interaction.options.getString("location") ?? "";
      const { location: parsedLocation, targetDate } = parseWeatherInput(rawInput);
      const location = parsedLocation || defaultLocation;

      if (!location) {
        await interaction.reply({
          content: "No location provided and no default location configured. Use `/weather <location>` or set WEATHER_LOCATION.",
          flags: 64,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const result = await weatherEngine.getWeather({ location, targetDate });
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
      const rawInput = context.args.join(" ");
      const { location: parsedLocation, targetDate } = parseWeatherInput(rawInput);
      const location = parsedLocation || defaultLocation;

      if (!location) {
        await message.reply(
          "No location provided and no default location configured. Use `!weather <location>` or set WEATHER_LOCATION.",
        );
        return;
      }

      try {
        const result = await weatherEngine.getWeather({ location, targetDate });
        const embeds = [buildWeatherEmbed(result)];

        for (const alert of result.alerts.slice(0, 3)) {
          embeds.push(buildWeatherAlertEmbed(alert, result.location));
        }

        if (message.channel.isSendable()) {
          await message.channel.send({ embeds });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unknown error occurred.";
        await message.reply(`Failed to fetch weather: ${msg}`);
      }
    },
  };
}
