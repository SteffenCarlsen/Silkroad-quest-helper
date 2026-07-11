import { useMemo, useState } from "react";
import npcData from "./data/npcs.json";
import monsterHabitatData from "./data/monster-habitats.json";
import questData from "./data/quests.json";
import sourceData from "./data/sources.json";
import QuestMap from "./QuestMap";
import { clearPlanData, readPlanData, writePlanData } from "./plan-cookie";
import { calculateRewards } from "./reward-calculator";
import { npcIdsForMap, npcIdsForResults, questsForLevelRange, searchData } from "./search";
import type { MonsterHabitat, Npc, Quest, Selection } from "./types";

const npcs = npcData as Npc[];
const quests = questData as Quest[];
const monsters = monsterHabitatData.monsters as MonsterHabitat[];
const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
const questById = new Map(quests.map((quest) => [quest.id, quest]));
const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
const numberFormat = new Intl.NumberFormat("en-US");

function RewardList({ quest }: { quest: Quest }) {
  if (quest.rewards.length === 0) return <p className="unknown">Rewards unknown in the supplied source.</p>;
  return <ul className="reward-list">{quest.rewards.map((reward, index) => <li key={`${quest.id}-${index}`}>{reward}</li>)}</ul>;
}

function QuestDetails({ quest, planned, onAdd, onSelectNpc }: { quest: Quest; planned: boolean; onAdd: () => void; onSelectNpc: (id: number) => void }) {
  const giver = npcById.get(quest.giverNpcId)!;
  return (
    <article className="details" aria-labelledby="detail-title">
      <div className="eyebrow">Level {quest.level} · {quest.town ?? "Unknown region"}</div>
      <h2 id="detail-title">{quest.name}</h2>
      <button className="text-button" onClick={() => onSelectNpc(giver.id)}>Given by {giver.name}</button>
      {quest.relatedNpcIds.length > 0 && <p>Related NPCs: {quest.relatedNpcIds.map((id, index) => <span key={id}>{index > 0 && ", "}<button className="inline-button" onClick={() => onSelectNpc(id)}>{npcById.get(id)?.name}</button></span>)}</p>}
      <dl className="facts"><div><dt>Repeat</dt><dd>{quest.repeatCount === null ? "Unlimited" : `${quest.repeatCount}×`}</dd></div><div><dt>Quest ID</dt><dd>#{quest.id}</dd></div></dl>
      {quest.prerequisiteQuestIds.length > 0 && <p><strong>Requires:</strong> {quest.prerequisiteQuestIds.map((id) => questById.get(id)?.name).join(", ")}</p>}
      {quest.mutuallyExclusiveQuestIds.length > 0 && <p className="warning"><strong>Choose one:</strong> mutually exclusive with {quest.mutuallyExclusiveQuestIds.map((id) => questById.get(id)?.name).join(", ")}.</p>}
      {quest.targetMonsterIds.length > 0 && <><h3>Known habitat targets</h3><ul className="target-list">{quest.targetMonsterIds.map((id) => { const monster = monsterById.get(id); return monster && <li key={id}>{monster.name} <span>Lv. {monster.level}</span></li>; })}</ul><p className="habitat-note">Areas and pins come from PK2 client guide data, not exact server spawn points.</p></>}
      <h3>Steps</h3>
      <ol>{quest.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      <h3>Rewards</h3>
      <RewardList quest={quest} />
      {quest.notes.map((note, index) => <p className="note" key={index}>{note}</p>)}
      <div className="detail-actions"><button className="primary" disabled={planned} onClick={onAdd}>{planned ? "In your plan" : "Add to plan"}</button><a href={quest.sourceUrl} target="_blank" rel="noreferrer">View source</a></div>
    </article>
  );
}

function NpcDetails({ npc, visibleQuests, onSelectQuest }: { npc: Npc; visibleQuests: Quest[]; onSelectQuest: (id: number) => void }) {
  const given = visibleQuests.filter((quest) => quest.giverNpcId === npc.id);
  const related = visibleQuests.filter((quest) => quest.relatedNpcIds.includes(npc.id));
  return (
    <article className="details" aria-labelledby="detail-title">
      <div className="eyebrow">{npc.town ?? "World NPC"}</div>
      <h2 id="detail-title">{npc.name}</h2>
      {npc.aliases.length > 0 && <p>Also listed as {npc.aliases.join(", ")}.</p>}
      <p>Client coordinates: X {Math.round(npc.position.x)}, Y {Math.round(npc.position.y)}, region {npc.position.region}</p>
      <h3>Quest giver for {given.length}</h3>
      {given.length ? <ul className="link-list">{given.map((quest) => <li key={quest.id}><button className="text-button" onClick={() => onSelectQuest(quest.id)}>Lv. {quest.level} · {quest.name}</button></li>)}</ul> : <p className="unknown">No giver quests in the supplied level 1–80 list.</p>}
      <h3>Appears in {related.length}</h3>
      {related.length ? <ul className="link-list">{related.map((quest) => <li key={quest.id}><button className="text-button" onClick={() => onSelectQuest(quest.id)}>{quest.name}</button></li>)}</ul> : <p className="unknown">No related quests in the supplied list.</p>}
    </article>
  );
}

function RewardCalculator({ plan }: { plan: Quest[] }) {
  const totals = calculateRewards(plan);
  return <section className="reward-summary" aria-labelledby="reward-summary-title"><h3 id="reward-summary-title">Plan rewards</h3><small>One completion per planned quest</small><dl><div><dt>EXP</dt><dd>{numberFormat.format(totals.exp)}</dd></div><div><dt>Skill EXP</dt><dd>{numberFormat.format(totals.sxp)}</dd></div><div><dt>Gold</dt><dd>{numberFormat.format(totals.gold)}</dd></div><div><dt>Inventory</dt><dd>+{numberFormat.format(totals.inventorySlots)} slots</dd></div></dl>{totals.items.length > 0 && <><h4>Items and unlocks</h4><ul>{totals.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}</section>;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [showAllNpcs, setShowAllNpcs] = useState(false);
  const [showCompletedQuests, setShowCompletedQuests] = useState(false);
  const [showMonsterAreas, setShowMonsterAreas] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [planData, setPlanData] = useState(() => {
    const data = readPlanData();
    return { planIds: data.planIds.filter((id) => questById.has(id)), completedIds: data.completedIds.filter((id) => questById.has(id)) };
  });
  const { planIds, completedIds } = planData;
  const [message, setMessage] = useState("");
  const parsedLevel = Number(currentLevel);
  const level = currentLevel !== "" && Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 140 ? parsedLevel : null;
  const levelInvalid = currentLevel !== "" && level === null;
  const levelMinimum = level === null ? null : Math.max(1, level - 5);
  const levelMaximum = level === null ? null : level + 10;
  const completedQuestIds = useMemo(() => new Set(completedIds), [completedIds]);
  const searchableQuests = useMemo(() => showCompletedQuests ? quests : quests.filter((quest) => !completedQuestIds.has(quest.id)), [completedQuestIds, showCompletedQuests]);
  const results = useMemo(() => {
    const searched = searchData(query, searchableQuests, npcs, monsters);
    return { ...searched, quests: questsForLevelRange(searched.quests, level) };
  }, [level, query, searchableQuests]);
  const selectedQuest = selection?.type === "quest" ? questById.get(selection.id) ?? null : null;
  const selectedNpc = selection?.type === "npc" ? npcById.get(selection.id) ?? null : null;
  const matchedNpcIds = useMemo(() => query.trim() ? npcIdsForResults(results.quests, results.npcs) : new Set<number>(), [query, results]);
  const visibleNpcIds = useMemo(() => {
    const ids = npcIdsForMap(query, showAllNpcs, results.quests, results.npcs, npcs);
    if (selectedQuest) [selectedQuest.giverNpcId, ...selectedQuest.relatedNpcIds].forEach((id) => ids.add(id));
    if (selectedNpc) ids.add(selectedNpc.id);
    return ids;
  }, [query, results, selectedNpc, selectedQuest, showAllNpcs]);
  const visibleNpcs = useMemo(() => npcs.filter((npc) => visibleNpcIds.has(npc.id)), [visibleNpcIds]);
  const mapSelectedNpcId = selectedNpc?.id ?? selectedQuest?.giverNpcId ?? null;
  const relatedNpcIds = useMemo(() => new Set(selectedQuest?.relatedNpcIds ?? []), [selectedQuest]);
  const plan = planIds.map((id) => questById.get(id)).filter((quest): quest is Quest => Boolean(quest));
  const selectedMonsterIds = useMemo(() => new Set(selectedQuest?.targetMonsterIds ?? []), [selectedQuest]);
  const visibleMonsterIds = useMemo(() => new Set([...plan.flatMap((quest) => quest.targetMonsterIds), ...selectedMonsterIds]), [plan, selectedMonsterIds]);
  const visibleMonsters = useMemo(() => monsters.filter((monster) => visibleMonsterIds.has(monster.id)), [visibleMonsterIds]);

  const saveData = (nextPlanIds: number[], nextCompletedIds: number[], announcement: string) => {
    try {
      const data = { planIds: nextPlanIds, completedIds: nextCompletedIds };
      writePlanData(data);
      setPlanData(data);
      setMessage(announcement);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The plan could not be saved.");
    }
  };
  const savePlan = (ids: number[], announcement: string) => saveData(ids, completedIds, announcement);
  const setCompleted = (quest: Quest, completed: boolean) => saveData(planIds, completed ? [...completedIds, quest.id] : completedIds.filter((id) => id !== quest.id), `${quest.name} marked ${completed ? "completed" : "incomplete"}.`);

  const selectQuest = (id: number) => setSelection({ type: "quest", id });
  const selectNpc = (id: number) => setSelection({ type: "npc", id });

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-brand"><img src="./apple-touch-icon.png" alt="" aria-hidden="true" /><div><span className="kicker">Level 1–80</span><h1>Silkroad Quest Helper</h1></div></div>
        <p>Find quests, locate their NPCs, and keep your next objectives ready.</p>
      </header>

      <main className="workspace">
        <section className="panel search-panel" aria-label="Search quests and NPCs">
          <label htmlFor="search">Search quests or NPCs</label>
          <div className="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Yangyun, level 35, Hotan…" autoComplete="off" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}>×</button>}</div>
          <div className="level-filter"><label htmlFor="current-level">Current level</label><input id="current-level" type="number" min="1" max="140" value={currentLevel} onChange={(event) => setCurrentLevel(event.target.value)} placeholder="Any" aria-describedby="level-range" />{level !== null && <small id="level-range">Showing levels {levelMinimum}–{levelMaximum}</small>}{levelInvalid && <small id="level-range" className="input-error">Enter a level from 1 to 140.</small>}</div>
          <p className="result-summary" aria-live="polite">{results.quests.length} quests · {results.npcs.length} NPCs</p>
          <label className="map-toggle"><input type="checkbox" checked={showAllNpcs} onChange={(event) => setShowAllNpcs(event.target.checked)} /><span>Keep all NPCs visible while searching</span></label>
          <label className="map-toggle completed-filter"><input type="checkbox" checked={showCompletedQuests} onChange={(event) => setShowCompletedQuests(event.target.checked)} /><span>Display completed quests</span></label>

          {(selectedQuest || selectedNpc) && <div className="selection-card">
            <button className="close-button" aria-label="Close details" onClick={() => setSelection(null)}>×</button>
            {selectedQuest && <QuestDetails quest={selectedQuest} planned={planIds.includes(selectedQuest.id)} onAdd={() => savePlan([...planIds, selectedQuest.id], `${selectedQuest.name} added to your plan.`)} onSelectNpc={selectNpc} />}
            {selectedNpc && <NpcDetails npc={selectedNpc} visibleQuests={searchableQuests} onSelectQuest={selectQuest} />}
          </div>}

          <div className="result-groups">
            <section><h2>Quests <span>{results.quests.length}</span></h2><ul className="result-list">{results.quests.map((quest) => <li key={quest.id}><button className={selection?.type === "quest" && selection.id === quest.id ? "active" : ""} onClick={() => selectQuest(quest.id)}><span>Lv. {quest.level}</span><strong>{quest.name}</strong><small>{npcById.get(quest.giverNpcId)?.name}</small></button></li>)}</ul></section>
            <section><h2>NPCs <span>{results.npcs.length}</span></h2><ul className="result-list">{results.npcs.map((npc) => <li key={npc.id}><button className={selection?.type === "npc" && selection.id === npc.id ? "active" : ""} onClick={() => selectNpc(npc.id)}><strong>{npc.name}</strong><small>{npc.town ?? npc.role ?? "World NPC"}</small></button></li>)}</ul></section>
            {results.quests.length === 0 && results.npcs.length === 0 && <p className="empty-state">No quests or NPCs match “{query}”.</p>}
          </div>
        </section>

        <section className="map-panel" aria-label="Map"><QuestMap npcs={visibleNpcs} monsters={visibleMonsters} selectedMonsterIds={selectedMonsterIds} showMonsterAreas={showMonsterAreas} selectedNpcId={mapSelectedNpcId} giverNpcId={selectedQuest?.giverNpcId ?? null} relatedNpcIds={relatedNpcIds} matchedNpcIds={matchedNpcIds} filtered={Boolean(query.trim()) && !showAllNpcs} onSelectNpc={selectNpc} /><div className="map-legend"><span className="dot dot--match" />Match <span className="dot dot--giver" />Quest giver <span className="dot dot--selected" />Selected {showMonsterAreas && <><span className="habitat-swatch" />Known habitat</>}</div></section>

        <aside className="panel plan-panel" aria-labelledby="plan-title">
          <div className="panel-heading"><div><span className="eyebrow">Saved in this browser</span><h2 id="plan-title">Quest plan</h2></div><span className="count-badge">{plan.length}</span></div>
          <label className="map-toggle plan-map-toggle"><input type="checkbox" checked={showMonsterAreas} onChange={(event) => setShowMonsterAreas(event.target.checked)} /><span>Show monster habitat areas</span></label>
          {plan.length > 0 && <RewardCalculator plan={plan} />}
          {plan.length === 0 ? <div className="empty-plan"><span aria-hidden="true">◇</span><p>Your plan is empty.</p><small>Open a quest and choose “Add to plan”.</small></div> : <ol className="plan-list">{plan.map((quest) => { const completed = completedQuestIds.has(quest.id); return <li key={quest.id} className={completed ? "completed" : ""}><label className="complete-toggle"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(quest, event.target.checked)} /><span>Completed</span></label><button className="plan-title" onClick={() => selectQuest(quest.id)}><span>Lv. {quest.level}</span>{quest.name}</button><RewardList quest={quest} /><button className="remove-button" onClick={() => savePlan(planIds.filter((id) => id !== quest.id), `${quest.name} removed from your plan.`)}>Remove</button></li>; })}</ol>}
          {(plan.length > 0 || completedIds.length > 0) && <button className="clear-button" onClick={() => { if (window.confirm("Clear the quest plan and all completed quest data?")) { clearPlanData(); setPlanData({ planIds: [], completedIds: [] }); setMessage("Quest plan data cleared."); } }}>Clear quest plan data</button>}
          <p className="sr-only" aria-live="polite">{message}</p>
        </aside>
      </main>

      <footer>Quest facts from <a href={sourceData.questList.url}>Shinakuma's level 1–80 list</a>. Map and NPC data from <a href="https://github.com/JellyBitz/xSROMap">xSROMap</a> at commit {sourceData.xSROMap.commit}. Monster habitats use PK2 client guide data and are not exact server spawns. Silkroad Online belongs to its respective owners.</footer>
    </div>
  );
}
