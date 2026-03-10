const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";
const TIMEOUT_MS = 10_000;
const USER_AGENT = "DiscordDictionaryBot/1.0";

interface RawPhonetic {
  text?: string;
  audio?: string;
}

interface RawDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
}

interface RawMeaning {
  partOfSpeech: string;
  definitions: RawDefinition[];
  synonyms: string[];
}

export interface RawDictionaryEntry {
  word: string;
  phonetics: RawPhonetic[];
  meanings: RawMeaning[];
  sourceUrls: string[];
}

export class DictionaryAccessor {
  async lookupWord(word: string): Promise<RawDictionaryEntry[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(word)}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new Error(`No definitions found for "${word}".`);
      }

      if (!response.ok) {
        throw new Error(`Dictionary API returned HTTP ${response.status}.`);
      }

      return (await response.json()) as RawDictionaryEntry[];
    } finally {
      clearTimeout(timeout);
    }
  }
}
