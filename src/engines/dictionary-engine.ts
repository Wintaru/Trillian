import type { DictionaryAccessor, RawDictionaryEntry } from "../accessors/dictionary-accessor.js";
import type {
  DefineWordRequest,
  DefineWordResponse,
  DictionaryMeaning,
  DictionaryPhonetic,
} from "../types/dictionary-contracts.js";

const MAX_MEANINGS = 4;
const MAX_DEFINITIONS_PER_MEANING = 3;
const MAX_SYNONYMS = 5;

export class DictionaryEngine {
  constructor(private dictionaryAccessor: DictionaryAccessor) {}

  async define(request: DefineWordRequest): Promise<DefineWordResponse> {
    const word = request.word.trim();
    if (!word) {
      throw new Error("Please provide a word to define.");
    }

    const entries = await this.dictionaryAccessor.lookupWord(word);
    return this.transformEntry(entries[0]);
  }

  private transformEntry(entry: RawDictionaryEntry): DefineWordResponse {
    return {
      word: entry.word,
      phonetic: this.pickPhonetic(entry),
      meanings: this.transformMeanings(entry),
      sourceUrl: entry.sourceUrls[0] ?? `https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word)}`,
    };
  }

  private pickPhonetic(entry: RawDictionaryEntry): DictionaryPhonetic | null {
    const withBoth = entry.phonetics.find((p) => p.text && p.audio);
    const withText = entry.phonetics.find((p) => p.text);
    const best = withBoth ?? withText;
    if (!best?.text) return null;
    return { text: best.text, audioUrl: best.audio ?? "" };
  }

  private transformMeanings(entry: RawDictionaryEntry): DictionaryMeaning[] {
    return entry.meanings.slice(0, MAX_MEANINGS).map((m) => {
      const defSynonyms = m.definitions.flatMap((d) => d.synonyms);
      const allSynonyms = [...new Set([...m.synonyms, ...defSynonyms])].slice(0, MAX_SYNONYMS);

      return {
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions.slice(0, MAX_DEFINITIONS_PER_MEANING).map((d) => ({
          definition: d.definition,
          example: d.example ?? "",
        })),
        synonyms: allSynonyms,
      };
    });
  }
}
