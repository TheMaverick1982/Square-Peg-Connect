/** Optional "Type of event" for catering orders and large reservations, with its color. */
export const EVENT_TYPES = [
  { value: "Pizza Class", badge: "bg-red-100 text-red-800 border border-red-200", calendar: "bg-red-100 text-red-800 border-red-300" },
  { value: "EZ Cater", badge: "bg-orange-100 text-orange-800 border border-orange-300", calendar: "bg-orange-200 text-orange-900 border-orange-400" },
] as const;

export const eventTypeStyle = (value?: string | null) => EVENT_TYPES.find((t) => t.value === value);

export function EventTypeBadge({ value }: { value?: string | null }) {
  const t = eventTypeStyle(value);
  if (!t) return null;
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${t.badge}`}>{t.value}</span>;
}
