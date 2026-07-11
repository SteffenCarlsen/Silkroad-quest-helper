import { describe, expect, it } from "vitest";
import { parsePlan, planCookiePath, serializePlan } from "./plan-cookie";

describe("plan cookie format", () => {
  it("round-trips an ordered, duplicate-free plan", () => {
    expect(parsePlan(serializePlan([12, 4, 12, 9]))).toEqual([12, 4, 9]);
  });

  it("ignores malformed, unsupported, and unsafe IDs", () => {
    expect(parsePlan("v2.1.2")).toEqual([]);
    expect(parsePlan("v1.1.nope.-2.3")).toEqual([1, 3]);
    expect(parsePlan("%E0%A4%A")).toEqual([]);
  });

  it("scopes the cookie to either a Pages project or root site", () => {
    expect(planCookiePath("https://example.github.io/silkroad-quest-helper/")).toBe("/silkroad-quest-helper/");
    expect(planCookiePath("https://example.github.io/")).toBe("/");
  });
});
