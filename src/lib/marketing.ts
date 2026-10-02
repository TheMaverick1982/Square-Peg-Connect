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

export interface CampaignRisk { level: "ok" | "warn" | "risk"; label: string }

/** Is this campaign on track? Looks at the date AND whether the work is getting done. */
export function campaignRisk(campaign: { target_date: string; archived_at?: string | null }, tasks: any[]): CampaignRisk | null {
  if (campaign.archived_at) return null;
  const days = daysUntil(campaign.target_date);
  if (days < 0) return null;
  const open = tasks.filter((t) => !t.is_completed);
  const overdue = open.filter(isTaskOverdue).length;
  const progress = tasks.length ? (tasks.length - open.length) / tasks.length : 0;
  if (overdue > 0) return { level: "risk", label: `At risk · ${overdue} overdue` };
  if (tasks.length === 0 && days <= 30) return { level: "risk", label: "At risk · no plan yet" };
  if (days <= 14 && open.length > 0 && progress < 0.5) return { level: "risk", label: "At risk · behind" };
  if (tasks.length === 0 && days <= 60) return { level: "warn", label: "Needs a plan" };
  return null;
}
