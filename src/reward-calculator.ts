import type { Quest } from "./types";

export type RewardTotals = { exp: number; sxp: number; gold: number; inventorySlots: number; items: string[] };

export function calculateRewards(quests: Quest[]): RewardTotals {
  const totals: RewardTotals = { exp: 0, sxp: 0, gold: 0, inventorySlots: 0, items: [] };
  for (const reward of quests.flatMap((quest) => quest.rewards)) {
    const numeric = reward.match(/^(exp|sxp|gold):\s*([\d,]+)/i);
    if (numeric) {
      totals[numeric[1].toLowerCase() as "exp" | "sxp" | "gold"] += Number(numeric[2].replaceAll(",", ""));
      continue;
    }
    const inventory = reward.match(/(\d+)\s+slot expansion in inventory/i);
    if (inventory) totals.inventorySlots += Number(inventory[1]);
    else if (!/^step\d*:/i.test(reward)) totals.items.push(reward.replace(/^(item|access):\s*/i, ""));
  }
  return totals;
}
