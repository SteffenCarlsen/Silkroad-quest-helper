const COOKIE_NAME = "sroq_plan";
export const COOKIE_BUDGET = 3800;

export function parsePlan(value: string | null | undefined): number[] {
  if (!value) return [];
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return [];
  }
  const [version, ...ids] = decoded.split(".");
  if (version !== "v1") return [];
  return [...new Set(ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
}

export const serializePlan = (ids: number[]) => `v1.${[...new Set(ids)].join(".")}`;

export function planCookiePath(href = window.location.href) {
  return new URL(".", href).pathname;
}

export function readPlanCookie(cookie = document.cookie) {
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return parsePlan(value);
}

export function writePlanCookie(ids: number[]) {
  const value = serializePlan(ids);
  if (value.length > COOKIE_BUDGET) throw new Error("This plan is too large to save in a browser cookie.");
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=31536000; SameSite=Lax; Path=${planCookiePath()}`;
}

export function clearPlanCookie() {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; SameSite=Lax; Path=${planCookiePath()}`;
}
