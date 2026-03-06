import { describe, it, expect, vi, beforeEach } from "vitest";
import { CharacterCreationEngine } from "./character-creation-engine.js";
import type { CharacterAccessor, CharacterRow } from "../accessors/character-accessor.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";

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
  } as unknown as CharacterAccessor;
}

function createMockOllamaAccessor(): OllamaAccessor {
  return { chat: vi.fn().mockResolvedValue("Backstory polished.") } as unknown as OllamaAccessor;
}

function makeCharacterRow(overrides: Partial<CharacterRow> = {}): CharacterRow {
  return {
    id: 1,
    userId: "user1",
    campaignId: 1,
    name: "TestRunner",
    metatype: "human",
    archetype: "Street Samurai",
    body: 1, agility: 1, reaction: 1, strength: 1,
    willpower: 1, logic: 1, intuition: 1, charisma: 1,
    edge: 2, essence: "6.0", magic: 0, resonance: 0,
    skills: "[]", qualities: "[]", spells: "[]", gear: "[]",
    contacts: "[]", cyberware: "[]",
    nuyen: 275000, karma: 25, lifestyle: "squatter",
    physicalCmMax: 10, physicalCmCurrent: 0, stunCmMax: 10, stunCmCurrent: 0,
    creationStatus: "in_progress", creationStep: "metatype",
    createdAt: Date.now(), updatedAt: Date.now(),
    ...overrides,
  };
}

describe("CharacterCreationEngine", () => {
  let characterAccessor: CharacterAccessor;
  let ollamaAccessor: OllamaAccessor;
  let engine: CharacterCreationEngine;

  beforeEach(() => {
    characterAccessor = createMockCharacterAccessor();
    ollamaAccessor = createMockOllamaAccessor();
    engine = new CharacterCreationEngine(characterAccessor, ollamaAccessor);
  });

  describe("startCreation", () => {
    it("should create a new character and return metatype prompt", async () => {
      const result = await engine.startCreation("user1", 1, "Razor");

      expect(result.characterId).toBe(1);
      expect(result.prompt).toContain("metatype");
      expect(vi.mocked(characterAccessor.createCharacter)).toHaveBeenCalledWith("user1", 1, "Razor", "human", expect.any(Number));
    });

    it("should create a standalone character when campaignId is null", async () => {
      const result = await engine.startCreation("user1", null, "Solo");

      expect(result.characterId).toBe(1);
      expect(result.prompt).toContain("metatype");
      expect(vi.mocked(characterAccessor.createCharacter)).toHaveBeenCalledWith("user1", null, "Solo", "human", expect.any(Number));
      expect(vi.mocked(characterAccessor.getCharacterByUserAndCampaign)).not.toHaveBeenCalled();
    });

    it("should resume in-progress character when starting standalone creation", async () => {
      vi.mocked(characterAccessor.getInProgressCharacterForUser).mockResolvedValue(
        makeCharacterRow({ id: 5, creationStep: "skills" }),
      );

      const result = await engine.startCreation("user1", null, "Solo");

      expect(result.characterId).toBe(5);
      expect(result.prompt).toContain("skills");
      expect(vi.mocked(characterAccessor.createCharacter)).not.toHaveBeenCalled();
    });

    it("should return existing complete character without recreating", async () => {
      vi.mocked(characterAccessor.getCharacterByUserAndCampaign).mockResolvedValue(
        makeCharacterRow({ creationStatus: "complete" }),
      );

      const result = await engine.startCreation("user1", 1, "Razor");

      expect(result.prompt).toContain("already have a character");
      expect(vi.mocked(characterAccessor.createCharacter)).not.toHaveBeenCalled();
    });
  });

  describe("processStep - metatype", () => {
    it("should accept a valid metatype", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(makeCharacterRow());

      const result = await engine.processStep(1, "elf");

      expect(result.nextStep).toBe("archetype");
      expect(result.response).toContain("Elf");
      expect(vi.mocked(characterAccessor.updateCharacter)).toHaveBeenCalled();
      expect(vi.mocked(characterAccessor.setCreationStep)).toHaveBeenCalledWith(1, "archetype");
    });

    it("should reject an invalid metatype", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(makeCharacterRow());

      const result = await engine.processStep(1, "dragon");

      expect(result.nextStep).toBe("metatype");
      expect(result.response).toContain("not a valid metatype");
    });
  });

  describe("processStep - archetype", () => {
    it("should accept a valid archetype", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "archetype" }),
      );

      const result = await engine.processStep(1, "Decker");

      expect(result.nextStep).toBe("attributes");
      expect(result.response).toContain("Decker");
    });

    it("should reject an invalid archetype", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "archetype" }),
      );

      const result = await engine.processStep(1, "Wizard");

      expect(result.nextStep).toBe("archetype");
      expect(result.response).toContain("Don't know that one");
    });
  });

  describe("processStep - attributes", () => {
    it("should accept valid attribute distribution", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "attributes" }),
      );

      // Human mins are all 1 (total 8), so 8+24=32 total needed
      const result = await engine.processStep(1, "4 4 4 4 4 4 4 4");

      expect(result.nextStep).toBe("skills");
      expect(result.response).toContain("skills");
    });

    it("should reject wrong number of values", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "attributes" }),
      );

      const result = await engine.processStep(1, "4 4 4");

      expect(result.nextStep).toBe("attributes");
      expect(result.response).toContain("8 numbers");
    });

    it("should reject attributes exceeding metatype max", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "attributes" }),
      );

      const result = await engine.processStep(1, "7 4 4 4 3 3 3 4");

      expect(result.nextStep).toBe("attributes");
      expect(result.response).toContain("must be between");
    });
  });

  describe("processStep - skills", () => {
    it("should accept valid skill allocation", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "skills" }),
      );

      const result = await engine.processStep(1, "Pistols:5, Sneaking:4, Perception:3");

      expect(result.nextStep).toBe("qualities");
      expect(result.response).toContain("qualities");
    });

    it("should reject skills exceeding point total", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "skills" }),
      );

      const result = await engine.processStep(1, "Pistols:6, Sneaking:6, Perception:6, Con:6, Hacking:6, Computer:6, Automatics:6");

      expect(result.nextStep).toBe("skills");
      expect(result.response).toContain("only have 36");
    });
  });

  describe("processStep - qualities", () => {
    it("should accept qualities with skip", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "qualities" }),
      );

      const result = await engine.processStep(1, "skip");

      expect(result.response).toContain("shopping");
    });

    it("should accept positive and negative qualities", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "qualities" }),
      );

      const result = await engine.processStep(1, "+Toughness, -SINner");

      expect(result.response).toContain("1 positive");
      expect(result.response).toContain("1 negative");
    });
  });

  describe("processStep - review", () => {
    it("should finalize character on 'done'", async () => {
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(
        makeCharacterRow({ creationStep: "review" }),
      );

      const result = await engine.processStep(1, "done");

      expect(result.complete).toBe(true);
      expect(result.response).toContain("locked and loaded");
      expect(vi.mocked(characterAccessor.markCreationComplete)).toHaveBeenCalledWith(1);
    });

    it("should allow going back to a previous step", async () => {
      const char = makeCharacterRow({ creationStep: "review" });
      vi.mocked(characterAccessor.getCharacter).mockResolvedValue(char);

      const result = await engine.processStep(1, "attributes");

      expect(result.nextStep).toBe("attributes");
      expect(vi.mocked(characterAccessor.setCreationStep)).toHaveBeenCalledWith(1, "attributes");
    });
  });

  describe("getCreationStatus", () => {
    it("should return null for completed characters", async () => {
      vi.mocked(characterAccessor.getCharacterByUserAndCampaign).mockResolvedValue(
        makeCharacterRow({ creationStatus: "complete" }),
      );

      const status = await engine.getCreationStatus("user1", 1);

      expect(status).toBeNull();
    });

    it("should return status for in-progress characters", async () => {
      vi.mocked(characterAccessor.getCharacterByUserAndCampaign).mockResolvedValue(
        makeCharacterRow({ creationStep: "skills" }),
      );

      const status = await engine.getCreationStatus("user1", 1);

      expect(status).not.toBeNull();
      expect(status!.currentStep).toBe("skills");
    });
  });
});
