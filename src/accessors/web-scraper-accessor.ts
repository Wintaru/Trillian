import * as logger from "../utilities/logger.js";

const TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 512_000; // 512 KB — enough for recipe content
const USER_AGENT = "Trillian-Bot/1.0 (recipe scraper)";

export interface ScrapedPage {
  url: string;
  text: string;
  jsonLdRecipe: JsonLdRecipe | null;
}

export interface JsonLdRecipe {
  name: string;
  recipeIngredient: string[];
  recipeInstructions: string;
  url?: string;
}

export class WebScraperAccessor {
  async fetchPage(url: string): Promise<ScrapedPage | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!response.ok) {
        logger.warn(`Web scraper: ${url} returned ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        logger.warn(`Web scraper: ${url} returned non-HTML content type: ${contentType}`);
        return null;
      }

      const body = await this.readLimited(response, MAX_BODY_BYTES);
      const jsonLdRecipe = this.extractJsonLdRecipe(body);
      const text = this.extractText(body);

      return { url, text, jsonLdRecipe };
    } catch (error) {
      logger.warn(`Web scraper: failed to fetch ${url}:`, error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readLimited(response: Response, maxBytes: number): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
    }

    reader.cancel().catch(() => {});
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(Buffer.concat(chunks).subarray(0, maxBytes));
  }

  private extractJsonLdRecipe(html: string): JsonLdRecipe | null {
    // Find all <script type="application/ld+json"> blocks
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const recipe = this.findRecipeInJsonLd(data);
        if (recipe) return recipe;
      } catch {
        // Invalid JSON — skip
      }
    }

    return null;
  }

  private findRecipeInJsonLd(data: unknown): JsonLdRecipe | null {
    if (!data || typeof data !== "object") return null;

    // Handle arrays (e.g. @graph)
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findRecipeInJsonLd(item);
        if (found) return found;
      }
      return null;
    }

    const obj = data as Record<string, unknown>;

    // Check @graph array
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"]) {
        const found = this.findRecipeInJsonLd(item);
        if (found) return found;
      }
    }

    // Check if this object is a Recipe
    const type = obj["@type"];
    const isRecipe =
      type === "Recipe" ||
      (Array.isArray(type) && type.includes("Recipe"));

    if (!isRecipe) return null;

    const name = typeof obj["name"] === "string" ? obj["name"] : "Untitled Recipe";
    const ingredients = Array.isArray(obj["recipeIngredient"])
      ? (obj["recipeIngredient"] as unknown[]).filter((i): i is string => typeof i === "string")
      : [];

    let instructions = "";
    if (typeof obj["recipeInstructions"] === "string") {
      instructions = obj["recipeInstructions"];
    } else if (Array.isArray(obj["recipeInstructions"])) {
      instructions = (obj["recipeInstructions"] as unknown[])
        .map((step) => {
          if (typeof step === "string") return step;
          if (step && typeof step === "object" && "text" in step) {
            return (step as Record<string, unknown>)["text"];
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    return {
      name,
      recipeIngredient: ingredients,
      recipeInstructions: instructions,
      url: typeof obj["url"] === "string" ? obj["url"] : undefined,
    };
  }

  private extractText(html: string): string {
    // Strip script/style tags and their contents
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    // Strip HTML tags
    text = text.replace(/<[^>]+>/g, " ");
    // Decode common HTML entities
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, " ");
    // Collapse whitespace
    text = text.replace(/\s+/g, " ").trim();
    // Limit to ~4000 chars to keep Ollama prompts reasonable
    return text.slice(0, 4000);
  }
}
