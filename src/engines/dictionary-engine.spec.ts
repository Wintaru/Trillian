import { describe, it, expect, vi, beforeEach } from "vitest";
import { DictionaryEngine } from "./dictionary-engine.js";
import type { DictionaryAccessor, RawDictionaryEntry } from "../accessors/dictionary-accessor.js";

function createMockAccessor(): DictionaryAccessor {
  return {
    lookupWord: vi.fn(),
  } as unknown as DictionaryAccessor;
}

const mockEntry: RawDictionaryEntry = {
  word: "hello",
  phonetics: [
    { text: "/həˈloʊ/", audio: "https://example.com/hello.mp3" },
    { text: "/hɛˈloʊ/" },
  ],
  meanings: [
    {
      partOfSpeech: "noun",
      definitions: [
        {
          definition: "An utterance of \"hello\"; a greeting.",
          example: "She gave me a big hello.",
          synonyms: ["greeting"],
        },
      ],
      synonyms: ["greeting", "salutation"],
    },
    {
      partOfSpeech: "interjection",
      definitions: [
        {
          definition: "Used as a greeting.",
          synonyms: [],
        },
        {
          definition: "Used to express surprise.",
          example: "Hello! What's going on here?",
          synonyms: [],
        },
      ],
      synonyms: ["hi", "hey"],
    },
  ],
  sourceUrls: ["https://en.wiktionary.org/wiki/hello"],
};

describe("DictionaryEngine", () => {
  let accessor: DictionaryAccessor;
  let engine: DictionaryEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new DictionaryEngine(accessor);
  });

  it("should return a well-formed response from raw API data", async () => {
    vi.mocked(accessor.lookupWord).mockResolvedValue([mockEntry]);

    const result = await engine.define({ word: "hello" });

    expect(result.word).toBe("hello");
    expect(result.sourceUrl).toBe("https://en.wiktionary.org/wiki/hello");
    expect(result.meanings).toHaveLength(2);
    expect(result.meanings[0].partOfSpeech).toBe("noun");
    expect(result.meanings[1].partOfSpeech).toBe("interjection");
  });

  it("should throw for empty word input", async () => {
    await expect(engine.define({ word: "" })).rejects.toThrow("Please provide a word");
    await expect(engine.define({ word: "   " })).rejects.toThrow("Please provide a word");
  });

  it("should propagate accessor errors", async () => {
    vi.mocked(accessor.lookupWord).mockRejectedValue(
      new Error('No definitions found for "asdfgh".'),
    );

    await expect(engine.define({ word: "asdfgh" })).rejects.toThrow("No definitions found");
  });

  it("should pick the phonetic with both text and audio", async () => {
    vi.mocked(accessor.lookupWord).mockResolvedValue([mockEntry]);

    const result = await engine.define({ word: "hello" });

    expect(result.phonetic).toEqual({
      text: "/həˈloʊ/",
      audioUrl: "https://example.com/hello.mp3",
    });
  });

  it("should fall back to phonetic with text only when no audio available", async () => {
    const entryNoAudio: RawDictionaryEntry = {
      ...mockEntry,
      phonetics: [{ text: "/hɛˈloʊ/" }],
    };
    vi.mocked(accessor.lookupWord).mockResolvedValue([entryNoAudio]);

    const result = await engine.define({ word: "hello" });

    expect(result.phonetic).toEqual({ text: "/hɛˈloʊ/", audioUrl: "" });
  });

  it("should return null phonetic when none have text", async () => {
    const entryNoPhonetic: RawDictionaryEntry = {
      ...mockEntry,
      phonetics: [{ audio: "https://example.com/hello.mp3" }],
    };
    vi.mocked(accessor.lookupWord).mockResolvedValue([entryNoPhonetic]);

    const result = await engine.define({ word: "hello" });

    expect(result.phonetic).toBeNull();
  });

  it("should limit definitions to 3 per meaning", async () => {
    const manyDefs: RawDictionaryEntry = {
      ...mockEntry,
      meanings: [
        {
          partOfSpeech: "verb",
          definitions: [
            { definition: "Def 1", synonyms: [] },
            { definition: "Def 2", synonyms: [] },
            { definition: "Def 3", synonyms: [] },
            { definition: "Def 4", synonyms: [] },
            { definition: "Def 5", synonyms: [] },
          ],
          synonyms: [],
        },
      ],
    };
    vi.mocked(accessor.lookupWord).mockResolvedValue([manyDefs]);

    const result = await engine.define({ word: "test" });

    expect(result.meanings[0].definitions).toHaveLength(3);
  });

  it("should limit meanings to 4", async () => {
    const manyMeanings: RawDictionaryEntry = {
      ...mockEntry,
      meanings: Array.from({ length: 6 }, (_, i) => ({
        partOfSpeech: `pos-${i}`,
        definitions: [{ definition: `Def ${i}`, synonyms: [] }],
        synonyms: [],
      })),
    };
    vi.mocked(accessor.lookupWord).mockResolvedValue([manyMeanings]);

    const result = await engine.define({ word: "test" });

    expect(result.meanings).toHaveLength(4);
  });

  it("should deduplicate and limit synonyms", async () => {
    const dupSynonyms: RawDictionaryEntry = {
      ...mockEntry,
      meanings: [
        {
          partOfSpeech: "noun",
          definitions: [
            { definition: "Test", synonyms: ["a", "b", "c"] },
            { definition: "Test 2", synonyms: ["c", "d", "e", "f"] },
          ],
          synonyms: ["a", "b"],
        },
      ],
    };
    vi.mocked(accessor.lookupWord).mockResolvedValue([dupSynonyms]);

    const result = await engine.define({ word: "test" });

    expect(result.meanings[0].synonyms).toHaveLength(5);
    expect(new Set(result.meanings[0].synonyms).size).toBe(5);
  });

  it("should use Wiktionary fallback when no sourceUrls", async () => {
    const noSource: RawDictionaryEntry = {
      ...mockEntry,
      sourceUrls: [],
    };
    vi.mocked(accessor.lookupWord).mockResolvedValue([noSource]);

    const result = await engine.define({ word: "hello" });

    expect(result.sourceUrl).toBe("https://en.wiktionary.org/wiki/hello");
  });
});
