import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecipeEngine } from "./recipe-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { RecipeAccessor } from "../accessors/recipe-accessor.js";

function createMockOllama(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function createMockRecipeAccessor(): RecipeAccessor {
  return {
    insertRecipe: vi.fn(),
    hasMessageRecipe: vi.fn(),
    listRecipes: vi.fn(),
    searchByIngredient: vi.fn(),
    getRecipeDetail: vi.fn(),
  } as unknown as RecipeAccessor;
}

const VALID_RECIPE_JSON = JSON.stringify({
  isRecipe: true,
  title: "Chicken Tacos",
  ingredients: [
    { name: "chicken breast", quantity: "2 lbs" },
    { name: "tortillas", quantity: "8" },
    { name: "lime", quantity: "2" },
  ],
  instructions: "1. Season chicken. 2. Grill until done. 3. Slice and serve in tortillas with lime.",
  sourceUrl: null,
});

const NOT_A_RECIPE_JSON = JSON.stringify({ isRecipe: false });

describe("RecipeEngine", () => {
  let ollama: OllamaAccessor;
  let accessor: RecipeAccessor;
  let engine: RecipeEngine;

  beforeEach(() => {
    ollama = createMockOllama();
    accessor = createMockRecipeAccessor();
    engine = new RecipeEngine(ollama, accessor);
  });

  describe("parseAndStore", () => {
    const baseRequest = {
      messageContent: "Chicken Tacos: 2 lbs chicken breast, 8 tortillas, 2 limes. Season, grill, serve.",
      messageId: "msg-123",
      userId: "user-456",
      guildId: "guild-789",
      channelId: "channel-012",
    };

    it("should parse and save a valid recipe", async () => {
      vi.mocked(accessor.hasMessageRecipe).mockResolvedValue(false);
      vi.mocked(ollama.chat).mockResolvedValue(VALID_RECIPE_JSON);
      vi.mocked(accessor.insertRecipe).mockResolvedValue({ id: 1 });

      const result = await engine.parseAndStore(baseRequest);

      expect(result.saved).toBe(true);
      expect(result.recipeId).toBe(1);
      expect(result.title).toBe("Chicken Tacos");
      expect(result.reason).toBe("saved");
      expect(vi.mocked(accessor.insertRecipe)).toHaveBeenCalledWith({
        guildId: "guild-789",
        channelId: "channel-012",
        messageId: "msg-123",
        userId: "user-456",
        title: "Chicken Tacos",
        instructions: "1. Season chicken. 2. Grill until done. 3. Slice and serve in tortillas with lime.",
        sourceUrl: null,
        ingredients: [
          { name: "chicken breast", quantity: "2 lbs" },
          { name: "tortillas", quantity: "8" },
          { name: "lime", quantity: "2" },
        ],
      });
    });

    it("should return duplicate when message already processed", async () => {
      vi.mocked(accessor.hasMessageRecipe).mockResolvedValue(true);

      const result = await engine.parseAndStore(baseRequest);

      expect(result.saved).toBe(false);
      expect(result.reason).toBe("duplicate");
      expect(vi.mocked(ollama.chat)).not.toHaveBeenCalled();
    });

    it("should return not_a_recipe when Ollama says it isn't", async () => {
      vi.mocked(accessor.hasMessageRecipe).mockResolvedValue(false);
      vi.mocked(ollama.chat).mockResolvedValue(NOT_A_RECIPE_JSON);

      const result = await engine.parseAndStore(baseRequest);

      expect(result.saved).toBe(false);
      expect(result.reason).toBe("not_a_recipe");
      expect(vi.mocked(accessor.insertRecipe)).not.toHaveBeenCalled();
    });

    it("should return parse_error when Ollama returns invalid JSON", async () => {
      vi.mocked(accessor.hasMessageRecipe).mockResolvedValue(false);
      vi.mocked(ollama.chat).mockResolvedValue("this is not json at all");

      const result = await engine.parseAndStore(baseRequest);

      expect(result.saved).toBe(false);
      expect(result.reason).toBe("parse_error");
    });

    it("should strip markdown fences from Ollama response", async () => {
      vi.mocked(accessor.hasMessageRecipe).mockResolvedValue(false);
      vi.mocked(ollama.chat).mockResolvedValue(`\`\`\`json\n${VALID_RECIPE_JSON}\n\`\`\``);
      vi.mocked(accessor.insertRecipe).mockResolvedValue({ id: 2 });

      const result = await engine.parseAndStore(baseRequest);

      expect(result.saved).toBe(true);
      expect(result.title).toBe("Chicken Tacos");
    });
  });

  describe("listRecipes", () => {
    it("should return paginated recipe list", async () => {
      vi.mocked(accessor.listRecipes).mockResolvedValue({
        recipes: [
          { id: 1, title: "Tacos", userId: "u1", ingredientCount: 3, createdAt: 1000 },
        ],
        total: 1,
      });

      const result = await engine.listRecipes({ guildId: "g1", page: 1, pageSize: 10 });

      expect(result.recipes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe("searchByIngredient", () => {
    it("should return matching recipes", async () => {
      vi.mocked(accessor.searchByIngredient).mockResolvedValue({
        recipes: [
          { id: 1, title: "Chicken Tacos", userId: "u1", ingredientCount: 3, createdAt: 1000 },
        ],
        total: 1,
      });

      const result = await engine.searchByIngredient({
        guildId: "g1",
        ingredient: "chicken",
        page: 1,
        pageSize: 10,
      });

      expect(result.recipes).toHaveLength(1);
      expect(result.searchTerm).toBe("chicken");
    });
  });

  describe("getRecipeDetail", () => {
    it("should return full recipe detail", async () => {
      vi.mocked(accessor.getRecipeDetail).mockResolvedValue({
        id: 1,
        title: "Tacos",
        userId: "u1",
        instructions: "Cook it",
        sourceUrl: null,
        messageId: "m1",
        channelId: "c1",
        createdAt: 1000,
        ingredients: [{ name: "chicken", quantity: "1 lb" }],
      });

      const result = await engine.getRecipeDetail({ recipeId: 1, guildId: "g1" });

      expect(result.recipe).not.toBeNull();
      expect(result.recipe!.title).toBe("Tacos");
      expect(result.recipe!.ingredients).toHaveLength(1);
    });

    it("should return null when recipe not found", async () => {
      vi.mocked(accessor.getRecipeDetail).mockResolvedValue(null);

      const result = await engine.getRecipeDetail({ recipeId: 999, guildId: "g1" });

      expect(result.recipe).toBeNull();
    });
  });
});
