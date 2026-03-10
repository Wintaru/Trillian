const API_BASE = "https://api-free.deepl.com/v2/translate";
const TIMEOUT_MS = 10_000;

export interface RawDeeplResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

export class DeeplAccessor {
  constructor(private readonly apiKey: string) {}

  async translate(
    text: string,
    targetLang: string,
    sourceLang?: string,
  ): Promise<RawDeeplResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const body: Record<string, unknown> = {
        text: [text],
        target_lang: targetLang,
      };
      if (sourceLang) {
        body["source_lang"] = sourceLang;
      }

      const response = await fetch(API_BASE, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`DeepL API returned HTTP ${response.status}.`);
      }

      return (await response.json()) as RawDeeplResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
