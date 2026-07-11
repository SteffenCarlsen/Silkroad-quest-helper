import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const [quests, npcs, audit, sources, habitatData] = await Promise.all([
  read("quests.json"),
  read("npcs.json"),
  read("mapping-audit.json"),
  read("sources.json"),
  read("monster-habitats.json"),
]);

assert.equal(quests.length, 91, "The dataset must contain 88 parsed and 3 supplemental quests");
assert.equal(npcs.length, 697, "The pinned xSROMap snapshot must contain 697 NPCs");
assert.equal(audit.unmatchedGivers.length, 0, "Every quest giver must be reviewed and mapped");
assert.equal(audit.unmatchedRelated.length, 0, "Every related NPC mention must be resolved or excluded as a non-NPC");
assert.equal(audit.unresolvedPrerequisites.length, 0, "Every named prerequisite must resolve");
assert.ok(audit.sourceWarnings.length > 0, "Known source incompleteness must remain recorded");
assert.ok(audit.matched.filter((match) => match.method === "override").every((match) => match.review), "Every manual mapping override needs review evidence");

const unique = (items, label) => {
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
  assert.deepEqual(ids, Array.from({ length: ids.length }, (_, index) => index + 1), `${label} IDs must remain stable and sequential`);
};
unique(quests, "Quest");
unique(npcs, "NPC");

const questIds = new Set(quests.map((quest) => quest.id));
const npcIds = new Set(npcs.map((npc) => npc.id));
const monsterIds = new Set(habitatData.monsters.map((monster) => monster.id));
for (const npc of npcs) {
  assert.ok(npc.name, `NPC ${npc.id} needs a name`);
  assert.ok(Number.isFinite(npc.mapPosition.lat) && Number.isFinite(npc.mapPosition.lng), `NPC ${npc.id} needs a finite map position`);
  assert.ok(Number.isInteger(npc.position.region) && npc.position.region <= 32767, `NPC ${npc.id} must be on the supported world map`);
}

for (const quest of quests) {
  assert.ok(quest.name && Number.isInteger(quest.level), `Quest ${quest.id} needs a name and level`);
  assert.ok(npcIds.has(quest.giverNpcId), `Quest ${quest.id} has an invalid giver`);
  assert.ok(quest.steps.length > 0, `Quest ${quest.id} needs at least one source-derived step`);
  for (const id of quest.relatedNpcIds) assert.ok(npcIds.has(id), `Quest ${quest.id} has invalid related NPC ${id}`);
  for (const id of quest.targetMonsterIds) assert.ok(monsterIds.has(id), `Quest ${quest.id} has invalid target monster ${id}`);
  for (const id of quest.prerequisiteQuestIds) assert.ok(questIds.has(id), `Quest ${quest.id} has invalid prerequisite ${id}`);
  for (const id of quest.mutuallyExclusiveQuestIds) {
    const related = quests.find((candidate) => candidate.id === id);
    assert.ok(related?.mutuallyExclusiveQuestIds.includes(quest.id), `Mutual exclusion ${quest.id}<->${id} must be symmetric`);
  }
}

const sweepingMujigi = quests.find((quest) => quest.name === "Sweeping Mujigi");
assert.deepEqual(sweepingMujigi?.targetMonsterIds, [1991, 2110], "Sweeping Mujigi must target the PK2 Mujigi and Ujigi records");
for (const id of sweepingMujigi.targetMonsterIds) {
  const monster = habitatData.monsters.find((candidate) => candidate.id === id);
  assert.equal(monster.habitatRegions.length, 3, `${monster.name} must retain all three known guide habitats`);
  assert.ok(monster.guidePosition, `${monster.name} must have a representative guide pin`);
}
for (const name of ["Noise Pollution", "The Powerful Looking Accessory"]) {
  const quest = quests.find((candidate) => candidate.name === name);
  assert.equal(quest?.level, 50, `${name} must be level 50`);
  assert.equal(quest?.giverNpcId, 606, `${name} must be given by Soldier Pao`);
  assert.deepEqual(quest?.targetMonsterIds, [2110], `${name} must target Ujigi`);
  assert.equal(quest?.rewards.length, 3, `${name} must retain all screenshot rewards`);
}
const pedestrianSafety = quests.find((quest) => quest.name === "Ensuring Pedestrian Safety");
assert.equal(pedestrianSafety?.level, 49, "Ensuring Pedestrian Safety must be level 49");
assert.equal(pedestrianSafety?.giverNpcId, 318, "Ensuring Pedestrian Safety must be given by Merchant Associate Asaman");
assert.deepEqual(pedestrianSafety?.targetMonsterIds, [1991], "Ensuring Pedestrian Safety must target Mujigi");
assert.deepEqual(pedestrianSafety?.rewards, ["exp: 953,500", "sxp: 15,000", "gold: 79,000"], "Ensuring Pedestrian Safety must retain all screenshot rewards");

const maximumPlan = `v1.${quests.map((quest) => quest.id).join(".")}`;
assert.ok(maximumPlan.length < 3800, "A plan containing every quest must fit the supported cookie budget");
assert.equal(sources.xSROMap.commit, "52bfffef4467", "xSROMap import must stay pinned");
assert.equal(sources.xSROMap.license, "MIT", "xSROMap license metadata must be retained");
assert.match(sources.xSROMap.sha256, /^[a-f0-9]{64}$/);
assert.match(sources.questList.sha256, /^[a-f0-9]{64}$/);

console.log(`Validated ${quests.length} quests, ${npcs.length} NPCs, all relationships, and a ${maximumPlan.length}-byte maximum plan.`);
