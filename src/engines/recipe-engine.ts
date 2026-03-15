import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { RecipeAccessor } from "../accessors/recipe-accessor.js";
import type { WebScraperAccessor } from "../accessors/web-scraper-accessor.js";
import type {
  ParseRecipeRequest,
  ParseRecipeResponse,
  ParsedRecipe,
  RecipeListRequest,
  RecipeListResponse,
  RecipeSearchRequest,
  RecipeSearchResponse,
  RecipeDetailRequest,
  RecipeDetailResponse,
} from "../types/recipe-contracts.js";
import * as logger from "../utilities/logger.js";

const URL_REGEX = /https?:\/\/[^\s<>]+/gi;

const PARSE_PROMPT = `You are a recipe parser. Analyze the following message and determine if it contains a recipe.

If it IS a recipe, extract the structured data and respond with ONLY valid JSON (no markdown fences):
{
  "isRecipe": true,
  "title": "Recipe Name",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount and unit" }
  ],
  "instructions": "Step-by-step instructions as a single string",
  "sourceUrl": "URL if one is included, otherwise null"
}

If it is NOT a recipe (just a chat message, question, etc.), respond with ONLY:
{"isRecipe": false}

Rules:
- Ingredient names should be the base ingredient (e.g. "chicken breast" not "2 lbs boneless skinless chicken breast")
- Quantities should include amount and unit (e.g. "2 lbs", "1 cup", "3 cloves")
- If a quantity is not specified, set quantity to null
- Instructions should preserve the original step ordering
- Be generous in detecting recipes — if someone shares ingredients and cooking steps, it's a recipe even without a formal title`;

export class RecipeEngine {
  constructor(
    private ollamaAccessor: OllamaAccessor,
    private recipeAccessor: RecipeAccessor,
    private webScraper: WebScraperAccessor,
  ) {}

  async parseAndStore(request: ParseRecipeRequest): Promise<ParseRecipeResponse> {
    const isDuplicate = await this.recipeAccessor.hasMessageRecipe(request.messageId);
    if (isDuplicate) {
      logger.debug(`Recipe skip (duplicate): message ${request.messageId} already processed`);
      return { saved: false, recipeId: null, title: null, reason: "duplicate" };
    }

    logger.debug(`Recipe: processing message ${request.messageId}...`);

    // Check if the message contains URLs — if so, try to fetch page content
    const contentForParsing = await this.resolveContent(request.messageContent);

    let parsed: ParsedRecipe & { isRecipe: boolean };
    try {
      const response = await this.ollamaAccessor.chat([
        { role: "system", content: PARSE_PROMPT },
        { role: "user", content: contentForParsing },
      ]);

      const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (error) {
      logger.error("Failed to parse recipe from message:", error);
      return { saved: false, recipeId: null, title: null, reason: "parse_error" };
    }

    if (!parsed.isRecipe) {
      logger.debug(`Recipe skip (not a recipe): message ${request.messageId}`);
      return { saved: false, recipeId: null, title: null, reason: "not_a_recipe" };
    }

    // Validate required fields before inserting
    if (!parsed.title || !parsed.instructions) {
      logger.warn(`Recipe: isRecipe=true but missing title/instructions for message ${request.messageId}, skipping`);
      return { saved: false, recipeId: null, title: null, reason: "parse_error" };
    }

    if (!Array.isArray(parsed.ingredients)) {
      parsed.ingredients = [];
    }

    const result = await this.recipeAccessor.insertRecipe({
      guildId: request.guildId,
      channelId: request.channelId,
      messageId: request.messageId,
      userId: request.userId,
      title: parsed.title,
      instructions: parsed.instructions,
      sourceUrl: parsed.sourceUrl ?? this.extractFirstUrl(request.messageContent),
      ingredients: parsed.ingredients,
    });

    logger.info(`Recipe SAVED: "${parsed.title}" (id=${result.id}, ${parsed.ingredients.length} ingredients) from message ${request.messageId}`);
    return { saved: true, recipeId: result.id, title: parsed.title, reason: "saved" };
  }

  async listRecipes(request: RecipeListRequest): Promise<RecipeListResponse> {
    const result = await this.recipeAccessor.listRecipes(
      request.guildId,
      request.page,
      request.pageSize,
    );

    return {
      recipes: result.recipes,
      total: result.total,
      page: request.page,
      pageSize: request.pageSize,
    };
  }

  async searchByIngredient(request: RecipeSearchRequest): Promise<RecipeSearchResponse> {
    const result = await this.recipeAccessor.searchByIngredient(
      request.guildId,
      request.ingredient,
      request.page,
      request.pageSize,
    );

    return {
      recipes: result.recipes,
      total: result.total,
      page: request.page,
      pageSize: request.pageSize,
      searchTerm: request.ingredient,
    };
  }

  async getRecipeDetail(request: RecipeDetailRequest): Promise<RecipeDetailResponse> {
    const recipe = await this.recipeAccessor.getRecipeDetail(request.recipeId, request.guildId);
    if (!recipe) {
      return { recipe: null };
    }

    return {
      recipe: {
        id: recipe.id,
        title: recipe.title,
        userId: recipe.userId,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        sourceUrl: recipe.sourceUrl,
        messageId: recipe.messageId,
        channelId: recipe.channelId,
        createdAt: recipe.createdAt,
      },
    };
  }

  /**
   * If the message contains URLs, fetch the page content and build
   * a combined prompt. Uses JSON-LD structured data when available,
   * otherwise falls back to extracted page text.
   */
  private async resolveContent(messageContent: string): Promise<string> {
    const urls = messageContent.match(URL_REGEX);
    if (!urls || urls.length === 0) return messageContent;

    logger.debug(`Recipe: message contains ${urls.length} URL(s), fetching page content...`);
    const parts: string[] = [];

    // Include the original message text (minus URLs) for context
    const textWithoutUrls = messageContent.replace(URL_REGEX, "").trim();
    if (textWithoutUrls.length > 0) {
      parts.push(`User's message: ${textWithoutUrls}`);
    }

    for (const url of urls.slice(0, 3)) {
      const page = await this.webScraper.fetchPage(url);
      if (!page) {
        logger.warn(`Recipe: could not fetch ${url}`);
        parts.push(`[Link: ${url} — could not fetch]`);
        continue;
      }

      if (page.jsonLdRecipe) {
        logger.debug(`Recipe: found JSON-LD structured data at ${url} — "${page.jsonLdRecipe.name}"`);
        const recipe = page.jsonLdRecipe;
        parts.push(
          `Recipe from ${url}:\n` +
          `Title: ${recipe.name}\n` +
          `Ingredients:\n${recipe.recipeIngredient.join("\n")}\n` +
          `Instructions:\n${recipe.recipeInstructions}`,
        );
      } else {
        logger.debug(`Recipe: no JSON-LD at ${url}, using extracted text (${page.text.length} chars)`);
        parts.push(`Content from ${url}:\n${page.text}`);
      }
    }

    return parts.join("\n\n");
  }

  private extractFirstUrl(text: string): string | null {
    const match = text.match(URL_REGEX);
    return match?.[0] ?? null;
  }
}
