import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignEngine } from "./campaign-engine.js";
import type { CampaignAccessor, CampaignRow, NarrativeLogRow } from "../accessors/campaign-accessor.js";
import type { CharacterAccessor, CharacterRow } from "../accessors/character-accessor.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import { DiceEngine } from "./dice-engine.js";

function createMockCampaignAccessor(): CampaignAccessor {
  return {
    createCampaign: vi.fn().mockResolvedValue({ id: 1 }),
    getCampaign: vi.fn().mockResolvedValue(null),
    getActiveCampaignForChannel: vi.fn().mockResolvedValue(null),
    getActiveCampaignForGuild: vi.fn().mockResolvedValue(null),
    getPausedCampaignForChannel: vi.fn().mockResolvedValue(null),
    updateCampaignStatus: vi.fn().mockResolvedValue(undefined),
    updateCampaignState: vi.fn().mockResolvedValue(undefined),
    addPlayer: vi.fn().mockResolvedValue(undefined),
    removePlayer: vi.fn().mockResolvedValue(undefined),
    getPlayers: vi.fn().mockResolvedValue([]),
    linkCharacterToPlayer: vi.fn().mockResolvedValue(undefined),
    addNarrativeEntry: vi.fn().mockResolvedValue(undefined),
    getRecentNarrative: vi.fn().mockResolvedValue([]),
    getAllNarrative: vi.fn().mockResolvedValue([]),
    saveDiceRoll: vi.fn().mockResolvedValue(undefined),
    getCampaignHistory: vi.fn().mockResolvedValue([]),
  } as unknown as CampaignAccessor;
}

function createMockCharacterAccessor(): CharacterAccessor {
  return {
    createCharacter: vi.fn().mockResolvedValue({ id: 1 }),
    getCharacter: vi.fn().mockResolvedValue(null),
    getCharacterByUserAndCampaign: vi.fn().mockResolvedValue(null),
    getCharactersForCampaign: vi.fn().mockResolvedValue([]),
    updateCharacter: vi.fn().mockResolvedValue(undefined),
    setCreationStep: vi.fn().mockResolvedValue(undefined),
    markCreationComplete: vi.fn().mockResolvedValue(undefined),
    getInProgressCharacterForUser: vi.fn().mockResolvedValue(null),
    getUnassignedCharactersForUser: vi.fn().mockResolvedValue([]),
    assignCharacterToCampaign: vi.fn().mockResolvedValue(undefined),
    deleteCharacter: vi.fn().mockResolvedValue(true),
    getCharactersForUser: vi.fn().mockResolvedValue([]),
  } as unknown as CharacterAccessor;
}

function createMockOllamaAccessor(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function makeCampaignRow(overrides: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: 1,
    guildId: "guild1",
    channelId: "channel1",
    gmUserId: "gm1",
    name: "Test Run",
    status: "active",
    setting: "A test campaign",
    currentObjective: "Test objective",
    currentLocation: "Test location",
    lastPingMessageId: null,
    lastPingAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("CampaignEngine", () => {
  let campaignAccessor: CampaignAccessor;
  let characterAccessor: CharacterAccessor;
  let ollamaAccessor: OllamaAccessor;
  let engine: CampaignEngine;

  beforeEach(() => {
    campaignAccessor = createMockCampaignAccessor();
    characterAccessor = createMockCharacterAccessor();
    ollamaAccessor = createMockOllamaAccessor();
    engine = new CampaignEngine(campaignAccessor, characterAccessor, ollamaAccessor, new DiceEngine());
  });

  describe("startCampaign", () => {
    it("should create a campaign from AI response", async () => {
      vi.mocked(ollamaAccessor.chat).mockResolvedValue(
        "NAME: Shadow Protocol\nSETTING: A dark setting.\nOBJECTIVE: Steal the data.\nLOCATION: Downtown Seattle\nOPENING: You meet in a bar.",
      );

      const result = await engine.startCampaign({
        guildId: "guild1",
        channelId: "channel1",
        gmUserId: "gm1",
        playerUserIds: ["player1", "player2"],
      });

      expect(result.name).toBe("Shadow Protocol");
      expect(result.setting).toBe("A dark setting.");
      expect(result.objective).toBe("Steal the data.");
      expect(result.opening).toBe("You meet in a bar.");
      expect(vi.mocked(campaignAccessor.addPlayer)).toHaveBeenCalledTimes(2);
    });

    it("should throw if an active campaign exists", async () => {
      vi.mocked(campaignAccessor.getActiveCampaignForGuild).mockResolvedValue(makeCampaignRow());

      await expect(
        engine.startCampaign({
          guildId: "guild1",
          channelId: "channel1",
          gmUserId: "gm1",
          playerUserIds: [],
        }),
      ).rejects.toThrow("already an active campaign");
    });
  });

  describe("stopCampaign", () => {
    it("should stop an active campaign", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());

      const result = await engine.stopCampaign({ campaignId: 1, requesterId: "gm1", isAdmin: false });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("stopped");
      expect(vi.mocked(campaignAccessor.updateCampaignStatus)).toHaveBeenCalledWith(1, "completed");
    });

    it("should deny non-GM non-admin users", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());

      const result = await engine.stopCampaign({ campaignId: 1, requesterId: "random", isAdmin: false });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_authorized");
    });

    it("should allow admin to stop any campaign", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());

      const result = await engine.stopCampaign({ campaignId: 1, requesterId: "random", isAdmin: true });

      expect(result.success).toBe(true);
    });
  });

  describe("pauseCampaign", () => {
    it("should pause an active campaign", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());

      const result = await engine.pauseCampaign({ campaignId: 1, requesterId: "gm1", isAdmin: false });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("paused");
    });

    it("should reject pausing an already paused campaign", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow({ status: "paused" }));

      const result = await engine.pauseCampaign({ campaignId: 1, requesterId: "gm1", isAdmin: false });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_paused");
    });
  });

  describe("advanceNarrative", () => {
    it("should call Ollama and return narrative", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());
      vi.mocked(characterAccessor.getCharactersForCampaign).mockResolvedValue([]);
      vi.mocked(ollamaAccessor.chat).mockResolvedValue("The alley stretches before you, dark and foreboding.");

      const result = await engine.advanceNarrative({
        campaignId: 1,
        playerMessages: [{ authorName: "Player1", authorId: "p1", content: "We sneak down the alley", timestamp: Date.now() }],
        triggerUserId: "p1",
        triggerMessage: "Player1: We sneak down the alley",
      });

      expect(result.narrative).toContain("alley");
      expect(result.diceRollResults).toHaveLength(0);
      expect(vi.mocked(campaignAccessor.addNarrativeEntry)).toHaveBeenCalled();
    });

    it("should auto-roll dice when AI requests them", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());
      vi.mocked(characterAccessor.getCharactersForCampaign).mockResolvedValue([]);
      vi.mocked(ollamaAccessor.chat).mockResolvedValue(
        "The lock looks tough. [ROLL: Razor 8d6 (Locksmith + Agility) limit 5 - Pick the lock]",
      );

      const result = await engine.advanceNarrative({
        campaignId: 1,
        playerMessages: [],
        triggerUserId: "p1",
        triggerMessage: "We try to pick the lock",
      });

      expect(result.narrative).toContain("lock looks tough");
      expect(result.diceRollResults).toHaveLength(1);
      expect(result.diceRollResults[0].characterName).toBe("Razor");
      expect(result.diceRollResults[0].result.pool).toBe(8);
      expect(result.diceRollResults[0].result.limit).toBe(5);
      expect(vi.mocked(campaignAccessor.saveDiceRoll)).toHaveBeenCalled();
    });

    it("should return fallback on Ollama error", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());
      vi.mocked(characterAccessor.getCharactersForCampaign).mockResolvedValue([]);
      vi.mocked(ollamaAccessor.chat).mockRejectedValue(new Error("timeout"));

      const result = await engine.advanceNarrative({
        campaignId: 1,
        playerMessages: [],
        triggerUserId: "p1",
        triggerMessage: "Do something",
      });

      expect(result.narrative).toContain("technical difficulties");
    });
  });

  describe("addPlayer / removePlayer", () => {
    it("should add a player to the campaign", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());

      const result = await engine.addPlayer({
        campaignId: 1,
        userId: "newplayer",
        requesterId: "gm1",
        isAdmin: false,
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(campaignAccessor.addPlayer)).toHaveBeenCalledWith(1, "newplayer", expect.any(Number));
    });

    it("should remove a player from the campaign", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());

      const result = await engine.removePlayer({
        campaignId: 1,
        userId: "oldplayer",
        requesterId: "gm1",
        isAdmin: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("recapCampaign", () => {
    it("should generate a recap from narrative log", async () => {
      vi.mocked(campaignAccessor.getCampaign).mockResolvedValue(makeCampaignRow());
      vi.mocked(campaignAccessor.getAllNarrative).mockResolvedValue([
        { id: 1, campaignId: 1, type: "scene", content: "You entered the building.", createdAt: Date.now() },
      ]);
      vi.mocked(ollamaAccessor.chat).mockResolvedValue("You and your team infiltrated the corporate tower...");

      const result = await engine.recapCampaign(1);

      expect(result.recap).toContain("infiltrated");
      expect(result.campaignName).toBe("Test Run");
    });
  });

  describe("generatePlayerJoinLore", () => {
    it("should generate join lore via Ollama", async () => {
      vi.mocked(ollamaAccessor.chat).mockResolvedValue("The door burst open and Razor stumbled in, covered in noodle broth.");

      const lore = await engine.generatePlayerJoinLore("Shadow Heist", "Razor", "human", "Street Samurai");

      expect(lore).toContain("Razor");
      expect(vi.mocked(ollamaAccessor.chat)).toHaveBeenCalled();
    });

    it("should return fallback on Ollama failure", async () => {
      vi.mocked(ollamaAccessor.chat).mockRejectedValue(new Error("timeout"));

      const lore = await engine.generatePlayerJoinLore("Shadow Heist", "Razor", "human", "Street Samurai");

      expect(lore).toContain("Razor");
      expect(lore).toContain("shadows");
    });
  });

  describe("generatePlayerLeaveLore", () => {
    it("should generate leave lore via Ollama", async () => {
      vi.mocked(ollamaAccessor.chat).mockResolvedValue("Razor's commlink buzzed and he vanished into the night.");

      const lore = await engine.generatePlayerLeaveLore("Shadow Heist", "Razor");

      expect(lore).toContain("Razor");
    });

    it("should return fallback on Ollama failure with null character", async () => {
      vi.mocked(ollamaAccessor.chat).mockRejectedValue(new Error("timeout"));

      const lore = await engine.generatePlayerLeaveLore("Shadow Heist", null);

      expect(lore).toContain("runner");
    });
  });

  describe("getCampaignHistory", () => {
    it("should return campaign history entries", async () => {
      vi.mocked(campaignAccessor.getCampaignHistory).mockResolvedValue([
        makeCampaignRow({ id: 1, name: "Run 1", status: "completed" }),
        makeCampaignRow({ id: 2, name: "Run 2", status: "active" }),
      ]);

      const result = await engine.getCampaignHistory("guild1");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Run 1");
    });
  });
});
