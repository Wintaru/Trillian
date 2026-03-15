import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { RecipeEngine } from "../engines/recipe-engine.js";
import type { RecipeListEntry } from "../types/recipe-contracts.js";

const PAGE_SIZE = 10;
const EMBED_COLOR = 0xf5a623;

const HELP_DESCRIPTION = [
  "**How it works:**",
  "Post a recipe in the designated recipe channel and the bot will automatically " +
  "detect it, extract the title, ingredients, and instructions, and save it to the " +
  "recipe book. The bot reacts with a frying pan emoji when a recipe is saved.",
  "",
  "**Commands:**",
  "`/recipe list [page]` — Browse all saved recipes",
  "`/recipe search <ingredient> [page]` — Find recipes containing a specific ingredient",
  "`/recipe view <id>` — View full details for a recipe by its ID number",
  "`/recipe help` — Show this help message",
  "",
  "**Tips:**",
  "• Recipes are detected automatically — just post naturally with ingredients and steps",
  "• Search is fuzzy — searching \"chicken\" will match \"chicken breast\", \"chicken thigh\", etc.",
  "• Each recipe shows its ID number, so you can use `/recipe view` to see full details",
  "• Historical messages in the recipe channel are scanned on bot startup",
].join("\n");

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Recipe Book — Help")
    .setDescription(HELP_DESCRIPTION)
    .setColor(EMBED_COLOR);
}

function buildListEmbed(
  recipes: RecipeListEntry[],
  total: number,
  page: number,
  pageSize: number,
): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const embed = new EmbedBuilder()
    .setTitle("Recipe Book")
    .setColor(EMBED_COLOR)
    .setFooter({ text: `Page ${page}/${totalPages} · ${total} recipe${total === 1 ? "" : "s"}` });

  if (recipes.length === 0) {
    embed.setDescription("No recipes found. Post a recipe in the recipe channel to get started!");
    return embed;
  }

  const lines = recipes.map(
    (r) => `**#${r.id}** — ${r.title} (${r.ingredientCount} ingredient${r.ingredientCount === 1 ? "" : "s"}) · <@${r.userId}>`,
  );
  embed.setDescription(lines.join("\n"));
  return embed;
}

function buildSearchEmbed(
  recipes: RecipeListEntry[],
  total: number,
  page: number,
  pageSize: number,
  searchTerm: string,
): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const embed = new EmbedBuilder()
    .setTitle(`Recipes with "${searchTerm}"`)
    .setColor(0x4a90d9)
    .setFooter({ text: `Page ${page}/${totalPages} · ${total} result${total === 1 ? "" : "s"}` });

  if (recipes.length === 0) {
    embed.setDescription(`No recipes found containing "${searchTerm}".`);
    return embed;
  }

  const lines = recipes.map(
    (r) => `**#${r.id}** — ${r.title} (${r.ingredientCount} ingredient${r.ingredientCount === 1 ? "" : "s"}) · <@${r.userId}>`,
  );
  embed.setDescription(lines.join("\n"));
  return embed;
}

function buildDetailEmbed(recipe: {
  id: number;
  title: string;
  userId: string;
  ingredients: { name: string; quantity: string | null }[];
  instructions: string;
  sourceUrl: string | null;
  channelId: string;
  messageId: string;
  createdAt: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(recipe.title)
    .setColor(EMBED_COLOR)
    .setFooter({ text: `Recipe #${recipe.id} · Added by` })
    .setTimestamp(recipe.createdAt);

  const ingredientLines = recipe.ingredients.map(
    (i) => i.quantity ? `• ${i.quantity} ${i.name}` : `• ${i.name}`,
  );
  embed.addFields({ name: "Ingredients", value: ingredientLines.join("\n").slice(0, 1024) || "None listed" });

  // Truncate instructions to fit Discord embed limits
  const instructions = recipe.instructions.length > 1024
    ? recipe.instructions.slice(0, 1021) + "..."
    : recipe.instructions;
  embed.addFields({ name: "Instructions", value: instructions || "None listed" });

  if (recipe.sourceUrl) {
    embed.addFields({ name: "Source", value: recipe.sourceUrl });
  }

  embed.addFields({
    name: "Original Message",
    value: `<#${recipe.channelId}> · [Jump to message](https://discord.com/channels/-/${recipe.channelId}/${recipe.messageId})`,
  });

  embed.setDescription(`Shared by <@${recipe.userId}>`);

  return embed;
}

export function createRecipeCommand(recipeEngine: RecipeEngine): Command {
  return {
    name: "recipe",
    description: "Browse and search the recipe book",
    slashData: new SlashCommandBuilder()
      .setName("recipe")
      .setDescription("Browse and search the recipe book")
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List all saved recipes")
          .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setRequired(false).setMinValue(1),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("search")
          .setDescription("Search recipes by ingredient")
          .addStringOption((opt) =>
            opt.setName("ingredient").setDescription("Ingredient to search for").setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setRequired(false).setMinValue(1),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View a recipe's full details")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Recipe ID number").setRequired(true).setMinValue(1),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show available recipe commands"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
        return;
      }

      switch (subcommand) {
        case "list": {
          const page = interaction.options.getInteger("page") ?? 1;
          const result = await recipeEngine.listRecipes({ guildId, page, pageSize: PAGE_SIZE });
          const embed = buildListEmbed(result.recipes, result.total, result.page, result.pageSize);
          await interaction.reply({ embeds: [embed] });
          break;
        }
        case "search": {
          const ingredient = interaction.options.getString("ingredient", true);
          const page = interaction.options.getInteger("page") ?? 1;
          const result = await recipeEngine.searchByIngredient({ guildId, ingredient, page, pageSize: PAGE_SIZE });
          const embed = buildSearchEmbed(result.recipes, result.total, result.page, result.pageSize, result.searchTerm);
          await interaction.reply({ embeds: [embed] });
          break;
        }
        case "view": {
          const recipeId = interaction.options.getInteger("id", true);
          const result = await recipeEngine.getRecipeDetail({ recipeId, guildId });
          if (!result.recipe) {
            await interaction.reply({ content: `Recipe #${recipeId} not found.`, flags: 64 });
            return;
          }
          const embed = buildDetailEmbed(result.recipe);
          await interaction.reply({ embeds: [embed] });
          break;
        }
        case "help": {
          await interaction.reply({ embeds: [buildHelpEmbed()], flags: 64 });
          break;
        }
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const guildId = message.guildId;
      if (!guildId || !message.channel.isSendable()) return;

      const [subcommand, ...rest] = context.args;

      if (subcommand === "help") {
        await message.reply({ embeds: [buildHelpEmbed()] });
        return;
      }

      if (!subcommand || subcommand === "list") {
        const page = parseInt(rest[0], 10) || 1;
        const result = await recipeEngine.listRecipes({ guildId, page, pageSize: PAGE_SIZE });
        const embed = buildListEmbed(result.recipes, result.total, result.page, result.pageSize);
        await message.channel.send({ embeds: [embed] });
      } else if (subcommand === "search") {
        if (rest.length === 0) {
          await message.reply("Usage: `!recipe search <ingredient> [page]`");
          return;
        }
        // Last arg could be a page number
        const lastArg = rest[rest.length - 1];
        const lastIsPage = /^\d+$/.test(lastArg) && rest.length > 1;
        const page = lastIsPage ? parseInt(lastArg, 10) : 1;
        const ingredient = lastIsPage ? rest.slice(0, -1).join(" ") : rest.join(" ");
        const result = await recipeEngine.searchByIngredient({ guildId, ingredient, page, pageSize: PAGE_SIZE });
        const embed = buildSearchEmbed(result.recipes, result.total, result.page, result.pageSize, result.searchTerm);
        await message.channel.send({ embeds: [embed] });
      } else if (subcommand === "view") {
        const recipeId = parseInt(rest[0], 10);
        if (isNaN(recipeId)) {
          await message.reply("Usage: `!recipe view <id>`");
          return;
        }
        const result = await recipeEngine.getRecipeDetail({ recipeId, guildId });
        if (!result.recipe) {
          await message.reply(`Recipe #${recipeId} not found.`);
          return;
        }
        const embed = buildDetailEmbed(result.recipe);
        await message.channel.send({ embeds: [embed] });
      } else {
        await message.reply({ embeds: [buildHelpEmbed()] });
      }
    },
  };
}
