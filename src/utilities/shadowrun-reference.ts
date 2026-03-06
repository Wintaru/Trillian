import type { MetatypeData } from "../types/shadowrun-contracts.js";

export const METATYPE_DATA: Record<string, MetatypeData> = {
  human: {
    name: "Human",
    description: "The most common metatype. Balanced attributes across the board with no extremes — but they get extra Edge (luck), making them surprisingly versatile. Good at everything, masters of nothing.",
    attributeLimits: {
      body: { min: 1, max: 6 },
      agility: { min: 1, max: 6 },
      reaction: { min: 1, max: 6 },
      strength: { min: 1, max: 6 },
      willpower: { min: 1, max: 6 },
      logic: { min: 1, max: 6 },
      intuition: { min: 1, max: 6 },
      charisma: { min: 1, max: 6 },
    },
    racialAbilities: ["+1 Edge"],
    startingEdge: 2,
  },
  elf: {
    name: "Elf",
    description: "Tall, graceful, and long-lived. Higher potential for Agility and Charisma, making them natural Faces, infiltrators, and sharpshooters. Low-light vision lets them see in dim conditions. Often viewed with a mix of envy and suspicion by other metatypes.",
    attributeLimits: {
      body: { min: 1, max: 6 },
      agility: { min: 1, max: 7 },
      reaction: { min: 1, max: 6 },
      strength: { min: 1, max: 6 },
      willpower: { min: 1, max: 6 },
      logic: { min: 1, max: 6 },
      intuition: { min: 1, max: 6 },
      charisma: { min: 1, max: 8 },
    },
    racialAbilities: ["Low-light vision"],
    startingEdge: 1,
  },
  dwarf: {
    name: "Dwarf",
    description: "Short but stout. High Body and Strength caps make them surprisingly tough, and extra Willpower means strong mental defenses. Thermographic vision lets them see heat signatures in total darkness. Naturally resistant to toxins and diseases.",
    attributeLimits: {
      body: { min: 3, max: 8 },
      agility: { min: 1, max: 6 },
      reaction: { min: 1, max: 5 },
      strength: { min: 3, max: 8 },
      willpower: { min: 2, max: 7 },
      logic: { min: 1, max: 6 },
      intuition: { min: 1, max: 6 },
      charisma: { min: 1, max: 6 },
    },
    racialAbilities: ["Thermographic vision", "+2 dice vs. pathogens/toxins"],
    startingEdge: 1,
  },
  ork: {
    name: "Ork",
    description: "Big, strong, and tough. The highest Body cap of the common metatypes and great Strength — ideal for frontline fighters and heavy hitters. Lower Logic and Charisma caps mean they struggle with tech and social situations. Low-light vision included.",
    attributeLimits: {
      body: { min: 4, max: 9 },
      agility: { min: 1, max: 6 },
      reaction: { min: 1, max: 6 },
      strength: { min: 3, max: 8 },
      willpower: { min: 1, max: 6 },
      logic: { min: 1, max: 5 },
      intuition: { min: 1, max: 6 },
      charisma: { min: 1, max: 5 },
    },
    racialAbilities: ["Low-light vision"],
    startingEdge: 1,
  },
  troll: {
    name: "Troll",
    description: "Massive and terrifying. The strongest and toughest metatype with natural dermal armor and extended melee reach. The tradeoff: lower caps on Agility, Logic, Intuition, and Charisma. Thermographic vision lets them see in total darkness. When a Troll walks into a room, people notice.",
    attributeLimits: {
      body: { min: 5, max: 10 },
      agility: { min: 1, max: 5 },
      reaction: { min: 1, max: 6 },
      strength: { min: 5, max: 10 },
      willpower: { min: 1, max: 6 },
      logic: { min: 1, max: 5 },
      intuition: { min: 1, max: 5 },
      charisma: { min: 1, max: 4 },
    },
    racialAbilities: ["Thermographic vision", "+1 Reach", "+1 dermal armor"],
    startingEdge: 1,
  },
};

export const ARCHETYPES = [
  "Street Samurai",
  "Decker",
  "Rigger",
  "Mage",
  "Shaman",
  "Adept",
  "Mystic Adept",
  "Technomancer",
  "Face",
  "Physical Infiltrator",
  "Weapons Specialist",
] as const;

export const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  "Street Samurai": "Cybernetically enhanced combat specialist. Wired reflexes, dermal armor, and smartlinked weapons make them the deadliest fighters on the street. Heavy on cyberware, which costs Essence (and limits magic potential).",
  "Decker": "Elite hacker who jacks into the Matrix to crack systems, steal data, and disable security. Uses a cyberdeck to navigate virtual reality. The team's eyes and ears in the digital world.",
  "Rigger": "Controls drones and vehicles through a direct neural interface. Can scout with flying drones, fight with combat drones, and drive the getaway car — all at the same time. Tech-heavy role.",
  "Mage": "Hermetic spellcaster who uses logic and formulae to channel magic. Can cast combat spells, illusions, heal allies, and manipulate minds. Drains based on Logic + Willpower. Avoid cyberware — it kills your Essence and weakens magic.",
  "Shaman": "Spiritual spellcaster who draws power from nature spirits and totems. Similar abilities to a Mage but drains based on Charisma + Willpower. Often better at summoning spirits than direct combat magic.",
  "Adept": "Channels magic internally to enhance physical abilities — superhuman speed, unbreakable bones, killing hands. No spells, but doesn't need a cyberdeck or gun either. A martial arts master powered by mana.",
  "Mystic Adept": "A hybrid of Mage and Adept — can cast spells AND enhance physical abilities with magic. Extremely versatile but spreads thin. Jack of two trades.",
  "Technomancer": "Born with the ability to interface with the Matrix using only their mind — no cyberdeck needed. Can compile sprites (digital spirits) and use complex forms (innate Matrix abilities). Rare and mysterious.",
  "Face": "The smooth talker. Masters of social engineering — negotiation, disguise, intimidation, and manipulation. Gets the team through doors that guns can't open. Often augmented with tailored pheromones and voice modulators.",
  "Physical Infiltrator": "Stealth and breaking-and-entering specialist. Expert at sneaking past guards, bypassing locks, disabling alarms, and getting into places uninvited. The team's ghost.",
  "Weapons Specialist": "Pure combat focus without the cyberware dependency. Master of multiple weapon types — firearms, melee, thrown, heavy weapons. Less chrome than a Street Samurai, more versatility in the armory.",
};

export const ATTRIBUTE_DESCRIPTIONS: Record<string, string> = {
  body: "**Body (BOD)** — Toughness, health, and resistance to damage. Determines your Physical Condition Monitor (how much damage you can take before going down) and helps soak incoming hits.",
  agility: "**Agility (AGI)** — Coordination, dexterity, and fine motor skills. Used for shooting, sneaking, lockpicking, melee combat, and most physical skills. The most skill-linked attribute.",
  reaction: "**Reaction (REA)** — Reflexes and response time. Determines Initiative (how fast you act in combat) and your defense against attacks. Paired with Intuition for dodging.",
  strength: "**Strength (STR)** — Raw physical power. Affects melee damage, carrying capacity, and some physical skills like running and swimming. Important for melee fighters.",
  willpower: "**Willpower (WIL)** — Mental toughness and determination. Determines your Stun Condition Monitor, helps resist magic and social manipulation, and is used for spell drain resistance.",
  logic: "**Logic (LOG)** — Reasoning, memory, and analytical thinking. The key attribute for Deckers (hacking), mechanics, medicine, and any knowledge-based skill. Hermetic mages use it to resist drain.",
  intuition: "**Intuition (INT)** — Gut feelings, awareness, and street smarts. Used for Perception, tracking, navigation, and Initiative. High Intuition means you notice things others miss.",
  charisma: "**Charisma (CHA)** — Force of personality, social presence, and persuasiveness. The key attribute for Faces — used for negotiation, con, intimidation, and leadership. Shamans use it for drain resistance.",
};

export const MAGIC_ARCHETYPES = ["Mage", "Shaman", "Adept", "Mystic Adept", "Technomancer"];

export const SKILL_LIST = {
  agility: [
    "Archery", "Automatics", "Blades", "Clubs", "Escape Artist",
    "Exotic Ranged Weapon", "Gymnastics", "Heavy Weapons", "Locksmith",
    "Longarms", "Palming", "Pistols", "Sneaking", "Throwing Weapons", "Unarmed Combat",
  ],
  body: ["Diving", "Free-Fall"],
  reaction: ["Pilot Ground Craft", "Pilot Aircraft", "Pilot Watercraft", "Pilot Exotic Vehicle"],
  strength: ["Running", "Swimming"],
  charisma: [
    "Animal Handling", "Con", "Etiquette", "Impersonation", "Instruction",
    "Intimidation", "Leadership", "Negotiation", "Performance",
  ],
  intuition: [
    "Artisan", "Assensing", "Disguise", "Navigation", "Perception", "Tracking",
  ],
  logic: [
    "Aeronautics Mechanic", "Arcana", "Armorer", "Automotive Mechanic",
    "Biotechnology", "Chemistry", "Computer", "Cybercombat", "Cybertechnology",
    "Demolitions", "Electronic Warfare", "First Aid", "Forgery", "Hacking",
    "Hardware", "Industrial Mechanic", "Medicine", "Nautical Mechanic", "Software",
  ],
  willpower: ["Astral Combat", "Survival"],
  magic: ["Alchemy", "Artificing", "Banishing", "Binding", "Counterspelling", "Disenchanting", "Ritual Spellcasting", "Spellcasting", "Summoning"],
  resonance: ["Compiling", "Decompiling", "Registering"],
} as const;

export const LIFESTYLE_COSTS: Record<string, number> = {
  street: 0,
  squatter: 500,
  low: 2000,
  middle: 5000,
  high: 10000,
  luxury: 100000,
};

export const CHARACTER_CREATION = {
  attributePoints: 24,
  skillPoints: 36,
  skillGroupPoints: 5,
  qualityKarmaLimit: 25,
  startingKarma: 25,
  startingNuyenByArchetype: {
    "Street Samurai": 275000,
    "Decker": 275000,
    "Rigger": 275000,
    "Mage": 50000,
    "Shaman": 50000,
    "Adept": 140000,
    "Mystic Adept": 50000,
    "Technomancer": 140000,
    "Face": 275000,
    "Physical Infiltrator": 275000,
    "Weapons Specialist": 275000,
  } as Record<string, number>,
  defaultStartingNuyen: 140000,
} as const;

export const CONDENSED_RULES_PROMPT = `SHADOWRUN 5E RULES SUMMARY:

SETTING: The year is 2078. Megacorporations rule the world with extraterritorial sovereignty. Magic returned in 2011 (the Awakening), and metahumanity includes humans, elves, dwarves, orks, and trolls. The Matrix is a pervasive wireless augmented/virtual reality network. Shadowrunners are deniable criminal operatives hired by corps, fixers, and other shady employers (Mr. Johnsons) for jobs the client can't be seen doing.

DICE SYSTEM: All tests use d6 dice pools (Attribute + Skill + modifiers). Each die showing 5 or 6 = 1 hit. Hits are capped by the applicable Limit (Physical, Mental, or Social). A glitch occurs when more than half the dice show 1s. A critical glitch is a glitch with zero hits — catastrophic failure.

LIMITS: Physical Limit = ceil((STR*2 + BOD + REA) / 3). Mental Limit = ceil((LOG*2 + INT + WIL) / 3). Social Limit = ceil((CHA*2 + WIL + ESS) / 3).

COMBAT: Initiative = REA + INT + 1d6. Ranged attack: Weapon Skill + AGI [Accuracy] vs. REA + INT. Net hits add to weapon Damage Value (DV). If modified DV > Armor, damage is Physical; otherwise Stun. Soak roll: BOD + Armor, each hit reduces DV by 1.

CONDITION MONITORS: Physical CM = ceil(BOD/2) + 8. Stun CM = ceil(WIL/2) + 8. Every 3 boxes filled = -1 wound modifier to all pools. Stun overflow becomes Physical. Physical overflow beyond BOD = death.

MAGIC: Spellcasting + Magic [Force] vs. threshold or opposed. Drain = Force-dependent; if Force > Magic, drain is Physical. Hermetic drain: LOG + WIL. Shamanic drain: CHA + WIL. Summoning: Summoning + Magic vs. Spirit Force; net hits = services owed.

MATRIX: Deckers use cyberdecks with Attack, Sleaze, Data Processing, Firewall. Getting marks requires Hacking + LOG [Sleaze] (stealthy) or Cybercombat + LOG [Attack] (loud). Overwatch Score accumulates; at 40, GOD converges — forced reboot and location revealed.

EDGE: Spend to Push the Limit (add Edge dice, ignore limit), Second Chance (reroll failures), Seize Initiative, or Blitz (5d6 initiative). Burn Edge to survive death or auto-succeed with 4 net hits.

CAMPAIGN STRUCTURE: Mr. Johnson meet → Legwork/investigation → Planning → The Run → Extraction/handoff → Payment. Nuyen is currency. Runners typically lack legal SINs. Contacts have Connection (usefulness) and Loyalty (willingness) ratings.`;

export const GM_SYSTEM_PROMPT_PREFIX = `You are a Shadowrun 5th Edition Game Master running a campaign on Discord. Stay in character at all times as a gritty, atmospheric storyteller narrating a cyberpunk-fantasy world.

Your responsibilities:
- Describe scenes vividly but concisely (under 1800 characters)
- Present meaningful choices and react to player decisions
- Maintain consistent NPC personalities and world state
- Call for dice rolls when the fiction demands it (skill checks, combat, social tests)
- Address players by their character names
- Keep the tone dark, immersive, and true to Shadowrun's cyberpunk-meets-magic aesthetic

When a situation requires a skill check, combat roll, or opposed test, describe up to the point where the roll is needed, then write on a new line:
[ROLL: {characterName} {pool_size}d6 ({attribute} + {skill}) limit {limit_value} - {description}]

Do NOT resolve rolls yourself. Stop and request the roll. If something would obviously succeed or fail, narrate it without a roll.

`;

export const CAMPAIGN_GENERATION_PROMPT = `You are creating a new Shadowrun 5th Edition campaign. Generate the following sections, each on its own clearly labeled line:

NAME: A short, evocative campaign name (3-5 words)
SETTING: A 2-3 paragraph description of the campaign setting, including the city/district, major factions involved, and the inciting incident.
OBJECTIVE: The initial mission objective the runners will pursue (1-2 sentences).
LOCATION: The starting location (a specific place name and brief description).
OPENING: A 2-3 paragraph opening scene narration to set the mood. End with the Mr. Johnson making the pitch to the runners.

Keep the total response under 3000 characters.`;

export const RECAP_PROMPT = `Summarize the following Shadowrun campaign events as a "Story So Far" recap for players returning after a break. Write it in second person ("You and your team...") in an engaging, narrative style that reminds players of key events, NPCs encountered, current objectives, and any unresolved threads. Keep it under 1800 characters.`;

export const PLAYER_JOIN_PROMPT = `You are a Shadowrun Game Master narrating in-character. A new runner is joining the team mid-session. Write a short, humorous, in-character narration (2-4 sentences) describing how they dramatically appear and join the group. Be creative and funny — maybe they crash through a window, fall out of a dumpster, get dropped off by an Uber, teleport in mid-sentence, etc. Use Shadowrun slang. Keep it under 500 characters.`;

export const PLAYER_LEAVE_PROMPT = `You are a Shadowrun Game Master narrating in-character. A runner is leaving the team. Write a short, humorous, in-character narration (2-4 sentences) describing their dramatic exit. Be creative and funny — maybe they get a mysterious phone call and sprint away, accidentally activate a teleportation spell, get abducted by a passing drone, vanish in a puff of smoke while muttering about "another job," etc. Use Shadowrun slang. Keep it under 500 characters.`;
