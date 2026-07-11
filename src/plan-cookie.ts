const COOKIE_NAME = "sroq_plan";
export const COOKIE_BUDGET = 3800;

export type PlanData = { planIds: number[]; completedIds: number[] };

const validIds = (values: string[]) => [...new Set(values.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];

export function parsePlanData(value: string | null | undefined): PlanData {
  if (!value) return { planIds: [], completedIds: [] };
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return { planIds: [], completedIds: [] };
  }
  const [planPart, completedPart = ""] = decoded.split("|");
  const [version, ...planIds] = planPart.split(".");
  if (version === "v1") return { planIds: validIds(planIds), completedIds: [] };
  if (version !== "v2") return { planIds: [], completedIds: [] };
  return { planIds: validIds(planIds), completedIds: validIds(completedPart.split(".")) };
}

export const serializePlanData = ({ planIds, completedIds }: PlanData) => `v2.${[...new Set(planIds)].join(".")}|${[...new Set(completedIds)].join(".")}`;

export function planCookiePath(href = window.location.href) {
  return new URL(".", href).pathname;
}

export function readPlanData(cookie = document.cookie) {
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return parsePlanData(value);
}

export function writePlanData(data: PlanData) {
  const value = serializePlanData(data);
  if (value.length > COOKIE_BUDGET) throw new Error("This quest plan is too large to save in a browser cookie.");
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=31536000; SameSite=Lax; Path=${planCookiePath()}`;
}

export function clearPlanData() {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; SameSite=Lax; Path=${planCookiePath()}`;
}
