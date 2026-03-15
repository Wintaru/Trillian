import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { CampaignEngine } from "../engines/campaign-engine.js";
import type { CharacterCreationEngine } from "../engines/character-creation-engine.js";
import type { CampaignAccessor } from "../accessors/campaign-accessor.js";
import { formatCampaignStatus } from "../utilities/shadowrun-format.js";
import type { CharacterAccessor } from "../accessors/character-accessor.js";
import * as logger from "../utilities/logger.js";

const HELP_DESCRIPTION = [
  "**Shadowrun Campaign** — Run tabletop RPG sessions in Discord!",
  "",
  "`/campaign start [premise]` — Start a new campaign",
  "`/campaign stop` — Stop the active campaign",
  "`/campaign pause` / `resume` — Pause or resume a campaign",
  "`/campaign status` — Show campaign status",
  "`/campaign addplayer @user` — Add a player",
  "`/campaign removeplayer @user` — Remove a player",
  "`/campaign players` — List campaign players",
  "`/campaign summon @user` — Summon an absent player",
  "`/campaign recap` — Get a story-so-far recap",
  "`/campaign history` — View past campaigns",
].join("\n");

export function createCampaignCommand(
  campaignEngine: CampaignEngine,
  characterCreationEngine: CharacterCreationEngine,
  campaignAccessor: CampaignAccessor,
  characterAccessor: CharacterAccessor,
  campaignChannelId: string | undefined,
): Command {
  return {
    name: "campaign",
    description: "Manage Shadowrun campaigns",
    slashData: new SlashCommandBuilder()
      .setName("campaign")
      .setDescription("Manage Shadowrun campaigns")
      .addSubcommand((sub) =>
        sub
          .setName("start")
          .setDescription("Start a new Shadowrun campaign")
          .addStringOption((opt) =>
            opt.setName("premise").setDescription("Optional premise for the campaign"),
          ),
      )
      .addSubcommand((sub) => sub.setName("stop").setDescription("Stop the active campaign"))
      .addSubcommand((sub) => sub.setName("pause").setDescription("Pause the active campaign"))
      .addSubcommand((sub) => sub.setName("resume").setDescription("Resume a paused campaign"))
      .addSubcommand((sub) => sub.setName("status").setDescription("Show campaign status"))
      .addSubcommand((sub) =>
        sub
          .setName("addplayer")
          .setDescription("Add a player to the campaign")
          .addUserOption((opt) => opt.setName("user").setDescription("The player to add").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("removeplayer")
          .setDescription("Remove a player from the campaign")
          .addUserOption((opt) => opt.setName("user").setDescription("The player to remove").setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName("players").setDescription("List campaign players"))
      .addSubcommand((sub) =>
        sub
          .setName("summon")
          .setDescription("Summon an absent player")
          .addUserOption((opt) => opt.setName("user").setDescription("The player to summon").setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName("recap").setDescription("Get a story-so-far recap"))
      .addSubcommand((sub) => sub.setName("history").setDescription("View past campaigns"))
      .addSubcommand((sub) => sub.setName("help").setDescription("Show available campaign commands")),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const sub = interaction.options.getSubcommand();

      if (!interaction.guildId) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
        return;
      }

      switch (sub) {
        case "start":
          await handleStart(interaction);
          break;
        case "stop":
          await handleStop(interaction);
          break;
        case "pause":
          await handlePause(interaction);
          break;
        case "resume":
          await handleResume(interaction);
          break;
        case "status":
          await handleStatus(interaction);
          break;
        case "addplayer":
          await handleAddPlayer(interaction);
          break;
        case "removeplayer":
          await handleRemovePlayer(interaction);
          break;
        case "players":
          await handlePlayers(interaction);
          break;
        case "summon":
          await handleSummon(interaction);
          break;
        case "recap":
          await handleRecap(interaction);
          break;
        case "history":
          await handleHistory(interaction);
          break;
        case "help":
          await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Shadowrun Campaign — Help").setDescription(HELP_DESCRIPTION).setColor(0x9b59b6)], flags: 64 });
          break;
        default:
          await interaction.reply({ content: `Unknown subcommand: ${sub}`, flags: 64 });
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      if (!message.guild) {
        await message.reply("This command can only be used in a server.");
        return;
      }

      const sub = context.args[0]?.toLowerCase();
      if (!sub || sub === "help") {
        await message.reply({ embeds: [new EmbedBuilder().setTitle("Shadowrun Campaign — Help").setDescription(HELP_DESCRIPTION).setColor(0x9b59b6)] });
        return;
      }

      switch (sub) {
        case "start":
          await handleStartPrefix(message, context.args.slice(1).join(" "));
          break;
        case "stop":
          await handleStopPrefix(message);
          break;
        case "pause":
          await handlePausePrefix(message);
          break;
        case "resume":
          await handleResumePrefix(message);
          break;
        case "status":
          await handleStatusPrefix(message);
          break;
        case "addplayer":
          await handleAddPlayerPrefix(message);
          break;
        case "removeplayer":
          await handleRemovePlayerPrefix(message);
          break;
        case "players":
          await handlePlayersPrefix(message);
          break;
        case "summon":
          await handleSummonPrefix(message);
          break;
        case "recap":
          await handleRecapPrefix(message);
          break;
        case "history":
          await handleHistoryPrefix(message);
          break;
        default:
          await message.reply(`Unknown subcommand: ${sub}`);
      }
    },
  };

  async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!campaignChannelId) {
      await interaction.reply({ content: "Campaign features are not configured. Ask an admin to set `CAMPAIGN_CHANNEL_ID`.", flags: 64 });
      return;
    }
    if (interaction.channelId !== campaignChannelId) {
      await interaction.reply({ content: `Campaigns can only be started in <#${campaignChannelId}>.`, flags: 64 });
      return;
    }

    await interaction.deferReply();
    await interaction.editReply("Generating campaign... The shadows are stirring.");

    try {
      const premise = interaction.options.getString("premise") ?? undefined;
      const result = await campaignEngine.startCampaign({
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        gmUserId: interaction.user.id,
        playerUserIds: [],
        premise,
      });

      await interaction.editReply(`**${result.name}**\n\n${result.opening}\n\n**Objective:** ${result.objective}\n**Location:** ${result.location}\n\nUse \`/campaign addplayer @user\` to add runners.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start campaign.";
      await interaction.editReply(message);
    }
  }

  async function handleStartPrefix(message: Message, premise: string): Promise<void> {
    if (!campaignChannelId) {
      await message.reply("Campaign features are not configured. Ask an admin to set `CAMPAIGN_CHANNEL_ID`.");
      return;
    }
    if (message.channelId !== campaignChannelId) {
      await message.reply(`Campaigns can only be started in <#${campaignChannelId}>.`);
      return;
    }

    const reply = await message.reply("Generating campaign... The shadows are stirring.");

    try {
      const result = await campaignEngine.startCampaign({
        guildId: message.guild!.id,
        channelId: message.channelId,
        gmUserId: message.author.id,
        playerUserIds: [],
        premise: premise || undefined,
      });

      await reply.edit(`**${result.name}**\n\n${result.opening}\n\n**Objective:** ${result.objective}\n**Location:** ${result.location}\n\nUse \`!campaign addplayer @user\` to add runners.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start campaign.";
      await reply.edit(msg);
    }
  }

  async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) {
      await interaction.reply({ content: "No active campaign in this channel.", flags: 64 });
      return;
    }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.stopCampaign({
      campaignId: campaign.id,
      requesterId: interaction.user.id,
      isAdmin,
    });

    await interaction.reply(result.success ? `Campaign **${campaign.name}** has ended.` : `Could not stop: ${result.reason}`);
  }

  async function handleStopPrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No active campaign in this channel."); return; }

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.stopCampaign({ campaignId: campaign.id, requesterId: message.author.id, isAdmin });
    await message.reply(result.success ? `Campaign **${campaign.name}** has ended.` : `Could not stop: ${result.reason}`);
  }

  async function handlePause(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No active campaign.", flags: 64 }); return; }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.pauseCampaign({ campaignId: campaign.id, requesterId: interaction.user.id, isAdmin });
    await interaction.reply(result.success ? `Campaign **${campaign.name}** paused.` : `Could not pause: ${result.reason}`);
  }

  async function handlePausePrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No active campaign."); return; }

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.pauseCampaign({ campaignId: campaign.id, requesterId: message.author.id, isAdmin });
    await message.reply(result.success ? `Campaign **${campaign.name}** paused.` : `Could not pause: ${result.reason}`);
  }

  async function handleResume(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getPausedCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No paused campaign to resume.", flags: 64 }); return; }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.resumeCampaign({ campaignId: campaign.id, requesterId: interaction.user.id, isAdmin });
    await interaction.reply(result.success ? `Campaign **${campaign.name}** resumed!` : `Could not resume: ${result.reason}`);
  }

  async function handleResumePrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getPausedCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No paused campaign to resume."); return; }

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.resumeCampaign({ campaignId: campaign.id, requesterId: message.author.id, isAdmin });
    await message.reply(result.success ? `Campaign **${campaign.name}** resumed!` : `Could not resume: ${result.reason}`);
  }

  async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No campaign in this channel.", flags: 64 }); return; }

    const players = await campaignAccessor.getPlayers(campaign.id);
    const characters = await characterAccessor.getCharactersForCampaign(campaign.id);
    const nameMap = new Map(characters.map((c) => [c.userId, c.name]));
    const embed = formatCampaignStatus(campaign, players, nameMap);
    await interaction.reply({ embeds: [embed] });
  }

  async function handleStatusPrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No campaign in this channel."); return; }

    const players = await campaignAccessor.getPlayers(campaign.id);
    const characters = await characterAccessor.getCharactersForCampaign(campaign.id);
    const nameMap = new Map(characters.map((c) => [c.userId, c.name]));
    const embed = formatCampaignStatus(campaign, players, nameMap);
    await message.reply({ embeds: [embed] });
  }

  async function handleAddPlayer(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No active campaign.", flags: 64 }); return; }

    const user = interaction.options.getUser("user", true);
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.addPlayer({ campaignId: campaign.id, userId: user.id, requesterId: interaction.user.id, isAdmin });

    if (result.success) {
      const linked = await tryLinkExistingCharacter(user.id, campaign);
      if (linked) {
        await interaction.reply(`<@${user.id}> has been added to the campaign with their character **${linked.name}**.`);
        generateAndPostJoinLore(interaction.channel, campaign.name, linked.name, linked.metatype, linked.archetype);
      } else {
        try {
          const dmChannel = await user.createDM();
          const { prompt } = await characterCreationEngine.startCreation(user.id, campaign.id, user.displayName);
          await dmChannel.send(`You've been added to the Shadowrun campaign **${campaign.name}**! Let's create your character.\n\n${prompt}`);
        } catch (error) {
          logger.error("Failed to DM player for character creation:", error);
        }
        await interaction.reply(`<@${user.id}> has been added to the campaign. Check your DMs for character creation!`);
      }
    } else {
      await interaction.reply({ content: result.reason, flags: 64 });
    }
  }

  async function handleAddPlayerPrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No active campaign."); return; }

    const user = message.mentions.users.first();
    if (!user) { await message.reply("Mention a user to add: `!campaign addplayer @user`"); return; }

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    const result = await campaignEngine.addPlayer({ campaignId: campaign.id, userId: user.id, requesterId: message.author.id, isAdmin });

    if (result.success) {
      const linked = await tryLinkExistingCharacter(user.id, campaign);
      if (linked) {
        await message.reply(`<@${user.id}> added with character **${linked.name}**.`);
        generateAndPostJoinLore(message.channel, campaign.name, linked.name, linked.metatype, linked.archetype);
      } else {
        try {
          const dmChannel = await user.createDM();
          const { prompt } = await characterCreationEngine.startCreation(user.id, campaign.id, user.displayName);
          await dmChannel.send(`You've been added to the Shadowrun campaign **${campaign.name}**! Let's create your character.\n\n${prompt}`);
        } catch (error) {
          logger.error("Failed to DM player:", error);
        }
        await message.reply(`<@${user.id}> added. Check DMs for character creation!`);
      }
    } else {
      await message.reply(result.reason);
    }
  }

  async function tryLinkExistingCharacter(userId: string, campaign: { id: number; name: string }): Promise<{ name: string; metatype: string; archetype: string | null } | null> {
    const unassigned = await characterAccessor.getUnassignedCharactersForUser(userId);
    if (unassigned.length === 0) return null;

    const character = unassigned[0];
    await characterAccessor.assignCharacterToCampaign(character.id, campaign.id);
    await campaignAccessor.linkCharacterToPlayer(campaign.id, userId, character.id);
    return { name: character.name, metatype: character.metatype, archetype: character.archetype };
  }

  function generateAndPostJoinLore(channel: unknown, campaignName: string, characterName: string, metatype: string, archetype: string | null): void {
    const ch = channel as { send?: (content: string) => Promise<unknown> } | null;
    if (!ch?.send) return;
    const sendFn = ch.send.bind(ch);
    campaignEngine.generatePlayerJoinLore(campaignName, characterName, metatype, archetype)
      .then((lore) => sendFn(lore))
      .catch((error) => logger.error("Failed to post join lore:", error));
  }

  function generateAndPostLeaveLore(channel: unknown, campaignName: string, characterName: string | null): void {
    const ch = channel as { send?: (content: string) => Promise<unknown> } | null;
    if (!ch?.send) return;
    const sendFn = ch.send.bind(ch);
    campaignEngine.generatePlayerLeaveLore(campaignName, characterName)
      .then((lore) => sendFn(lore))
      .catch((error) => logger.error("Failed to post leave lore:", error));
  }

  async function handleRemovePlayer(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No active campaign.", flags: 64 }); return; }

    const user = interaction.options.getUser("user", true);
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const character = await characterAccessor.getCharacterByUserAndCampaign(user.id, campaign.id);
    const result = await campaignEngine.removePlayer({ campaignId: campaign.id, userId: user.id, requesterId: interaction.user.id, isAdmin });
    if (result.success) {
      await interaction.reply(`<@${user.id}> removed from the campaign.`);
      generateAndPostLeaveLore(interaction.channel, campaign.name, character?.name ?? null);
    } else {
      await interaction.reply(result.reason);
    }
  }

  async function handleRemovePlayerPrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No active campaign."); return; }

    const user = message.mentions.users.first();
    if (!user) { await message.reply("Mention a user: `!campaign removeplayer @user`"); return; }

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    const character = await characterAccessor.getCharacterByUserAndCampaign(user.id, campaign.id);
    const result = await campaignEngine.removePlayer({ campaignId: campaign.id, userId: user.id, requesterId: message.author.id, isAdmin });
    if (result.success) {
      await message.reply(`<@${user.id}> removed.`);
      generateAndPostLeaveLore(message.channel, campaign.name, character?.name ?? null);
    } else {
      await message.reply(result.reason);
    }
  }

  async function handlePlayers(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No campaign in this channel.", flags: 64 }); return; }

    const players = await campaignAccessor.getPlayers(campaign.id);
    const characters = await characterAccessor.getCharactersForCampaign(campaign.id);
    const charMap = new Map(characters.map((c) => [c.userId, c]));

    const lines = players.map((p) => {
      const char = charMap.get(p.userId);
      if (char && char.creationStatus === "complete") {
        return `<@${p.userId}> — **${char.name}** (${char.metatype} ${char.archetype ?? ""})`;
      }
      return `<@${p.userId}> — Character creation ${char ? "in progress" : "not started"}`;
    });

    await interaction.reply(lines.join("\n") || "No players in the campaign.");
  }

  async function handlePlayersPrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No campaign in this channel."); return; }

    const players = await campaignAccessor.getPlayers(campaign.id);
    const characters = await characterAccessor.getCharactersForCampaign(campaign.id);
    const charMap = new Map(characters.map((c) => [c.userId, c]));

    const lines = players.map((p) => {
      const char = charMap.get(p.userId);
      if (char && char.creationStatus === "complete") {
        return `<@${p.userId}> — **${char.name}** (${char.metatype} ${char.archetype ?? ""})`;
      }
      return `<@${p.userId}> — Character creation ${char ? "in progress" : "not started"}`;
    });

    await message.reply(lines.join("\n") || "No players.");
  }

  async function handleSummon(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getUser("user", true);
    await interaction.reply(`Hey <@${user.id}>, the team needs you in the shadows! Get in here, chummer.`);
  }

  async function handleSummonPrefix(message: Message): Promise<void> {
    const user = message.mentions.users.first();
    if (!user) { await message.reply("Mention a user: `!campaign summon @user`"); return; }
    await message.reply(`Hey <@${user.id}>, the team needs you in the shadows! Get in here, chummer.`);
  }

  async function handleRecap(interaction: ChatInputCommandInteraction): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(interaction.guildId!, interaction.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(interaction.guildId!, interaction.channelId);
    if (!campaign) { await interaction.reply({ content: "No campaign in this channel.", flags: 64 }); return; }

    await interaction.deferReply();
    try {
      const result = await campaignEngine.recapCampaign(campaign.id);
      await interaction.editReply(`**${result.campaignName} — Story So Far**\n\n${result.recap}`);
    } catch (error) {
      await interaction.editReply("Failed to generate recap. Try again later.");
    }
  }

  async function handleRecapPrefix(message: Message): Promise<void> {
    const campaign = await campaignAccessor.getActiveCampaignForChannel(message.guild!.id, message.channelId)
      ?? await campaignAccessor.getPausedCampaignForChannel(message.guild!.id, message.channelId);
    if (!campaign) { await message.reply("No campaign in this channel."); return; }

    const reply = await message.reply("Generating recap...");
    try {
      const result = await campaignEngine.recapCampaign(campaign.id);
      await reply.edit(`**${result.campaignName} — Story So Far**\n\n${result.recap}`);
    } catch (error) {
      await reply.edit("Failed to generate recap.");
    }
  }

  async function handleHistory(interaction: ChatInputCommandInteraction): Promise<void> {
    const history = await campaignEngine.getCampaignHistory(interaction.guildId!);
    if (history.length === 0) {
      await interaction.reply({ content: "No campaign history yet.", flags: 64 });
      return;
    }

    const lines = history.map((h) => {
      const date = new Date(h.createdAt).toLocaleDateString();
      return `**${h.name}** (${h.status}) — ${date}\n> ${h.setting.slice(0, 100)}...`;
    });

    await interaction.reply(lines.join("\n\n"));
  }

  async function handleHistoryPrefix(message: Message): Promise<void> {
    const history = await campaignEngine.getCampaignHistory(message.guild!.id);
    if (history.length === 0) { await message.reply("No campaign history yet."); return; }

    const lines = history.map((h) => {
      const date = new Date(h.createdAt).toLocaleDateString();
      return `**${h.name}** (${h.status}) — ${date}\n> ${h.setting.slice(0, 100)}...`;
    });

    await message.reply(lines.join("\n\n"));
  }
}
