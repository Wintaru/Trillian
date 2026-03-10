export interface TranslateRequest {
  text: string;
  fromLang: string | null;
  toLang: string;
}

export interface OllamaTranslation {
  translatedText: string;
  explanation: string;
}

export interface DeeplTranslation {
  translatedText: string;
  detectedSourceLang: string;
}

export interface TranslateResponse {
  originalText: string;
  fromLang: string | null;
  toLang: string;
  ollama: OllamaTranslation | null;
  deepl: DeeplTranslation | null;
}
