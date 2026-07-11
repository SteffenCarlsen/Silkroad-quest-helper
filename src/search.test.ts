import { describe, expect, it } from "vitest";
import npcData from "./data/npcs.json";
import monsterHabitatData from "./data/monster-habitats.json";
import questData from "./data/quests.json";
import { normalizeSearch, npcIdsForMap, questsForLevelRange, searchData } from "./search";
import type { MonsterHabitat, Npc, Quest } from "./types";

const npcs = npcData as Npc[];
const quests = questData as Quest[];
const monsters = monsterHabitatData.monsters as MonsterHabitat[];

describe("search", () => {
  it("normalizes punctuation, spacing, and case", () => {
    expect(normalizeSearch("  Adventurer’s   Stone! ")).toBe("adventurer s stone");
  });

  it("finds quests through titles, rewards, levels, and NPC aliases", () => {
    expect(searchData("Yangyun", quests, npcs).quests.length).toBeGreaterThan(0);
    expect(searchData("copper ring", quests, npcs).quests.some((quest) => quest.name === "Chinese Tutorial")).toBe(true);
    expect(searchData("level-does-not-exist", quests, npcs).quests).toHaveLength(0);
    expect(searchData("SONHEYON", quests, npcs).npcs.some((npc) => npc.name === "General Sonhyeon")).toBe(true);
  });

  it("finds quests through mapped target monster names", () => {
    expect(searchData("Evil Yeti", quests, npcs, monsters).quests.some((quest) => quest.name === "Yeti stick")).toBe(true);
  });

  it("keeps all map markers only when the always-show option is enabled", () => {
    const results = searchData("Yangyun", quests, npcs);
    expect(npcIdsForMap("Yangyun", false, results.quests, results.npcs, npcs).size).toBe(6);
    expect(npcIdsForMap("Yangyun", true, results.quests, results.npcs, npcs).size).toBe(697);
  });

  it("filters quests from five levels below through ten above", () => {
    const ranged = questsForLevelRange(quests, 49);
    expect(ranged.every((quest) => quest.level >= 44 && quest.level <= 59)).toBe(true);
    expect(ranged.some((quest) => quest.name === "Sweeping Mujigi")).toBe(true);
    expect(questsForLevelRange(quests, null)).toHaveLength(quests.length);
  });

});
