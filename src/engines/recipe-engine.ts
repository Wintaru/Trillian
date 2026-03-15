import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { RecipeAccessor } from "../accessors/recipe-accessor.js";
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
  ) {}

  async parseAndStore(request: ParseRecipeRequest): Promise<ParseRecipeResponse> {
    const isDuplicate = await this.recipeAccessor.hasMessageRecipe(request.messageId);
    if (isDuplicate) {
      return { saved: false, recipeId: null, title: null, reason: "duplicate" };
    }

    let parsed: ParsedRecipe & { isRecipe: boolean };
    try {
      const response = await this.ollamaAccessor.chat([
        { role: "system", content: PARSE_PROMPT },
        { role: "user", content: request.messageContent },
      ]);

      const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (error) {
      logger.error("Failed to parse recipe from message:", error);
      return { saved: false, recipeId: null, title: null, reason: "parse_error" };
    }

    if (!parsed.isRecipe) {
      return { saved: false, recipeId: null, title: null, reason: "not_a_recipe" };
    }

    const result = await this.recipeAccessor.insertRecipe({
      guildId: request.guildId,
      channelId: request.channelId,
      messageId: request.messageId,
      userId: request.userId,
      title: parsed.title,
      instructions: parsed.instructions,
      sourceUrl: parsed.sourceUrl,
      ingredients: parsed.ingredients,
    });

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
}
