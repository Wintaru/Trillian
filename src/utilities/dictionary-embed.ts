import { EmbedBuilder } from "discord.js";
import type { DefineWordResponse, DictionaryMeaning } from "../types/dictionary-contracts.js";

const EMBED_COLOR = 0x5865f2; // Discord blurple
const FIELD_MAX_LENGTH = 1024;

export function buildDictionaryEmbed(response: DefineWordResponse): EmbedBuilder {
  const title = response.word.charAt(0).toUpperCase() + response.word.slice(1);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(response.sourceUrl)
    .setColor(EMBED_COLOR)
    .setTimestamp()
    .setFooter({ text: "Free Dictionary API" });

  if (response.phonetic) {
    embed.setDescription(response.phonetic.text);
  }

  for (const meaning of response.meanings) {
    const value = formatMeaning(meaning);
    embed.addFields({
      name: `*${meaning.partOfSpeech}*`,
      value: truncate(value, FIELD_MAX_LENGTH),
    });
  }

  return embed;
}

function formatMeaning(meaning: DictionaryMeaning): string {
  const lines: string[] = [];

  for (let i = 0; i < meaning.definitions.length; i++) {
    const def = meaning.definitions[i];
    lines.push(`${i + 1}. ${def.definition}`);
    if (def.example) {
      lines.push(`   *"${def.example}"*`);
    }
  }

  if (meaning.synonyms.length > 0) {
    lines.push(`\n**Synonyms:** ${meaning.synonyms.join(", ")}`);
  }

  return lines.join("\n");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}
