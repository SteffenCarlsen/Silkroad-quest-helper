import { describe, expect, it } from "vitest";
import { parsePlanData, planCookiePath, serializePlanData } from "./plan-cookie";

describe("plan cookie format", () => {
  it("round-trips duplicate-free plan and completion data", () => {
    const data = { planIds: [12, 4, 12, 9], completedIds: [4, 7, 4] };
    expect(parsePlanData(serializePlanData(data))).toEqual({ planIds: [12, 4, 9], completedIds: [4, 7] });
  });

  it("reads legacy plans and ignores malformed data", () => {
    expect(parsePlanData("v1.1.nope.-2.3")).toEqual({ planIds: [1, 3], completedIds: [] });
    expect(parsePlanData("v3.1.2")).toEqual({ planIds: [], completedIds: [] });
    expect(parsePlanData("%E0%A4%A")).toEqual({ planIds: [], completedIds: [] });
  });

  it("scopes the cookie to either a Pages project or root site", () => {
    expect(planCookiePath("https://example.github.io/silkroad-quest-helper/")).toBe("/silkroad-quest-helper/");
    expect(planCookiePath("https://example.github.io/")).toBe("/");
  });
});
