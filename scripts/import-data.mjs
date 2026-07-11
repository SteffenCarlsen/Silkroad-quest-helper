import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { load } from "cheerio";

const MAP_COMMIT = "52bfffef4467";
const MAP_URL = `https://raw.githubusercontent.com/JellyBitz/xSROMap/${MAP_COMMIT}/assets/js/main.js`;
const QUEST_API = "https://public-api.wordpress.com/rest/v1.1/sites/shinakuma.wordpress.com/posts/slug:questler-lvl-1-80";
const QUEST_URL = "https://shinakuma.wordpress.com/2007/02/23/questler-lvl-1-80/";
const SUPPLEMENTAL_QUEST_URL = "https://www.elitepvpers.com/forum/sro-pserver-advertising/4192961-warriors-way-online-cap-100-eu-ch-non-bot-zero-edits-12.html";
const OUTPUT = new URL("../src/data/", import.meta.url);
const overrides = JSON.parse(await readFile(new URL("./npc-overrides.json", import.meta.url), "utf8"));
const habitatData = JSON.parse(await readFile(new URL("../src/data/monster-habitats.json", import.meta.url), "utf8"));

const monsterOverrides = new Map([
  ["small eye ghost", 1934],
  ["big eye ghost", 1935],
  ["bandit subordinates", 1948],
  ["tiger champion", 1947],
  ["heukyeowa", 2104],
  ["devil yeti", 2118],
  ["dark kara", 3797],
  ["death kara", 3799],
  ["gold silver yachal", 3671],
  ["diamond yachal", 1975],
]);

const normalize = (value) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const clean = (value) => value
  .replace(/\u00a0/g, " ")
  .replace(/[?]/g, "'")
  .replace(/\s+/g, " ")
  .trim();

const singularMonsterName = (value) => normalize(value).split(" ").map((word) => {
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}).join(" ");

function matchMonster(name, questLevel) {
  const cleanedName = clean(name).replace(/^Kill\s+\d+\s+/i, "");
  const overrideId = monsterOverrides.get(normalize(cleanedName));
  if (overrideId) return habitatData.monsters.find((monster) => monster.id === overrideId) ?? null;
  const key = singularMonsterName(cleanedName);
  return habitatData.monsters
    .filter((monster) => singularMonsterName(monster.name) === key)
    .sort((left, right) => Math.abs(left.level - questLevel) - Math.abs(right.level - questLevel) || left.id - right.id)[0] ?? null;
}

const textWithBreaks = (element) => {
  const copy = element.clone();
  copy.find("br").replaceWith("\n");
  copy.find("p").each((_, item) => $(item).append("\n"));
  return clean(copy.text().replace(/\s*\n\s*/g, "\n"));
};

const hash = (value) => createHash("sha256").update(value).digest("hex");
const number = (value) => Number(String(value).replace(/[^0-9-]/g, ""));

function parseNpcMention(value) {
  const text = clean(value);
  const coordinate = text.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
  return {
    name: clean(coordinate ? text.slice(0, coordinate.index) : text.replace(/\(.*?\)/g, "")),
    posX: coordinate ? Number(coordinate[1]) : null,
    posY: coordinate ? Number(coordinate[2]) : null,
  };
}

function mapPosition(npc) {
  return {
    lat: ((npc.region >> 8) & 0xff) + npc.y / 1920 - 1,
    lng: (npc.region & 0xff) + npc.x / 1920,
  };
}

function gamePosition(npc) {
  const map = mapPosition(npc);
  return { posX: (map.lng - 135) * 192, posY: (map.lat - 91) * 192 };
}

function candidateScore(mention, npc) {
  const wanted = normalize(mention.name);
  const actual = normalize(npc.name);
  const wantedWords = wanted.split(" ");
  const actualWords = actual.split(" ");
  let nameScore = 0;
  if (actual === wanted) nameScore = 100;
  else if (actual.endsWith(wanted)) nameScore = 90;
  else if (actual.includes(wanted)) nameScore = 80;
  else if (wantedWords.every((word) => actualWords.includes(word))) nameScore = 75;
  else if (wantedWords.at(-1) === actualWords.at(-1)) nameScore = 60;

  let distance = null;
  if (mention.posX !== null && mention.posY !== null) {
    const game = gamePosition(npc);
    distance = Math.hypot(game.posX - mention.posX, game.posY - mention.posY);
  }
  return { npc, nameScore, distance, score: nameScore - Math.min(distance ?? 0, 1000) / 100 };
}

function matchNpc(mention, npcs) {
  const key = normalize(mention.name);
  if (overrides[key] !== undefined) {
    const override = overrides[key];
    const npc = npcs.find((candidate) => candidate.id === override.npcId);
    return npc ? { npc, method: "override", review: override.reason } : null;
  }

  const ranked = npcs.map((npc) => candidateScore(mention, npc)).sort((a, b) => b.score - a.score);
  const coordinateMatch = ranked
    .filter((candidate) => candidate.distance !== null)
    .sort((a, b) => a.distance - b.distance)[0];
  if (coordinateMatch && coordinateMatch.distance <= 12 && coordinateMatch.nameScore >= 60) {
    return { npc: coordinateMatch.npc, method: "name+coordinate", distance: coordinateMatch.distance };
  }

  const nameMatches = ranked.filter((candidate) => candidate.nameScore >= 75);
  if (nameMatches.length === 1) return { npc: nameMatches[0].npc, method: "name" };
  if (nameMatches.length > 1 && nameMatches[0].score - nameMatches[1].score >= 10) {
    return { npc: nameMatches[0].npc, method: "ranked-name", distance: nameMatches[0].distance };
  }
  return null;
}

function splitRewards(value) {
  return clean(value)
    .replace(/\s+(?=(?:exp|sxp|gold|item)\s*:)/gi, "\n")
    .split(/\n|(?=Step\s*\d+\s*:)/i)
    .map(clean)
    .filter(Boolean);
}

function splitSteps(value) {
  const objective = value
    .replace(/^Get the quest from[\s\S]*?\([^)]*-?\d+\s*,\s*-?\d+\s*\)\s*/i, "")
    .replace(/Required Quest\s*:[\s\S]*?(?=(?:Note|PS)\s*:|$)/i, "")
    .replace(/(?:Note|PS)\s*:[\s\S]*$/i, "")
    .replace(/(?=Step\s*\d+\s*:)/gi, "\n")
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .map((step) => clean(step
      .replace(/^Step\s*(\d+)\s*:/i, "Step $1: ")
      .replace(/\bgo back(?: and)? talk to\b/gi, "return to")
      .replace(/\bTalk to\b/gi, "Speak with")
      .replace(/\bKill\b/gi, "Defeat")
      .replace(/\bCollect\b/gi, "Gather")
      .replace(/\bDeliver\b/gi, "Take")
      .replace(/\bonce it drop\b/gi, "until one drops")
      .replace(/\bgo back and give it to\b/gi, "bring it to")));
  return objective.length ? objective : ["Speak with the quest giver; the supplied source provides no further objective details."];
}

const [mapResponse, questResponse] = await Promise.all([fetch(MAP_URL), fetch(QUEST_API)]);
if (!mapResponse.ok) throw new Error(`xSROMap download failed: ${mapResponse.status}`);
if (!questResponse.ok) throw new Error(`Quest download failed: ${questResponse.status}`);
const mapSource = await mapResponse.text();
const questPost = await questResponse.json();

const literal = mapSource.match(/var NPCs=(\[[\s\S]*?\]);/)?.[1];
if (!literal) throw new Error("NPC array not found in pinned xSROMap main.js");
const rawNpcs = vm.runInNewContext(`(${literal})`, Object.create(null), {
  timeout: 1000,
  codeGeneration: { strings: false, wasm: false },
});

const npcs = rawNpcs.map((npc, index) => {
  const words = clean(npc.name).split(" ");
  return {
    id: index + 1,
    name: clean(npc.name),
    role: words.length > 1 ? words.slice(0, -1).join(" ") : null,
    town: null,
    aliases: [],
    position: { x: npc.x, y: npc.y, z: npc.z, region: npc.region, coordinateSystem: "client" },
    mapPosition: mapPosition(npc),
  };
});

const $ = load(questPost.content);
const questRows = $("table").filter((_, table) => $(table).find("tr").first().text().includes("Description"))
  .first().find("tr").toArray();
const drafts = [];

for (const row of questRows) {
  const cells = $(row).children("td");
  if (cells.length !== 5) continue;
  const levelText = clean(cells.eq(1).text());
  const repeatText = clean(cells.eq(2).text());
  if (!/^\d+$/.test(levelText) || !/^\d+$/.test(repeatText)) continue;

  const descriptionCell = cells.eq(3);
  const description = textWithBreaks(descriptionCell);
  const rewardText = textWithBreaks(cells.eq(4));
  const mentions = descriptionCell.find(".links11t01").toArray()
    .filter((element) => /\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test($(element).text()) || $(element).find(".monster").length === 0)
    .map((element) => parseNpcMention($(element).text()))
    .filter((mention) => mention.name);
  const uniqueMentions = mentions.filter((mention, index) =>
    mentions.findIndex((candidate) => normalize(candidate.name) === normalize(mention.name)) === index);
  const prerequisiteNames = descriptionCell.find(".quest").toArray().map((element) => clean($(element).text())).filter(Boolean);
  const monsterNames = descriptionCell.find(".monster").toArray()
    .map((element) => clean($(element).text()))
    .filter((name) => name && normalize(name) !== "monsters")
    .filter((name, index, names) => names.findIndex((candidate) => normalize(candidate) === normalize(name)) === index);
  const color = cells.eq(0).attr("bgcolor")?.toLowerCase();
  const town = color === "#ffeeee" ? "Jangan" : color === "#fff4c8" ? "Donwhang" : color === "#b0dfff" ? "Hotan" : null;
  drafts.push({
    id: drafts.length + 1,
    name: clean(cells.eq(0).text()),
    level: Number(levelText),
    repeatCount: Number(repeatText),
    town,
    description,
    steps: splitSteps(description),
    rewards: splitRewards(rewardText),
    notes: [...description.matchAll(/(?:Note|PS)\s*:\s*([^\n]+)/gi)].map((match) => clean(match[0])),
    mentions: uniqueMentions,
    prerequisiteNames,
    monsterNames,
  });
}

const supplementalQuests = [
  { name: "Noise Pollution", level: 50, giver: "Soldier Pao", monster: "Ujigi", steps: ["Defeat 300 Ujigis"], rewards: ["exp: 953,500", "sxp: 18,000", "gold: 76,000"] },
  { name: "The Powerful Looking Accessory", level: 50, giver: "Soldier Pao", monster: "Ujigi", steps: ["Gather 30 Ujigi teeth"], rewards: ["exp: 953,500", "sxp: 22,000", "gold: 72,000"] },
  { name: "Ensuring Pedestrian Safety", level: 49, giver: "Merchant Associate Asaman", monster: "Mujigi", steps: ["Defeat 300 Mujigis"], rewards: ["exp: 953,500", "sxp: 15,000", "gold: 79,000"] },
  { name: "Hunting the Giant Creature", level: 57, giver: "Hunter Associate Ahmok", monster: "Big Blue Spider", steps: ["Defeat 300 Big Blue Spiders"], rewards: ["exp: 2,148,980", "sxp: 20,000", "gold: 90,000"] },
  { name: "The Threat to Warriors", level: 54, giver: "Specialty Trader Sanmok", monster: "Penon Fighter", steps: ["Defeat 300 Penon Fighters"], rewards: ["exp: 2,148,980", "sxp: 25,000", "gold: 85,000"] },
  { name: "The Curious Artisan", level: 55, giver: "Protector Trader Gonishya", monster: "Penon Warrior", steps: ["Gather 150 Broken Shield Pieces"], rewards: ["exp: 2,148,980", "sxp: 23,000", "gold: 87,000"] },
  { name: "Materials for the Cold Accessory", level: 54, giver: "Jewel Lapidary Mamoje", monster: "Penon Fighter", steps: ["Gather 150 Broken Ice Pieces"], rewards: ["exp: 2,148,980", "sxp: 25,000", "gold: 85,000"] },
  { name: "Subjugating the Frenzied Creature", level: 56, giver: "Hunter Associate Ahmok", monster: "Planar", steps: ["Defeat 300 Planars"], rewards: ["exp: 2,148,980", "sxp: 23,000", "gold: 87,000"] },
  { name: "Rumor of the Giant Spider", level: 58, giver: "Soldier Duyun", monster: "Big White Spider", steps: ["Defeat 300 Big White Spiders"], rewards: ["exp: 2,148,980", "sxp: 24,000", "gold: 86,000"] },
  { name: "The Protector of Karakoram", level: 55, giver: "Merchant Associate Asaman", monster: "Penon Warrior", steps: ["Defeat 300 Penon Warriors"], rewards: ["exp: 2,148,980", "sxp: 22,000", "gold: 88,000"] },
  { name: "The Frightening Ice Spirit", level: 57, giver: "Soldier Leihan", monster: "Sona", steps: ["Defeat 300 Sonas"], rewards: ["exp: 2,148,980", "sxp: 25,000", "gold: 83,000"] },
  { name: "The Accursed Morning Alarm", level: 56, giver: "Specialty Trader Sanmok", monster: "Planar", steps: ["Gather 250 Gory Voice Cords"], rewards: ["exp: 2,148,980", "sxp: 22,000", "gold: 88,000"] },
  { name: "The Mana Crystal of Ice Magic", level: 57, giver: "Protector Trader Gonishya", monster: "Sona", steps: ["Gather 30 Sona's Magic Globes"], rewards: ["exp: 2,148,980", "sxp: 24,000", "gold: 86,000"] },
  { name: "Turtle Invigorant", level: 57, giver: "Boat Ticket Seller Ahgon", monster: "Big Blue Spider", steps: ["Gather 150 Big Blue Spider Eggs"], rewards: ["exp: 2,148,980", "sxp: 20,000", "gold: 90,000"] },
  { name: "Very Useful Cooking Ingredient", level: 58, giver: "Potion Merchant Manina", monster: "Big White Spider", steps: ["Gather 70 Big White Spider Legs"], rewards: ["exp: 2,148,980", "sxp: 25,000", "gold: 85,000"] },
  { name: "The Endless Winter Nightmare", level: 51, giver: "Soldier Tuolan", monster: "Ishade", steps: ["Defeat 300 Ishades"], rewards: ["exp: 2,148,980", "sxp: 25,000", "gold: 85,000"] },
  { name: "Exterminating the Spiders", level: 52, giver: "Soldier Pao", monster: "Blue-face Spider", steps: ["Defeat 300 Blue Spiders"], rewards: ["exp: 2,148,980", "sxp: 25,000", "gold: 85,000"] },
  { name: "The Ceaseless Terror", level: 53, giver: "Storage-Keeper Auisan", monster: "White-face spider", steps: ["Defeat 300 White Spiders"], rewards: ["exp: 2,148,980", "sxp: 23,000", "gold: 87,000"] },
  { name: "Manina's request", level: 52, repeatCount: 3, giver: "Potion Merchant Manina", monsters: ["White-face spider", "Blue-face Spider"], steps: ["Gather 100 White-Face Spider webs"], rewards: ["exp: 1,650,000", "gold: 100,000"] },
  { name: "The Berserk Giants", level: 59, giver: "Soldier Batu", monster: "Yeti", steps: ["Defeat 300 Yetis"], rewards: ["exp: 2,148,980", "sxp: 26,000", "gold: 84,000"] },
  { name: "Subjugating the God of Evil", level: 60, giver: "Hunter Associate Ahmok", monster: "Evil-Yeti", steps: ["Defeat 300 Evil-Yetis"], rewards: ["exp: 2,148,980", "sxp: 28,000", "gold: 82,000"] },
];

for (const quest of supplementalQuests) {
  drafts.push({
    id: drafts.length + 1,
    name: quest.name,
    level: quest.level,
    repeatCount: quest.repeatCount ?? 1,
    town: "Hotan",
    description: quest.steps[0],
    steps: quest.steps,
    rewards: quest.rewards,
    notes: [],
    mentions: [parseNpcMention(quest.giver)],
    prerequisiteNames: [],
    monsterNames: quest.monsters ?? [quest.monster],
    sourceUrl: SUPPLEMENTAL_QUEST_URL,
  });
}

const audit = { matched: [], unmatchedGivers: [], unmatchedRelated: [], unmatchedMonsters: [], unresolvedPrerequisites: [], sourceWarnings: [] };
const questNameToId = new Map(drafts.map((quest) => [normalize(quest.name), quest.id]));

const quests = drafts.map((draft) => {
  const [giverMention, ...relatedMentions] = draft.mentions;
  const giverMatch = giverMention ? matchNpc(giverMention, npcs) : null;
  if (!giverMatch) audit.unmatchedGivers.push({ questId: draft.id, quest: draft.name, mention: giverMention ?? null });
  else {
    audit.matched.push({ questId: draft.id, quest: draft.name, mention: giverMention.name, npcId: giverMatch.npc.id, npc: giverMatch.npc.name, method: giverMatch.method, distance: giverMatch.distance ?? null, review: giverMatch.review ?? null });
    giverMatch.npc.town ??= draft.town;
    if (!giverMatch.npc.aliases.some((alias) => normalize(alias) === normalize(giverMention.name)) && normalize(giverMatch.npc.name) !== normalize(giverMention.name)) {
      giverMatch.npc.aliases.push(giverMention.name);
    }
  }

  const relatedNpcIds = [];
  for (const mention of relatedMentions) {
    const match = matchNpc(mention, npcs);
    if (!match) {
      audit.unmatchedRelated.push({ questId: draft.id, quest: draft.name, mention });
      continue;
    }
    if (match.npc.id !== giverMatch?.npc.id && !relatedNpcIds.includes(match.npc.id)) relatedNpcIds.push(match.npc.id);
    if (!match.npc.aliases.some((alias) => normalize(alias) === normalize(mention.name)) && normalize(match.npc.name) !== normalize(mention.name)) {
      match.npc.aliases.push(mention.name);
    }
  }

  const prerequisiteQuestIds = draft.prerequisiteNames
    .map((name) => {
      const id = questNameToId.get(normalize(name.replace(/^lv\s*\d+/i, "")));
      if (!id) audit.unresolvedPrerequisites.push({ questId: draft.id, quest: draft.name, prerequisite: name });
      return id;
    })
    .filter(Boolean);
  const mutuallyExclusiveQuestIds = [...draft.description.matchAll(/between\s+(.+?)\s+and\s+(.+?)(?:\.|,|$)/gi)]
    .flatMap((match) => [questNameToId.get(normalize(match[1])), questNameToId.get(normalize(match[2]))])
    .filter((id) => id && id !== draft.id);
  const targetMonsterIds = draft.monsterNames.map((name) => {
    const monster = matchMonster(name, draft.level);
    if (!monster) audit.unmatchedMonsters.push({ questId: draft.id, quest: draft.name, monster: name });
    return monster?.id;
  }).filter(Boolean);

  return {
    id: draft.id,
    name: draft.name,
    level: draft.level,
    repeatCount: draft.repeatCount,
    giverNpcId: giverMatch?.npc.id ?? null,
    relatedNpcIds,
    targetMonsterIds: [...new Set(targetMonsterIds)],
    prerequisiteQuestIds: [...new Set(prerequisiteQuestIds)],
    mutuallyExclusiveQuestIds: [...new Set(mutuallyExclusiveQuestIds)],
    steps: draft.steps,
    rewards: draft.rewards,
    notes: draft.notes,
    town: draft.town,
    sourceUrl: draft.sourceUrl ?? QUEST_URL,
  };
});

for (const quest of quests) {
  for (const relatedId of quest.mutuallyExclusiveQuestIds) {
    const related = quests.find((candidate) => candidate.id === relatedId);
    if (related && !related.mutuallyExclusiveQuestIds.includes(quest.id)) related.mutuallyExclusiveQuestIds.push(quest.id);
  }
}

if (drafts.length === 0) throw new Error("No quest rows parsed");
if (questPost.content.includes("still need detailed info")) {
  audit.sourceWarnings.push("The supplied source states that detailed information is missing for five quests above level 70.");
}

await mkdir(OUTPUT, { recursive: true });
await Promise.all([
  writeFile(new URL("npcs.json", OUTPUT), `${JSON.stringify(npcs, null, 2)}\n`),
  writeFile(new URL("quests.json", OUTPUT), `${JSON.stringify(quests, null, 2)}\n`),
  writeFile(new URL("mapping-audit.json", OUTPUT), `${JSON.stringify(audit, null, 2)}\n`),
  writeFile(new URL("sources.json", OUTPUT), `${JSON.stringify({
    xSROMap: { url: MAP_URL, commit: MAP_COMMIT, sha256: hash(mapSource), license: "MIT" },
    questList: { url: QUEST_URL, apiUrl: QUEST_API, postId: questPost.ID, modified: questPost.modified, sha256: hash(questPost.content) },
    supplementalQuests: { url: SUPPLEMENTAL_QUEST_URL, names: supplementalQuests.map((quest) => quest.name), evidence: "User-provided in-game screenshots; levels corroborated by linked quest list." },
  }, null, 2)}\n`),
]);

console.log(`Imported ${quests.length} quests and ${npcs.length} NPCs.`);
console.log(`${audit.unmatchedGivers.length} unmatched givers; ${audit.unmatchedRelated.length} unmatched related NPC mentions.`);
console.log(`${audit.unmatchedMonsters.length} monster mentions have no PK2 guide habitat.`);
