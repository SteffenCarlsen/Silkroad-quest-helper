import { describe, expect, it } from "vitest";
import { calculateRewards } from "./reward-calculator";
import type { Quest } from "./types";

it("totals numeric, inventory, and item rewards", () => {
  const quest = { rewards: ["exp: 1,200 +", "sxp: 300", "Gold: 2,500", "10 slot expansion in inventory", "item: camel X 5", "Step1:"] } as Quest;
  expect(calculateRewards([quest])).toEqual({ exp: 1200, sxp: 300, gold: 2500, inventorySlots: 10, items: ["camel X 5"] });
});
