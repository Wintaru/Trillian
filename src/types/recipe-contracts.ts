export interface ParseRecipeRequest {
  messageContent: string;
  messageId: string;
  userId: string;
  guildId: string;
  channelId: string;
}

export interface ParsedRecipe {
  title: string;
  ingredients: ParsedIngredient[];
  instructions: string;
  sourceUrl: string | null;
}

export interface ParsedIngredient {
  name: string;
  quantity: string | null;
}

export interface ParseRecipeResponse {
  saved: boolean;
  recipeId: number | null;
  title: string | null;
  reason: "saved" | "not_a_recipe" | "duplicate" | "parse_error";
}

export interface RecipeListRequest {
  guildId: string;
  page: number;
  pageSize: number;
}

export interface RecipeListEntry {
  id: number;
  title: string;
  userId: string;
  ingredientCount: number;
  createdAt: number;
}

export interface RecipeListResponse {
  recipes: RecipeListEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecipeSearchRequest {
  guildId: string;
  ingredient: string;
  page: number;
  pageSize: number;
}

export interface RecipeSearchResponse {
  recipes: RecipeListEntry[];
  total: number;
  page: number;
  pageSize: number;
  searchTerm: string;
}

export interface RecipeDetailRequest {
  recipeId: number;
  guildId: string;
}

export interface RecipeDetail {
  id: number;
  title: string;
  userId: string;
  ingredients: ParsedIngredient[];
  instructions: string;
  sourceUrl: string | null;
  messageId: string;
  channelId: string;
  createdAt: number;
}

export interface RecipeDetailResponse {
  recipe: RecipeDetail | null;
}
