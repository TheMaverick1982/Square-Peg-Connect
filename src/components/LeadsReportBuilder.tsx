import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfYear, subDays } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { useLocationContext } from "@/lib/LocationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Kind = "catering" | "fundraiser" | "large_reservation" | "kids_class";
const KINDS: { key: Kind; table: string; label: string; softDelete: boolean }[] = [
  { key: "catering", table: "catering_requests", label: "Catering", softDelete: false },
  { key: "large_reservation", table: "large_reservations", label: "Large Reservations", softDelete: true },
  { key: "kids_class", table: "kids_classes", label: "Kids Pizza Classes", softDelete: true },
  { key: "fundraiser", table: "fundraisers", label: "Tuesday Fundraisers", softDelete: true },
];
const kindLabel = (k: Kind) => KINDS.find((x) => x.key === k)!.label;
const storeName = (id: string) => locations.find((l) => l.id === id)?.name || (id ? id : "No store");

type Row = {
  kind: Kind; store: string; created: string; eventDate: string; name: string; org: string; email: string; phone: string;
  status: string; source: string; told: string; intake: string; guests: string; revenue: number; booked: boolean;
};

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const PRESETS: Record<string, { label: string; range: () => [string, string] }> = {
  this_week: { label: "This week", range: () => [ymd(startOfWeek(new Date(), { weekStartsOn: 1 })), ymd(endOfWeek(new Date(), { weekStartsOn: 1 }))] },
  last_week: { label: "Last week", range: () => { const d = subWeeks(new Date(), 1); return [ymd(startOfWeek(d, { weekStartsOn: 1 })), ymd(endOfWeek(d, { weekStartsOn: 1 }))]; } },
  this_month: { label: "This month", range: () => [ymd(startOfMonth(new Date())), ymd(endOfMonth(new Date()))] },
  last_month: { label: "Last month", range: () => { const d = subMonths(new Date(), 1); return [ymd(startOfMonth(d)), ymd(endOfMonth(d))]; } },
  last_90: { label: "Last 90 days", range: () => [ymd(subDays(new Date(), 89)), ymd(new Date())] },
  this_year: { label: "This year", range: () => [ymd(startOfYear(new Date())), ymd(new Date())] },
  custom: { label: "Custom dates", range: () => [ymd(startOfMonth(new Date())), ymd(new Date())] },
};
const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/** Leads & events report: pick a time frame, store, type and source; see leads, bookings, conversion and revenue; export CSV. */
export function LeadsReportBuilder() {
  const { selectedLocationId } = useLocationContext();
  const [preset, setPreset] = useState("last_month");
  const [[from, to], setRange] = useState<[string, string]>(PRESETS.last_month.range());
  const [basis, setBasis] = useState<"created" | "event">("created");
  const [store, setStore] = useState<string>(selectedLocationId || "all");
  const [type, setType] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["leads-report-builder"],
    queryFn: async () => {
      const { data: team } = await supabase.from("employee_profiles").select("name,email");
      const names = new Map<string, string>();
      for (const t of team || []) { const e = String(t.email || "").trim().toLowerCase(); if (e && !names.has(e)) names.set(e, t.name && !/@/.test(t.name) ? t.name : e); }
      const out: Row[] = [];
      for (const k of KINDS) {
        let q = supabase.from(k.table).select("*");
        if (k.softDelete) q = q.is("deleted_at", null);
        const { data, error } = await q;
        if (error) throw new Error(`${k.label}: ${error.message}`);
        for (const r of data || []) {
          const booked = ["Confirmed", "Completed"].includes(r.status);
          const revenue = k.key === "catering" ? (booked ? Number(r.quote_total) || 0 : 0) : r.status === "Cancelled" ? 0 : Number(r.total_sales) || 0;
          const intake = String(r.intake_by || "").trim().toLowerCase();
          out.push({
            kind: k.key, store: r.location || "", created: r.created_at ? ymd(new Date(r.created_at)) : "", eventDate: String(r.event_date || "").slice(0, 10),
            name: r.name || "", org: r.company || r.organization || "", email: r.email || "", phone: r.phone || "", status: r.status || "",
            source: r.lead_source || (r.heard_about_us ? `Told us: ${r.heard_about_us}` : "Unknown"), told: r.heard_about_us || "",
            intake: intake ? names.get(intake) || intake : "Web lead", guests: r.guest_count != null ? String(r.guest_count) : "", revenue, booked,
          });
        }
      }
      return out;
    },
  });

  const inScope = useMemo(() => rows.filter((r) => {
    const d = basis === "created" ? r.created : r.eventDate;
    return d && d >= from && d <= to && (store === "all" || r.store === store) && (type === "all" || r.kind === type);
  }), [rows, basis, from, to, store, type]);
  const sources = useMemo(() => Array.from(new Set(inScope.map((r) => r.source))).sort(), [inScope]);
  const list = useMemo(() => inScope.filter((r) => source === "all" || r.source === source)
    .sort((a, b) => (basis === "created" ? a.created.localeCompare(b.created) : a.eventDate.localeCompare(b.eventDate))), [inScope, source, basis]);

  const sum = (arr: Row[]) => ({ leads: arr.length, booked: arr.filter((r) => r.booked).length, revenue: arr.reduce((a, r) => a + r.revenue, 0) });
  const total = sum(list);
  const groupBy = (key: (r: Row) => string) => {
    const m = new Map<string, Row[]>();
    for (const r of list) m.set(key(r), [...(m.get(key(r)) || []), r]);
    return Array.from(m.entries()).map(([k, arr]) => ({ k, ...sum(arr) })).sort((a, b) => b.leads - a.leads);
  };

  const exportCsv = () => {
    const headers = ["Type", "Store", "Came in", "Event date", "Name", "Company / organization", "Email", "Phone", "Guests", "Status", "Source", "Told us", "Intake by", "Revenue"];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...list.map((r) => [kindLabel(r.kind), storeName(r.store), r.created, r.eventDate, r.name, r.org, r.email, r.phone, r.guests, r.status, r.source, r.told, r.intake, r.revenue || ""])]
      .map((row) => row.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `leads-report-${store === "all" ? "all-stores" : storeName(store).toLowerCase().replace(/\s+/g, "-")}-${from}-to-${to}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const Table = ({ title, rows: data }: { title: string; rows: { k: string; leads: number; booked: number; revenue: number }[] }) => (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left p-2"></th><th className="text-right p-2">Leads</th><th className="text-right p-2">Booked</th><th className="text-right p-2">Conversion</th><th className="text-right p-2">Revenue</th></tr></thead>
          <tbody>
            {data.length ? data.map((d) => (
              <tr key={d.k} className="border-b last:border-0"><td className="p-2 font-medium">{d.k}</td><td className="p-2 text-right">{d.leads}</td><td className="p-2 text-right">{d.booked}</td><td className="p-2 text-right">{pct(d.booked, d.leads)}</td><td className="p-2 text-right">{d.revenue ? money(d.revenue) : "—"}</td></tr>
            )) : <tr><td className="p-3 text-muted-foreground" colSpan={5}>Nothing in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads & bookings report</CardTitle>
        <CardDescription>Catering, large reservations, kids pizza classes and Tuesday fundraisers. Booked = Confirmed or Completed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={preset} onValueChange={(v) => { setPreset(v); if (v !== "custom") setRange(PRESETS[v].range()); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PRESETS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" className="w-40" value={from} onChange={(e) => { setPreset("custom"); setRange([e.target.value, to]); }} />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" className="w-40" value={to} onChange={(e) => { setPreset("custom"); setRange([from, e.target.value]); }} />
          <Select value={basis} onValueChange={(v) => setBasis(v as "created" | "event")}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="created">By date it came in</SelectItem><SelectItem value="event">By event date</SelectItem></SelectContent>
          </Select>
          <Select value={store} onValueChange={setStore}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stores</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All types</SelectItem>{KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sources.includes(source) ? source : "all"} onValueChange={setSource}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All lead sources</SelectItem>{sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={!list.length}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
        </div>

        {error ? <div className="text-sm text-destructive">Couldn't load: {(error as Error).message}</div>
          : isLoading ? <div className="p-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["Leads", String(total.leads)], ["Booked", String(total.booked)], ["Conversion", pct(total.booked, total.leads)], ["Revenue", money(total.revenue)]].map(([l, v]) => (
                <div key={l} className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-bold">{v}</div></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Table title="By type" rows={groupBy((r) => kindLabel(r.kind))} />
              <Table title="Where leads came from" rows={groupBy((r) => r.source)} />
              {store === "all" && <Table title="By store" rows={groupBy((r) => storeName(r.store))} />}
              <Table title="Intake by" rows={groupBy((r) => r.intake)} />
            </div>
            <div className="text-xs text-muted-foreground">
              Revenue counts confirmed/completed catering totals and the sales entered for reservations, classes and fundraisers. Use Export CSV for every lead in this view.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
