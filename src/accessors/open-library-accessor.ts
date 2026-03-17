import type { BookMetadata } from "../types/library-contracts.js";
import * as logger from "../utilities/logger.js";

const API_BASE = "https://openlibrary.org";
const COVERS_BASE = "https://covers.openlibrary.org/b/id";
const TIMEOUT_MS = 10_000;
const USER_AGENT = "TrillianDiscordBot/1.0";

// --- ISBN Extraction ---

/** Strip hyphens and whitespace from an ISBN string. */
function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** Validate an ISBN-10 check digit. */
function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * parseInt(isbn[i]!, 10);
  }
  const last = isbn[9]!.toUpperCase();
  sum += last === "X" ? 10 : parseInt(last, 10);
  return sum % 11 === 0;
}

/** Validate an ISBN-13 check digit. */
function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn[i]!, 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(isbn[12]!, 10);
}

/** Convert ISBN-10 to ISBN-13. */
function isbn10to13(isbn10: string): string {
  const base = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]!, 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

/**
 * Extract an ISBN from a raw string — either a bare ISBN or a URL containing one.
 * Returns a normalized ISBN-13, or null if none found.
 */
export function extractIsbn(input: string): string | null {
  const trimmed = input.trim();

  // Try as bare ISBN (with optional hyphens)
  const bare = cleanIsbn(trimmed);
  if (isValidIsbn13(bare)) return bare;
  if (isValidIsbn10(bare)) return isbn10to13(bare);

  // Try to parse as URL
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Amazon: /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
  const amazonDp = url.pathname.match(/\/dp\/(\w{10})\b/);
  if (amazonDp) {
    const candidate = amazonDp[1]!;
    if (isValidIsbn10(candidate)) return isbn10to13(candidate);
  }
  const amazonGp = url.pathname.match(/\/gp\/product\/(\w{10})\b/);
  if (amazonGp) {
    const candidate = amazonGp[1]!;
    if (isValidIsbn10(candidate)) return isbn10to13(candidate);
  }

  // Open Library: /isbn/XXXXXXXXXXXXX
  const openLib = url.pathname.match(/\/isbn\/(\d{10,13})\b/);
  if (openLib) {
    const candidate = cleanIsbn(openLib[1]!);
    if (isValidIsbn13(candidate)) return candidate;
    if (isValidIsbn10(candidate)) return isbn10to13(candidate);
  }

  // Google Books: ?isbn=XXXXXXXXXXXXX
  const googleIsbn = url.searchParams.get("isbn");
  if (googleIsbn) {
    const candidate = cleanIsbn(googleIsbn);
    if (isValidIsbn13(candidate)) return candidate;
    if (isValidIsbn10(candidate)) return isbn10to13(candidate);
  }

  // Barnes & Noble: ?ean=XXXXXXXXXXXXX
  const bnEan = url.searchParams.get("ean");
  if (bnEan) {
    const candidate = cleanIsbn(bnEan);
    if (isValidIsbn13(candidate)) return candidate;
  }

  // Generic: scan the full URL for ISBN-13 then ISBN-10 patterns
  const fullUrl = trimmed;
  const isbn13Matches = fullUrl.match(/\b(\d{13})\b/g);
  if (isbn13Matches) {
    for (const match of isbn13Matches) {
      if (isValidIsbn13(match)) return match;
    }
  }
  const isbn10Matches = fullUrl.match(/\b(\d{9}[\dXx])\b/g);
  if (isbn10Matches) {
    for (const match of isbn10Matches) {
      if (isValidIsbn10(match)) return isbn10to13(match);
    }
  }

  return null;
}

// --- Open Library API ---

interface RawOpenLibraryBook {
  title?: string;
  authors?: { key: string }[];
  covers?: number[];
  description?: string | { value: string };
  number_of_pages?: number;
  publish_date?: string;
  subjects?: string[];
}

interface RawOpenLibraryAuthor {
  name?: string;
}

interface GoogleBooksResponse {
  totalItems: number;
  items?: {
    volumeInfo?: {
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }[];
}

export class OpenLibraryAccessor {
  private async fetchJson<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });

      if (response.status === 404) return null;

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Open Library API returned HTTP ${response.status}: ${body}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchGoogleBooksCover(isbn: string): Promise<string> {
    try {
      const data = await this.fetchJson<GoogleBooksResponse>(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
      );
      const thumbnail = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      if (!thumbnail) return "";
      // Upgrade to larger image and use HTTPS
      return thumbnail.replace("zoom=1", "zoom=0").replace("http://", "https://");
    } catch (err) {
      logger.warn(`Google Books cover lookup failed for ${isbn}:`, err);
      return "";
    }
  }

  async lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
    const data = await this.fetchJson<RawOpenLibraryBook>(`${API_BASE}/isbn/${isbn}.json`);
    if (!data) return null;

    // Resolve author names
    let author = "Unknown Author";
    if (data.authors && data.authors.length > 0) {
      const authorNames: string[] = [];
      for (const ref of data.authors) {
        try {
          const authorData = await this.fetchJson<RawOpenLibraryAuthor>(`${API_BASE}${ref.key}.json`);
          if (authorData?.name) authorNames.push(authorData.name);
        } catch (err) {
          logger.warn(`Failed to resolve author ${ref.key}:`, err);
        }
      }
      if (authorNames.length > 0) author = authorNames.join(", ");
    }

    // Cover URL — prefer Open Library cover ID, then Google Books, then ISBN-based fallback
    let coverUrl = "";
    if (data.covers && data.covers.length > 0) {
      coverUrl = `${COVERS_BASE}/${data.covers[0]}-L.jpg`;
    }
    if (!coverUrl) {
      coverUrl = await this.fetchGoogleBooksCover(isbn);
    }
    if (!coverUrl) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    }

    // Description
    let description = "";
    if (typeof data.description === "string") {
      description = data.description;
    } else if (data.description && typeof data.description === "object") {
      description = data.description.value;
    }

    // Publish year
    let publishYear = 0;
    if (data.publish_date) {
      const yearMatch = data.publish_date.match(/\d{4}/);
      if (yearMatch) publishYear = parseInt(yearMatch[0], 10);
    }

    // Genres/subjects (take first 5)
    const genres = (data.subjects ?? []).slice(0, 5);

    return {
      isbn,
      title: data.title ?? "Unknown Title",
      author,
      coverUrl,
      description,
      pageCount: data.number_of_pages ?? 0,
      publishYear,
      genres,
    };
  }
}
