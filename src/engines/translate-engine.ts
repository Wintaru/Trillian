import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { DeeplAccessor } from "../accessors/deepl-accessor.js";
import type {
  TranslateRequest,
  TranslateResponse,
  OllamaTranslation,
  DeeplTranslation,
} from "../types/translate-contracts.js";

const LANGUAGE_NAMES: Record<string, string> = {
  AR: "Arabic",
  BG: "Bulgarian",
  CS: "Czech",
  DA: "Danish",
  DE: "German",
  EL: "Greek",
  EN: "English",
  ES: "Spanish",
  ET: "Estonian",
  FI: "Finnish",
  FR: "French",
  HU: "Hungarian",
  ID: "Indonesian",
  IT: "Italian",
  JA: "Japanese",
  KO: "Korean",
  LT: "Lithuanian",
  LV: "Latvian",
  NB: "Norwegian",
  NL: "Dutch",
  PL: "Polish",
  PT: "Portuguese",
  RO: "Romanian",
  RU: "Russian",
  SK: "Slovak",
  SL: "Slovenian",
  SV: "Swedish",
  TR: "Turkish",
  UK: "Ukrainian",
  ZH: "Chinese",
};

function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toUpperCase()] ?? code;
}

const DETECT_PROMPT = [
  "Identify the language of the following text.",
  "Respond with ONLY the ISO 639-1 language code in uppercase (e.g. EN, ES, FR, DE, JA).",
  "Do not include any other text.",
].join(" ");

function parseDetectedLanguage(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (code.length === 2 && LANGUAGE_NAMES[code]) {
    return code;
  }
  return null;
}

function buildSystemPrompt(fromLang: string | null, toLang: string): string {
  const source = fromLang ? languageName(fromLang) : "the detected language";
  const target = languageName(toLang);

  return [
    `You are a professional translator and language tutor.`,
    `Translate the user's text from ${source} to ${target}.`,
    ``,
    `Respond EXACTLY in this format (keep the labels on their own lines):`,
    `TRANSLATION: <translated text>`,
    `EXPLANATION: <1-3 sentences about grammar, vocabulary choices, idioms, or cultural context that would help a learner>`,
  ].join("\n");
}

function parseOllamaResponse(raw: string): OllamaTranslation {
  const translationMatch = raw.match(/TRANSLATION:\s*(.+?)(?:\nEXPLANATION:|\n*$)/s);
  const explanationMatch = raw.match(/EXPLANATION:\s*(.+)/s);

  if (translationMatch?.[1]?.trim()) {
    return {
      translatedText: translationMatch[1].trim(),
      explanation: explanationMatch?.[1]?.trim() ?? "",
    };
  }

  return { translatedText: raw.trim(), explanation: "" };
}

export class TranslateEngine {
  constructor(
    private readonly ollamaAccessor: OllamaAccessor,
    private readonly deeplAccessor: DeeplAccessor | null,
  ) {}

  async translate(request: TranslateRequest): Promise<TranslateResponse> {
    const text = request.text.trim();
    if (!text) {
      throw new Error("Please provide text to translate.");
    }

    let toLang = request.toLang.toUpperCase();
    let fromLang = request.fromLang?.toUpperCase() ?? null;

    if (!fromLang) {
      const detected = await this.detectLanguage(text);
      if (detected) {
        fromLang = detected;
        if (detected === toLang) {
          toLang = "EN";
        }
      }
    }

    const ollamaPromise = this.translateWithOllama(text, fromLang, toLang);
    const deeplPromise = this.deeplAccessor
      ? this.translateWithDeepl(text, fromLang, toLang)
      : Promise.resolve(null);

    const [ollamaResult, deeplResult] = await Promise.allSettled([
      ollamaPromise,
      deeplPromise,
    ]);

    const ollama = ollamaResult.status === "fulfilled" ? ollamaResult.value : null;
    let deepl = deeplResult.status === "fulfilled" ? deeplResult.value : null;

    // Discard DeepL result if it detected the same language as the target —
    // this means it was asked to "translate" a language into itself, producing garbage.
    if (deepl && deepl.detectedSourceLang === toLang) {
      deepl = null;
    }

    if (!ollama && !deepl) {
      throw new Error("Translation failed: both providers are unavailable.");
    }

    return {
      originalText: text,
      fromLang,
      toLang,
      ollama,
      deepl,
    };
  }

  private async detectLanguage(text: string): Promise<string | null> {
    try {
      const raw = await this.ollamaAccessor.chat([
        { role: "system", content: DETECT_PROMPT },
        { role: "user", content: text },
      ]);
      return parseDetectedLanguage(raw);
    } catch {
      return null;
    }
  }

  private async translateWithOllama(
    text: string,
    fromLang: string | null,
    toLang: string,
  ): Promise<OllamaTranslation> {
    const systemPrompt = buildSystemPrompt(fromLang, toLang);
    const raw = await this.ollamaAccessor.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);
    return parseOllamaResponse(raw);
  }

  private async translateWithDeepl(
    text: string,
    fromLang: string | null,
    toLang: string,
  ): Promise<DeeplTranslation> {
    const response = await this.deeplAccessor!.translate(
      text,
      toLang,
      fromLang ?? undefined,
    );
    const entry = response.translations[0];
    return {
      translatedText: entry.text,
      detectedSourceLang: entry.detected_source_language,
    };
  }
}

export { languageName, buildSystemPrompt, parseOllamaResponse, parseDetectedLanguage };
