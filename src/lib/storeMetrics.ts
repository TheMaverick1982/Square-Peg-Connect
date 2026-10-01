// Store Metrics calculations — shared by the app page and the report email (api/).
// Keep this file free of imports from "@/..." so the server function can use it.

export interface WeeklyMetricRow {
  location_id: string;
  week_ending: string; // yyyy-MM-dd
  loyalty_visits: number;
  non_loyalty_visits: number;
  new_loyalty_members: number;
  loyalty_aov: number | null;
  non_loyalty_aov: number | null;
}

export interface ComputedWeek extends WeeklyMetricRow {
  total_visits: number;
  /** Loyalty visits ÷ all visits, as a percentage (e.g. 26.4). null if no visits. */
  penetration: number | null;
  /** Starting total + all new members up to and including this week. */
  total_loyalty_members: number;
  /** (Loyalty AOV − Non-loyalty AOV) ÷ Non-loyalty AOV, as a percentage (e.g. 20). */
  aov_premium: number | null;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export function loyaltyPenetration(loyalty: number, nonLoyalty: number): number | null {
  const total = loyalty + nonLoyalty;
  return total > 0 ? (loyalty / total) * 100 : null;
}

export function aovPremium(loyaltyAov: number | null, nonLoyaltyAov: number | null): number | null {
  if (loyaltyAov === null || nonLoyaltyAov === null || nonLoyaltyAov <= 0) return null;
  return ((loyaltyAov - nonLoyaltyAov) / nonLoyaltyAov) * 100;
}

/** Computes every week for one store, oldest → newest, with running loyalty totals. */
export function computeStoreHistory(rows: WeeklyMetricRow[], startingMembers: number): ComputedWeek[] {
  const sorted = [...rows].sort((a, b) => a.week_ending.localeCompare(b.week_ending));
  let running = num(startingMembers);
  return sorted.map((r) => {
    const loyalty = num(r.loyalty_visits);
    const non = num(r.non_loyalty_visits);
    const newMembers = num(r.new_loyalty_members);
    const lAov = numOrNull(r.loyalty_aov);
    const nAov = numOrNull(r.non_loyalty_aov);
    running += newMembers;
    return {
      ...r,
      loyalty_visits: loyalty,
      non_loyalty_visits: non,
      new_loyalty_members: newMembers,
      loyalty_aov: lAov,
      non_loyalty_aov: nAov,
      total_visits: loyalty + non,
      penetration: loyaltyPenetration(loyalty, non),
      total_loyalty_members: running,
      aov_premium: aovPremium(lAov, nAov),
    };
  });
}

export const fmtPct = (v: number | null) => (v === null || !isFinite(v) ? "—" : `${v.toFixed(1).replace(/\.0$/, "")}%`);
export const fmtMoney = (v: number | null) =>
  v === null || !isFinite(v) ? "—" : `$${v.toFixed(2).replace(/\.00$/, "")}`;
export const fmtInt = (v: number | null) => (v === null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US"));
