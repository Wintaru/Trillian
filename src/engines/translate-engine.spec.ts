import { describe, it, expect, vi, beforeEach } from "vitest";
import { TranslateEngine, parseOllamaResponse } from "./translate-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { DeeplAccessor } from "../accessors/deepl-accessor.js";

function createMockOllama(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function createMockDeepl(): DeeplAccessor {
  return { translate: vi.fn() } as unknown as DeeplAccessor;
}

const OLLAMA_STRUCTURED_RESPONSE = [
  "TRANSLATION: Hola mundo",
  "EXPLANATION: 'Hola' is the standard Spanish greeting. 'Mundo' means 'world'.",
].join("\n");

const DEEPL_RESPONSE = {
  translations: [{ detected_source_language: "EN", text: "Hola mundo" }],
};

describe("TranslateEngine", () => {
  let ollama: OllamaAccessor;
  let deepl: DeeplAccessor;
  let engine: TranslateEngine;

  beforeEach(() => {
    ollama = createMockOllama();
    deepl = createMockDeepl();
    engine = new TranslateEngine(ollama, deepl);
  });

  it("should return both translations when both providers succeed", async () => {
    vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_STRUCTURED_RESPONSE);
    vi.mocked(deepl.translate).mockResolvedValue(DEEPL_RESPONSE);

    const result = await engine.translate({ text: "Hello world", fromLang: null, toLang: "ES" });

    expect(result.ollama).not.toBeNull();
    expect(result.ollama!.translatedText).toBe("Hola mundo");
    expect(result.ollama!.explanation).toContain("Hola");
    expect(result.deepl).not.toBeNull();
    expect(result.deepl!.translatedText).toBe("Hola mundo");
    expect(result.deepl!.detectedSourceLang).toBe("EN");
  });

  it("should return ollama only when DeepL fails", async () => {
    vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_STRUCTURED_RESPONSE);
    vi.mocked(deepl.translate).mockRejectedValue(new Error("DeepL down"));

    const result = await engine.translate({ text: "Hello", fromLang: null, toLang: "ES" });

    expect(result.ollama).not.toBeNull();
    expect(result.deepl).toBeNull();
  });

  it("should return DeepL only when Ollama fails", async () => {
    vi.mocked(ollama.chat).mockRejectedValue(new Error("Ollama down"));
    vi.mocked(deepl.translate).mockResolvedValue(DEEPL_RESPONSE);

    const result = await engine.translate({ text: "Hello", fromLang: null, toLang: "ES" });

    expect(result.ollama).toBeNull();
    expect(result.deepl).not.toBeNull();
  });

  it("should throw when both providers fail", async () => {
    vi.mocked(ollama.chat).mockRejectedValue(new Error("Ollama down"));
    vi.mocked(deepl.translate).mockRejectedValue(new Error("DeepL down"));

    await expect(
      engine.translate({ text: "Hello", fromLang: null, toLang: "ES" }),
    ).rejects.toThrow("both providers are unavailable");
  });

  it("should work with no DeepL accessor", async () => {
    const ollamaOnly = new TranslateEngine(ollama, null);
    vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_STRUCTURED_RESPONSE);

    const result = await ollamaOnly.translate({ text: "Hello", fromLang: null, toLang: "ES" });

    expect(result.ollama).not.toBeNull();
    expect(result.deepl).toBeNull();
  });

  it("should throw for empty text", async () => {
    await expect(
      engine.translate({ text: "", fromLang: null, toLang: "ES" }),
    ).rejects.toThrow("Please provide text to translate");

    await expect(
      engine.translate({ text: "   ", fromLang: null, toLang: "ES" }),
    ).rejects.toThrow("Please provide text to translate");
  });

  it("should uppercase language codes", async () => {
    vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_STRUCTURED_RESPONSE);
    vi.mocked(deepl.translate).mockResolvedValue(DEEPL_RESPONSE);

    const result = await engine.translate({ text: "Hello", fromLang: "en", toLang: "es" });

    expect(result.fromLang).toBe("EN");
    expect(result.toLang).toBe("ES");
    expect(vi.mocked(deepl.translate)).toHaveBeenCalledWith("Hello", "ES", "EN");
  });

  it("should pass fromLang as undefined to DeepL when null", async () => {
    vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_STRUCTURED_RESPONSE);
    vi.mocked(deepl.translate).mockResolvedValue(DEEPL_RESPONSE);

    await engine.translate({ text: "Hello", fromLang: null, toLang: "ES" });

    expect(vi.mocked(deepl.translate)).toHaveBeenCalledWith("Hello", "ES", undefined);
  });

  it("should preserve original text in response", async () => {
    vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_STRUCTURED_RESPONSE);

    const result = await new TranslateEngine(ollama, null).translate({
      text: "Hello world",
      fromLang: null,
      toLang: "ES",
    });

    expect(result.originalText).toBe("Hello world");
  });
});

describe("parseOllamaResponse", () => {
  it("should parse structured response with both labels", () => {
    const result = parseOllamaResponse(OLLAMA_STRUCTURED_RESPONSE);

    expect(result.translatedText).toBe("Hola mundo");
    expect(result.explanation).toContain("Hola");
  });

  it("should handle translation with no explanation", () => {
    const result = parseOllamaResponse("TRANSLATION: Hola mundo");

    expect(result.translatedText).toBe("Hola mundo");
    expect(result.explanation).toBe("");
  });

  it("should fall back to raw text when format not followed", () => {
    const result = parseOllamaResponse("Hola mundo");

    expect(result.translatedText).toBe("Hola mundo");
    expect(result.explanation).toBe("");
  });

  it("should handle multiline translations", () => {
    const raw = [
      "TRANSLATION: Línea uno",
      "Línea dos",
      "EXPLANATION: This has multiple lines in the translation.",
    ].join("\n");

    const result = parseOllamaResponse(raw);

    expect(result.translatedText).toContain("Línea uno");
    expect(result.translatedText).toContain("Línea dos");
    expect(result.explanation).toContain("multiple lines");
  });
});
