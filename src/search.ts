import type { MonsterHabitat, Npc, Quest } from "./types";

export const normalizeSearch = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function searchData(query: string, quests: Quest[], npcs: Npc[], monsters: MonsterHabitat[] = []) {
  const term = normalizeSearch(query);
  if (!term) return { quests, npcs };

  const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
  const questMatches = quests.filter((quest) => normalizeSearch([
    quest.name,
    quest.level,
    quest.town,
    npcById.get(quest.giverNpcId)?.name,
    ...quest.relatedNpcIds.map((id) => npcById.get(id)?.name),
    ...quest.targetMonsterIds.map((id) => monsterById.get(id)?.name),
    ...quest.steps,
    ...quest.rewards,
  ].filter(Boolean).join(" ")).includes(term));

  const npcMatches = npcs.filter((npc) => normalizeSearch([
    npc.name,
    npc.role,
    npc.town,
    ...npc.aliases,
  ].filter(Boolean).join(" ")).includes(term));

  return { quests: questMatches, npcs: npcMatches };
}

export function questsForLevelRange(quests: Quest[], currentLevel: number | null) {
  if (currentLevel === null || !Number.isInteger(currentLevel) || currentLevel < 1) return quests;
  const minimum = Math.max(1, currentLevel - 5);
  const maximum = currentLevel + 10;
  return quests.filter((quest) => quest.level >= minimum && quest.level <= maximum);
}

export function npcIdsForResults(quests: Quest[], npcs: Npc[]) {
  return new Set([
    ...npcs.map((npc) => npc.id),
    ...quests.flatMap((quest) => [quest.giverNpcId, ...quest.relatedNpcIds]),
  ]);
}

export function npcIdsForMap(query: string, showAll: boolean, quests: Quest[], matchedNpcs: Npc[], allNpcs: Npc[]) {
  return showAll || !normalizeSearch(query)
    ? new Set(allNpcs.map((npc) => npc.id))
    : npcIdsForResults(quests, matchedNpcs);
}
