/**
 * Generates pronunciation URLs for words and phrases.
 *
 * Single words use Forvo (real human pronunciations).
 * Multi-word phrases use Google Translate (text-to-speech via speaker icon).
 */

const FORVO_LANG_CODES: Record<string, string> = {
  AR: "ar",
  BG: "bg",
  CS: "cs",
  DA: "da",
  DE: "de",
  EL: "el",
  EN: "en",
  ES: "es",
  ET: "et",
  FI: "fi",
  FR: "fr",
  HU: "hu",
  ID: "id",
  IT: "it",
  JA: "ja",
  KO: "ko",
  LT: "lt",
  LV: "lv",
  NB: "no",
  NL: "nl",
  PL: "pl",
  PT: "pt",
  RO: "ro",
  RU: "ru",
  SK: "sk",
  SL: "sl",
  SV: "sv",
  TR: "tr",
  UK: "uk",
  ZH: "zh",
};

function isPhrase(text: string): boolean {
  return text.trim().includes(" ");
}

function buildForvoUrl(word: string, language: string): string {
  const lang = FORVO_LANG_CODES[language.toUpperCase()] ?? language.toLowerCase();
  const encoded = encodeURIComponent(word.trim().toLowerCase());
  return `https://forvo.com/word/${encoded}/${lang}/`;
}

function buildGoogleTranslateUrl(text: string, language: string): string {
  const lang = FORVO_LANG_CODES[language.toUpperCase()] ?? language.toLowerCase();
  const encoded = encodeURIComponent(text.trim());
  return `https://translate.google.com/?sl=${lang}&tl=en&text=${encoded}&op=translate`;
}

export function pronunciationUrl(text: string, language: string): string {
  return isPhrase(text)
    ? buildGoogleTranslateUrl(text, language)
    : buildForvoUrl(text, language);
}

export function pronunciationMarkdown(text: string, language: string): string {
  const url = pronunciationUrl(text, language);
  const label = isPhrase(text) ? "Hear it" : "Hear it";
  return `[${label}](${url})`;
}
