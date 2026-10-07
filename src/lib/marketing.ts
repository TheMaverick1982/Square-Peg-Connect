// Marketing Planner helpers: holiday dates that move each year, campaign templates, and risk status.
// No imports from "@/..." so it stays easy to test.

export interface SeasonalEvent {
  name: string;
  type: string;
  date: Date;
  source_campaign_id?: string | null;
  notes?: string | null;
}

/** nth weekday of a month (weekday 0=Sun … 6=Sat; n=1 first … 5; n=-1 last). Month is 0-based. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7);
  }
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Built-in seasonal prompts for a given year, with floating holidays calculated correctly. */
export function builtInEvents(year: number): SeasonalEvent[] {
  const thanksgiving = nthWeekday(year, 10, 4, 4);
  const laborDay = nthWeekday(year, 8, 1, 1);
  return [
    { name: "Super Bowl", date: nthWeekday(year, 1, 0, 2), type: "Sports" },                     // 2nd Sunday of Feb
    { name: "Valentine's Day", date: new Date(year, 1, 14), type: "Holiday" },
    { name: "St. Patrick's Day", date: new Date(year, 2, 17), type: "Holiday" },
    { name: "March Madness Begins", date: nthWeekday(year, 2, 4, 3), type: "Sports" },           // 3rd Thursday of Mar
    { name: "Golf Season (The Masters)", date: addDays(nthWeekday(year, 3, 0, 2), -3), type: "Sports" }, // Thu before 2nd Sunday of Apr
    { name: "Cinco de Mayo", date: new Date(year, 4, 5), type: "Holiday" },
    { name: "Mother's Day", date: nthWeekday(year, 4, 0, 2), type: "Holiday" },                  // 2nd Sunday of May
    { name: "Father's Day", date: nthWeekday(year, 5, 0, 3), type: "Holiday" },                  // 3rd Sunday of Jun
    { name: "4th of July", date: new Date(year, 6, 4), type: "Holiday" },
    { name: "Back to School", date: new Date(year, 7, 20), type: "Season" },
    { name: "Football Season Kickoff", date: addDays(laborDay, 3), type: "Sports" },             // Thu after Labor Day
    { name: "NBA Season Begins", date: nthWeekday(year, 9, 2, 4), type: "Sports" },              // ~4th Tuesday of Oct
    { name: "Halloween", date: new Date(year, 9, 31), type: "Holiday" },
    { name: "Veterans Day", date: new Date(year, 10, 11), type: "Holiday" },
    { name: "Thanksgiving", date: thanksgiving, type: "Holiday" },                               // 4th Thursday of Nov
    { name: "Black Friday (Gift Card Promo)", date: addDays(thanksgiving, 1), type: "Holiday" },
    { name: "Toys for Tots Drop-off Launch", date: new Date(year, 11, 1), type: "Community" },
    { name: "Winter Coat Drive", date: new Date(year, 11, 10), type: "Community" },
    { name: "Christmas", date: new Date(year, 11, 25), type: "Holiday" },
    { name: "New Year's Eve", date: new Date(year, 11, 31), type: "Holiday" },
  ];
}

/** All seasonal prompts (built-in + custom) for one year. Custom prompts use month 0–11 and day. */
export function eventsForYear(year: number, customPrompts: any[] = []): SeasonalEvent[] {
  const custom = customPrompts.map((p) => ({
    name: p.name as string,
    type: "Custom",
    date: new Date(year, Number(p.month), Number(p.day)),
    source_campaign_id: p.source_campaign_id ?? null,
    notes: p.notes ?? null,
  }));
  return [...builtInEvents(year), ...custom];
}

/** The next `count` seasonal prompts from today (rolls into next year). */
export function upcomingEvents(customPrompts: any[] = [], count = 6, from = new Date()): SeasonalEvent[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const y = today.getFullYear();
  return [...eventsForYear(y, customPrompts), ...eventsForYear(y + 1, customPrompts)]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, count);
}

// ---------- templates ----------
export interface TemplateTask { title: string; daysBefore: number } // negative = after the event
export interface CampaignTemplate { id: string; name: string; description: string; tasks: TemplateTask[] }

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "holiday", name: "Holiday / seasonal promo",
    description: "Offer, creative, signage, loyalty, social and email, timed over 8 weeks.",
    tasks: [
      { title: "Decide the offer and menu specials", daysBefore: 56 },
      { title: "Send creative brief (social, email, signage)", daysBefore: 42 },
      { title: "Review and approve creative", daysBefore: 28 },
      { title: "Order / print in-store signage", daysBefore: 21 },
      { title: "Set up loyalty (Como) offer", daysBefore: 14 },
      { title: "Schedule social posts", daysBefore: 14 },
      { title: "Schedule email broadcast", daysBefore: 7 },
      { title: "Brief store managers and staff", daysBefore: 5 },
      { title: "Signage up in stores", daysBefore: 3 },
      { title: "Write recap: what worked, results", daysBefore: -3 },
    ],
  },
  {
    id: "store_event", name: "Store event",
    description: "Trivia, live music, tap takeover, watch party.",
    tasks: [
      { title: "Confirm date, partner / entertainment", daysBefore: 42 },
      { title: "Plan food and drink specials", daysBefore: 28 },
      { title: "Send creative brief", daysBefore: 28 },
      { title: "Review and approve creative", daysBefore: 21 },
      { title: "Post event on social / Facebook event", daysBefore: 14 },
      { title: "Email loyalty members", daysBefore: 7 },
      { title: "Staffing plan and room setup", daysBefore: 3 },
      { title: "Take photos / video during the event", daysBefore: 0 },
      { title: "Write recap: turnout, sales, notes", daysBefore: -3 },
    ],
  },
  {
    id: "community", name: "Community / fundraiser night",
    description: "Partner organization, flyer, store briefing and donation follow-up.",
    tasks: [
      { title: "Confirm organization, date and terms", daysBefore: 35 },
      { title: "Create flyer for the organization to share", daysBefore: 28 },
      { title: "Review and approve flyer", daysBefore: 21 },
      { title: "Post on social", daysBefore: 10 },
      { title: "Brief the store team", daysBefore: 3 },
      { title: "Report sales, send donation and thank-you", daysBefore: -5 },
    ],
  },
  {
    id: "lto", name: "Limited-time menu item",
    description: "Recipe, photos, POS and menu updates, staff training and launch.",
    tasks: [
      { title: "Finalize recipe, pricing and food cost", daysBefore: 42 },
      { title: "Photo shoot", daysBefore: 28 },
      { title: "Send creative brief", daysBefore: 28 },
      { title: "Review and approve creative", daysBefore: 21 },
      { title: "Update POS and menus", daysBefore: 10 },
      { title: "Train staff on the item", daysBefore: 7 },
      { title: "Launch: social post and email", daysBefore: 0 },
      { title: "Write recap: sales and feedback", daysBefore: -14 },
    ],
  },
];

/** Due date (yyyy-MM-dd) for a template task, never earlier than today for tasks that would already be late. */
export function templateDueDate(target: Date, daysBefore: number, today = new Date()): string {
  let d = addDays(target, -daysBefore);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (d < t0 && daysBefore > 0) d = t0;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- status ----------
const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
export const daysUntil = (ymd: string) => Math.round((parseYmd(ymd).getTime() - startOfToday().getTime()) / 86400000);
export const isTaskOverdue = (t: { due_date?: string | null; is_completed?: boolean }) =>
  !t.is_completed && !!t.due_date && daysUntil(t.due_date) < 0;


// ---------- event dates (multi-day, extra days, repeats) ----------
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type DatedCampaign = { target_date: string; end_date?: string | null; event_dates?: string[] | null };

/** Does this campaign happen on this day? (start–end range, or one of its extra dates) */
export function occursOn(c: DatedCampaign, ymd: string): boolean {
  const end = c.end_date && c.end_date > c.target_date ? c.end_date : c.target_date;
  return (ymd >= c.target_date && ymd <= end) || (c.event_dates || []).includes(ymd);
}

/** First day of each separate occurrence: the start date plus every extra date, sorted, no repeats. */
export function occurrenceStarts(c: DatedCampaign): string[] {
  return Array.from(new Set([c.target_date, ...(c.event_dates || [])])).filter(Boolean).sort();
}

/** Last day this campaign runs. */
export function lastEventDate(c: DatedCampaign): string {
  const all = [...occurrenceStarts(c), c.end_date || ""].filter(Boolean).sort();
  return all[all.length - 1];
}

/** The next date it happens (today counts). If every date has passed, the last one. */
export function nextEventDate(c: DatedCampaign, today = new Date()): string {
  const t = toYmd(today);
  const end = c.end_date && c.end_date > c.target_date ? c.end_date : c.target_date;
  if (t >= c.target_date && t <= end) return t; // running right now
  const next = occurrenceStarts(c).find((d) => d >= t);
  return next || lastEventDate(c);
}

export type RepeatFrequency = "weekly" | "biweekly" | "monthly_date" | "monthly_weekday";
export const REPEAT_OPTIONS: { id: RepeatFrequency; label: string }[] = [
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly_weekday", label: "Every month, same weekday (e.g. 2nd Tuesday)" },
  { id: "monthly_date", label: "Every month, same date (e.g. the 15th)" },
];

/** Dates after `start` that follow the repeat rule, up to and including `until` (max 60). */
export function repeatDates(start: string, freq: RepeatFrequency, until: string, max = 60): string[] {
  const s = parseYmd(start);
  const out: string[] = [];
  const nth = Math.ceil(s.getDate() / 7); // which week of the month the start falls in
  for (let i = 1; out.length < max && i < 600; i++) {
    let d: Date;
    if (freq === "weekly") d = addDays(s, 7 * i);
    else if (freq === "biweekly") d = addDays(s, 14 * i);
    else if (freq === "monthly_date") {
      d = new Date(s.getFullYear(), s.getMonth() + i, s.getDate());
      if (d.getDate() !== s.getDate()) continue; // month has no such day (e.g. the 31st)
    } else {
      const y = s.getFullYear() + Math.floor((s.getMonth() + i) / 12), m = (s.getMonth() + i) % 12;
      d = nthWeekday(y, m, s.getDay(), nth);
      if (d.getMonth() !== m) d = nthWeekday(y, m, s.getDay(), -1); // no 5th one this month: use the last
    }
    const ymd = toYmd(d);
    if (ymd > until) break;
    out.push(ymd);
  }
  return out;
}

// ---------- manual status ----------
export type PlanStatus = "auto" | "in_progress" | "on_track" | "ready" | "on_hold";
export const PLAN_STATUSES: { id: PlanStatus; label: string; hint: string; badge: string }[] = [
  { id: "auto", label: "Auto", hint: "Worked out from the tasks and dates", badge: "" },
  { id: "in_progress", label: "In progress", hint: "Being worked on. Only overdue tasks raise a flag.", badge: "bg-blue-100 text-blue-900 border-blue-200" },
  { id: "on_track", label: "On track", hint: "We've got this. No at-risk flags.", badge: "bg-green-100 text-green-900 border-green-200" },
  { id: "ready", label: "Ready to go", hint: "Everything is done. No at-risk flags.", badge: "bg-green-600 text-white border-green-600" },
  { id: "on_hold", label: "On hold", hint: "Paused. No at-risk flags.", badge: "bg-muted text-muted-foreground" },
];
export const planStatusOf = (c: { plan_status?: string | null }): PlanStatus =>
  (PLAN_STATUSES.some((p) => p.id === c.plan_status) ? c.plan_status : "auto") as PlanStatus;

/** Has anyone written anything in the plan itself (not just tasks)? */
const hasPlanContent = (c: any) =>
  ["drinks_plan", "menu_plan", "activity_plan", "instore_plan", "promo_notes", "como_notes", "email_notes", "in_store_notes"]
    .some((k) => typeof c[k] === "string" && c[k].trim() !== "") ||
  ["promo_social", "promo_como", "promo_email", "promo_in_store"].some((k) => !!c[k]);

export interface CampaignRisk { level: "ok" | "warn" | "risk"; label: string; why: string }

/**
 * Is this campaign on track? Clears itself as work gets done:
 *  - overdue tasks → flag goes away when they're completed or re-dated
 *  - "no plan yet" → goes away once there are tasks or anything is written in the plan
 *  - "behind" → goes away once half the tasks are done
 * A manual status of On track / Ready / On hold switches the flags off; In progress keeps only the overdue flag.
 */
export function campaignRisk(campaign: any, tasks: any[]): CampaignRisk | null {
  if (campaign.archived_at) return null;
  const status = planStatusOf(campaign);
  if (status === "on_track" || status === "ready" || status === "on_hold") return null;
  const days = daysUntil(nextEventDate(campaign));
  if (days < 0) return null;
  const open = tasks.filter((t) => !t.is_completed);
  const overdue = open.filter(isTaskOverdue).length;
  const progress = tasks.length ? (tasks.length - open.length) / tasks.length : 0;
  const fix = " Or set the status to On track.";
  if (overdue > 0) return { level: "risk", label: `At risk · ${overdue} overdue`, why: `${overdue} task${overdue === 1 ? " is" : "s are"} past due. Complete or re-date ${overdue === 1 ? "it" : "them"} and this clears.${fix}` };
  if (status === "in_progress") return null;
  const started = tasks.length > 0 || hasPlanContent(campaign);
  if (!started && days <= 30) return { level: "risk", label: "At risk · no plan yet", why: `The event is ${days} day${days === 1 ? "" : "s"} away with no tasks or plan. Add a task or fill in the details and this clears.${fix}` };
  if (days <= 14 && open.length > 0 && progress < 0.5) return { level: "risk", label: "At risk · behind", why: `Less than half the tasks are done with ${days} day${days === 1 ? "" : "s"} to go. This clears once half are complete.${fix}` };
  if (!started && days <= 60) return { level: "warn", label: "Needs a plan", why: `No tasks or plan yet. Add a task or fill in the details and this clears.${fix}` };
  return null;
}
