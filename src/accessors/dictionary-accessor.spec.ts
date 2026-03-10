import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DictionaryAccessor } from "./dictionary-accessor.js";

const mockEntry = {
  word: "hello",
  phonetics: [{ text: "/həˈloʊ/" }],
  meanings: [
    {
      partOfSpeech: "interjection",
      definitions: [{ definition: "Used as a greeting.", synonyms: [] }],
      synonyms: [],
    },
  ],
  sourceUrls: ["https://en.wiktionary.org/wiki/hello"],
};

describe("DictionaryAccessor", () => {
  let accessor: DictionaryAccessor;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    accessor = new DictionaryAccessor();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return parsed entries on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [mockEntry],
    } as Response);

    const result = await accessor.lookupWord("hello");

    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("hello");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/hello",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": "DiscordDictionaryBot/1.0" }),
      }),
    );
  });

  it("should throw a friendly error on 404", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(accessor.lookupWord("xyzzyplugh")).rejects.toThrow(
      'No definitions found for "xyzzyplugh"',
    );
  });

  it("should throw on other HTTP errors", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(accessor.lookupWord("hello")).rejects.toThrow("HTTP 500");
  });

  it("should encode special characters in the word", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [mockEntry],
    } as Response);

    await accessor.lookupWord("café");

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining("caf%C3%A9"),
      expect.anything(),
    );
  });
});
