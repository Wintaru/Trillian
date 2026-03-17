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

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  pageCount?: number;
  publishedDate?: string;
  categories?: string[];
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
}

interface GoogleBooksResponse {
  totalItems: number;
  items?: {
    volumeInfo?: GoogleBooksVolumeInfo;
  }[];
}

export class OpenLibraryAccessor {
  private googleBooksApiKey: string | undefined;

  constructor(googleBooksApiKey?: string) {
    this.googleBooksApiKey = googleBooksApiKey;
  }

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
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchGoogleBooksVolume(isbn: string): Promise<GoogleBooksVolumeInfo | null> {
    try {
      let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`;
      if (this.googleBooksApiKey) {
        url += `&key=${this.googleBooksApiKey}`;
      }
      const data = await this.fetchJson<GoogleBooksResponse>(url);
      return data?.items?.[0]?.volumeInfo ?? null;
    } catch (err) {
      logger.warn(`Google Books lookup failed for ${isbn}:`, err);
      return null;
    }
  }

  private googleCoverUrl(volume: GoogleBooksVolumeInfo): string {
    const thumbnail = volume.imageLinks?.thumbnail;
    if (!thumbnail) return "";
    return thumbnail.replace("zoom=1", "zoom=0").replace("http://", "https://");
  }

  /** Fetch image bytes from a URL. Returns null if it fails or looks like a placeholder (< 5KB). */
  private async fetchImageBytes(url: string): Promise<Buffer | null> {
    if (!url) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) return null;

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      // Reject tiny images — likely placeholders
      if (buffer.length < 5000) return null;
      return buffer;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Try to scrape a cover image URL from Goodreads for the given ISBN. */
  private async fetchGoodreadsCoverUrl(isbn: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(`https://www.goodreads.com/book/isbn/${isbn}`, {
          headers: { "User-Agent": USER_AGENT },
          signal: controller.signal,
          redirect: "follow",
        });
        if (!response.ok) return "";

        const html = await response.text();
        // Look for og:image meta tag
        const ogMatch = html.match(/<meta\s[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (ogMatch?.[1]) return ogMatch[1];

        // Look for the responsive cover image
        const imgMatch = html.match(/https:\/\/[^"'\s]+compressed\.photo\.goodreads\.com\/books[^"'\s]+/);
        if (imgMatch?.[0]) return imgMatch[0];
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Non-fatal
    }
    return "";
  }

  /**
   * Try multiple sources to get a real cover image for the given ISBN.
   * Returns the image bytes or null.
   */
  async fetchCoverImage(isbn: string, coverUrl: string): Promise<Buffer | null> {
    // 1. Try the provided cover URL (Open Library or Google Books)
    const fromUrl = await this.fetchImageBytes(coverUrl);
    if (fromUrl) return fromUrl;

    // 2. Try Open Library ISBN-based cover
    const olCover = await this.fetchImageBytes(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);
    if (olCover) return olCover;

    // 3. Try Goodreads
    const goodreadsUrl = await this.fetchGoodreadsCoverUrl(isbn);
    if (goodreadsUrl) {
      const fromGoodreads = await this.fetchImageBytes(goodreadsUrl);
      if (fromGoodreads) return fromGoodreads;
    }

    // 4. Try Google Books
    const gVolume = await this.fetchGoogleBooksVolume(isbn);
    if (gVolume) {
      const gUrl = this.googleCoverUrl(gVolume);
      const fromGoogle = await this.fetchImageBytes(gUrl);
      if (fromGoogle) return fromGoogle;
    }

    return null;
  }

  async lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
    const data = await this.fetchJson<RawOpenLibraryBook>(`${API_BASE}/isbn/${isbn}.json`);

    // If Open Library doesn't have this book, fall back to Google Books entirely
    if (!data) {
      return this.lookupByIsbnGoogleBooks(isbn);
    }

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
      const gVolume = await this.fetchGoogleBooksVolume(isbn);
      if (gVolume) coverUrl = this.googleCoverUrl(gVolume);
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

    // Fetch actual cover image bytes
    const coverImage = await this.fetchCoverImage(isbn, coverUrl);

    return {
      isbn,
      title: data.title ?? "Unknown Title",
      author,
      coverUrl,
      coverImage,
      description,
      pageCount: data.number_of_pages ?? 0,
      publishYear,
      genres,
    };
  }

  private async lookupByIsbnGoogleBooks(isbn: string): Promise<BookMetadata | null> {
    const volume = await this.fetchGoogleBooksVolume(isbn);
    if (!volume?.title) return null;

    logger.info(`Library: Open Library miss for ISBN ${isbn}, using Google Books fallback`);

    let publishYear = 0;
    if (volume.publishedDate) {
      const yearMatch = volume.publishedDate.match(/\d{4}/);
      if (yearMatch) publishYear = parseInt(yearMatch[0], 10);
    }

    const coverUrl = this.googleCoverUrl(volume);
    const coverImage = await this.fetchCoverImage(isbn, coverUrl);

    return {
      isbn,
      title: volume.title,
      author: volume.authors?.join(", ") ?? "Unknown Author",
      coverUrl,
      coverImage,
      description: volume.description ?? "",
      pageCount: volume.pageCount ?? 0,
      publishYear,
      genres: (volume.categories ?? []).slice(0, 5),
    };
  }
}
