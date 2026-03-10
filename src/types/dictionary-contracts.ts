export interface DefineWordRequest {
  word: string;
}

export interface DictionaryPhonetic {
  text: string;
  audioUrl: string;
}

export interface DictionaryDefinition {
  definition: string;
  example: string;
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms: string[];
}

export interface DefineWordResponse {
  word: string;
  phonetic: DictionaryPhonetic | null;
  meanings: DictionaryMeaning[];
  sourceUrl: string;
}
