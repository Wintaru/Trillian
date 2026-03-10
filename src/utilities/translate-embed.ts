import { EmbedBuilder } from "discord.js";
import type { TranslateResponse } from "../types/translate-contracts.js";
import { languageName } from "../engines/translate-engine.js";
import { pronunciationMarkdown } from "./pronunciation.js";

const EMBED_COLOR = 0x5865f2;
const FIELD_MAX_LENGTH = 1024;

export function buildTranslateEmbed(response: TranslateResponse): EmbedBuilder {
  const targetName = languageName(response.toLang);
  const title = response.fromLang
    ? `Translation — ${languageName(response.fromLang)} → ${targetName}`
    : `Translation → ${targetName}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(EMBED_COLOR)
    .setTimestamp();

  const sourceLang = response.fromLang ?? response.deepl?.detectedSourceLang ?? null;
  const originalHear = sourceLang
    ? ` — ${pronunciationMarkdown(response.originalText, sourceLang)}`
    : "";
  embed.addFields({
    name: "Original",
    value: truncate(`${response.originalText}${originalHear}`, FIELD_MAX_LENGTH),
  });

  if (response.ollama) {
    const hearLink = pronunciationMarkdown(response.ollama.translatedText, response.toLang);
    embed.addFields({
      name: "Translation (AI)",
      value: truncate(`${response.ollama.translatedText} — ${hearLink}`, FIELD_MAX_LENGTH),
    });

    if (response.ollama.explanation) {
      embed.addFields({
        name: "Linguistic Notes",
        value: truncate(response.ollama.explanation, FIELD_MAX_LENGTH),
      });
    }
  }

  if (response.deepl) {
    const hearLink = pronunciationMarkdown(response.deepl.translatedText, response.toLang);
    embed.addFields({
      name: "Translation (DeepL)",
      value: truncate(`${response.deepl.translatedText} — ${hearLink}`, FIELD_MAX_LENGTH),
    });
  }

  const footerParts: string[] = [];
  if (response.ollama && response.deepl) {
    footerParts.push("AI + DeepL");
  } else if (response.ollama) {
    footerParts.push("AI only");
  } else {
    footerParts.push("DeepL only");
  }

  if (!response.fromLang && response.deepl?.detectedSourceLang) {
    footerParts.push(
      `Detected: ${languageName(response.deepl.detectedSourceLang)}`,
    );
  }

  embed.setFooter({ text: footerParts.join(" · ") });

  return embed;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}
