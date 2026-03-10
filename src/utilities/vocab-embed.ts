import { EmbedBuilder } from "discord.js";
import type { GenerateWordResponse, VocabQuizResponse, VocabListEntry } from "../types/vocab-contracts.js";
import { languageName } from "../engines/translate-engine.js";

const EMBED_COLOR = 0x5865f2;
const FIELD_MAX_LENGTH = 1024;

export function buildVocabEmbed(response: GenerateWordResponse): EmbedBuilder {
  const lang = languageName(response.language);

  const embed = new EmbedBuilder()
    .setTitle(`Word of the Day — ${lang}`)
    .setColor(EMBED_COLOR)
    .setTimestamp()
    .setFooter({ text: "Powered by Ollama" });

  embed.addFields({ name: "Word", value: `**${response.word}**` });
  embed.addFields({ name: "Translation", value: truncate(response.translation, FIELD_MAX_LENGTH) });

  if (response.pronunciation) {
    embed.addFields({ name: "Pronunciation", value: response.pronunciation });
  }

  if (response.exampleSentence) {
    embed.addFields({
      name: "Example",
      value: truncate(`*${response.exampleSentence}*`, FIELD_MAX_LENGTH),
    });
  }

  if (response.exampleTranslation) {
    embed.addFields({
      name: "Example (English)",
      value: truncate(response.exampleTranslation, FIELD_MAX_LENGTH),
    });
  }

  if (response.linguisticNotes) {
    embed.addFields({
      name: "Linguistic Notes",
      value: truncate(response.linguisticNotes, FIELD_MAX_LENGTH),
    });
  }

  return embed;
}

export function buildVocabQuizEmbed(quiz: VocabQuizResponse): EmbedBuilder {
  const lang = languageName(quiz.language);

  return new EmbedBuilder()
    .setTitle(`Vocab Quiz — ${lang}`)
    .setDescription(`What does **${quiz.word}** mean?`)
    .setColor(EMBED_COLOR)
    .setTimestamp();
}

export function buildVocabListEmbed(entries: VocabListEntry[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Your Saved Vocabulary")
    .setColor(EMBED_COLOR)
    .setTimestamp();

  if (entries.length === 0) {
    embed.setDescription("Your vocabulary list is empty.");
    return embed;
  }

  const lines = entries.slice(0, 20).map((entry) => {
    const lang = languageName(entry.language);
    const accuracy = entry.reviewCount > 0
      ? `${Math.round((entry.correctCount / entry.reviewCount) * 100)}%`
      : "—";
    return `**${entry.word}** (${lang}) → ${entry.translation} | Reviews: ${entry.reviewCount} | Accuracy: ${accuracy}`;
  });

  embed.setDescription(truncate(lines.join("\n"), 4096));

  if (entries.length > 20) {
    embed.setFooter({ text: `Showing 20 of ${entries.length} words` });
  }

  return embed;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}
