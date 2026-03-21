import { eq, and, like, sql, desc } from "drizzle-orm";
import { db } from "./database.js";
import { recipes, recipeIngredients } from "../db/schema.js";
import type { ParsedIngredient, RecipeListEntry } from "../types/recipe-contracts.js";

export class RecipeAccessor {
  async insertRecipe(data: {
    guildId: string;
    channelId: string;
    messageId: string;
    userId: string;
    title: string;
    instructions: string;
    sourceUrl: string | null;
    ingredients: ParsedIngredient[];
  }): Promise<{ id: number }> {
    const now = Date.now();
    const result = await db
      .insert(recipes)
      .values({
        guildId: data.guildId,
        channelId: data.channelId,
        messageId: data.messageId,
        userId: data.userId,
        title: data.title,
        instructions: data.instructions,
        sourceUrl: data.sourceUrl,
        createdAt: now,
      })
      .returning({ id: recipes.id });

    const recipeId = result[0].id;

    if (data.ingredients.length > 0) {
      await db.insert(recipeIngredients).values(
        data.ingredients.map((ing) => ({
          recipeId,
          name: ing.name.toLowerCase().trim(),
          quantity: ing.quantity,
        })),
      );
    }

    return { id: recipeId };
  }

  async hasMessageRecipe(messageId: string): Promise<boolean> {
    const rows = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.messageId, messageId))
      .limit(1);
    return rows.length > 0;
  }

  async listRecipes(
    guildId: string,
    page: number,
    pageSize: number,
  ): Promise<{ recipes: RecipeListEntry[]; total: number }> {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(eq(recipes.guildId, guildId));
    const total = countRows[0].count;

    const rows = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        userId: recipes.userId,
        createdAt: recipes.createdAt,
        ingredientCount: sql<number>`(SELECT count(*) FROM recipe_ingredients WHERE recipe_ingredients.recipe_id = recipes.id)`,
      })
      .from(recipes)
      .where(eq(recipes.guildId, guildId))
      .orderBy(desc(recipes.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { recipes: rows, total };
  }

  async searchByIngredient(
    guildId: string,
    ingredient: string,
    page: number,
    pageSize: number,
  ): Promise<{ recipes: RecipeListEntry[]; total: number }> {
    const searchTerm = `%${ingredient.toLowerCase().trim()}%`;

    const countRows = await db
      .select({ count: sql<number>`count(DISTINCT ${recipes.id})` })
      .from(recipes)
      .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
      .where(
        and(
          eq(recipes.guildId, guildId),
          like(recipeIngredients.name, searchTerm),
        ),
      );
    const total = countRows[0].count;

    const rows = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        userId: recipes.userId,
        createdAt: recipes.createdAt,
        ingredientCount: sql<number>`(SELECT count(*) FROM recipe_ingredients WHERE recipe_ingredients.recipe_id = recipes.id)`,
      })
      .from(recipes)
      .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
      .where(
        and(
          eq(recipes.guildId, guildId),
          like(recipeIngredients.name, searchTerm),
        ),
      )
      .groupBy(recipes.id)
      .orderBy(desc(recipes.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { recipes: rows, total };
  }

  async deleteRecipesWithNoIngredients(): Promise<number[]> {
    const rows = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        sql`(SELECT count(*) FROM recipe_ingredients WHERE recipe_ingredients.recipe_id = recipes.id) = 0`,
      );

    const ids = rows.map((r) => r.id);
    for (const id of ids) {
      await db.delete(recipes).where(eq(recipes.id, id));
    }
    return ids;
  }

  async getRecipeDetail(
    recipeId: number,
    guildId: string,
  ): Promise<{
    id: number;
    title: string;
    userId: string;
    instructions: string;
    sourceUrl: string | null;
    messageId: string;
    channelId: string;
    createdAt: number;
    ingredients: ParsedIngredient[];
  } | null> {
    const rows = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.guildId, guildId)))
      .limit(1);

    if (rows.length === 0) return null;

    const recipe = rows[0];

    const ingredients = await db
      .select({ name: recipeIngredients.name, quantity: recipeIngredients.quantity })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId));

    return {
      id: recipe.id,
      title: recipe.title,
      userId: recipe.userId,
      instructions: recipe.instructions,
      sourceUrl: recipe.sourceUrl,
      messageId: recipe.messageId,
      channelId: recipe.channelId,
      createdAt: recipe.createdAt,
      ingredients,
    };
  }
}
