import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, previousSunday, isSunday } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, LabelList } from "recharts";
import { Gauge, Send, Save, Loader2, Mail, TrendingUp, Flag, History } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { useEmployee } from "@/lib/EmployeeContext";
import {
  computeStoreHistory, loyaltyPenetration, aovPremium, fmtPct, fmtMoney, fmtInt,
  type WeeklyMetricRow, type ComputedWeek,
} from "@/lib/storeMetrics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";

type Field = "loyalty_visits" | "non_loyalty_visits" | "new_loyalty_members" | "loyalty_aov" | "non_loyalty_aov";
type Draft = Record<string, Record<Field, string>>;
const FIELDS: Field[] = ["loyalty_visits", "non_loyalty_visits", "new_loyalty_members", "loyalty_aov", "non_loyalty_aov"];
const emptyRow = (): Record<Field, string> => ({ loyalty_visits: "", non_loyalty_visits: "", new_loyalty_members: "", loyalty_aov: "", non_loyalty_aov: "" });

const lastSunday = () => {
  const today = new Date();
  return format(isSunday(today) ? today : previousSunday(today), "yyyy-MM-dd");
};
type MetricKey = "penetration" | "total_visits" | "total_loyalty_members" | "new_loyalty_members" | "loyalty_visits" | "non_loyalty_visits" | "loyalty_aov" | "non_loyalty_aov" | "aov_premium";
const METRICS: { key: MetricKey; label: string; fmt: (v: number | null) => string }[] = [
  { key: "penetration", label: "Loyalty penetration", fmt: fmtPct },
  { key: "total_loyalty_members", label: "Total loyalty members", fmt: fmtInt },
  { key: "new_loyalty_members", label: "New loyalty members", fmt: fmtInt },
  { key: "total_visits", label: "Total visits", fmt: fmtInt },
  { key: "loyalty_visits", label: "Loyalty visits", fmt: fmtInt },
  { key: "non_loyalty_visits", label: "Non-loyalty visits", fmt: fmtInt },
  { key: "loyalty_aov", label: "Loyalty AOV", fmt: fmtMoney },
  { key: "non_loyalty_aov", label: "Non-loyalty AOV", fmt: fmtMoney },
  { key: "aov_premium", label: "Loyalty AOV premium", fmt: fmtPct },
];

// Stable empty defaults — a fresh [] on every render would re-trigger the effects below forever.
const NO_ROWS: (WeeklyMetricRow & { id: string })[] = [];
const NO_BASELINES: { location_id: string; starting_loyalty_members: number }[] = [];
const n = (s: string) => (s.trim() === "" ? null : Number(s));

export default function StoreMetrics() {
  const { profile, isLoading: profileLoading } = useEmployee();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [week, setWeek] = useState(lastSunday());
  const [draft, setDraft] = useState<Draft>({});
  const [baselineDraft, setBaselineDraft] = useState<Record<string, string>>({});
  const [recipientsDraft, setRecipientsDraft] = useState("");
  const [chartLoc, setChartLoc] = useState<string>("all");
  const [metric, setMetric] = useState<MetricKey>("penetration");

  // ---------- data ----------
  const { data: allRows = NO_ROWS, isLoading: rowsLoading, error: rowsError } = useQuery({
    queryKey: ["store_metrics_weekly"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_metrics_weekly").select("*").order("week_ending");
      if (error) throw error;
      return (data || []) as (WeeklyMetricRow & { id: string })[];
    },
  });
  const { data: baselines = NO_BASELINES } = useQuery({
    queryKey: ["store_metrics_baseline"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_metrics_baseline").select("*");
      if (error) throw error;
      return (data || []) as { location_id: string; starting_loyalty_members: number }[];
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["store_metrics_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_metrics_settings").select("recipients").eq("id", 1).maybeSingle();
      if (error) throw error;
      return { recipients: (data?.recipients as string[]) || [] };
    },
  });

  const startFor = (locId: string) => baselines.find((b) => b.location_id === locId)?.starting_loyalty_members ?? 0;

  // Load saved numbers into the form when the week changes.
  useEffect(() => {
    const next: Draft = {};
    for (const loc of locations) {
      const r = allRows.find((x) => x.location_id === loc.id && x.week_ending === week);
      next[loc.id] = r
        ? {
            loyalty_visits: String(r.loyalty_visits ?? ""),
            non_loyalty_visits: String(r.non_loyalty_visits ?? ""),
            new_loyalty_members: String(r.new_loyalty_members ?? ""),
            loyalty_aov: r.loyalty_aov === null ? "" : String(r.loyalty_aov),
            non_loyalty_aov: r.non_loyalty_aov === null ? "" : String(r.non_loyalty_aov),
          }
        : emptyRow();
    }
    setDraft(next);
  }, [week, allRows]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const loc of locations) next[loc.id] = String(startFor(loc.id));
    setBaselineDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselines]);

  useEffect(() => { if (settings) setRecipientsDraft(settings.recipients.join("\n")); }, [settings]);

  // Running total of loyalty members *before* the selected week, per store.
  const membersBefore = (locId: string) =>
    startFor(locId) + allRows.filter((r) => r.location_id === locId && r.week_ending < week)
      .reduce((s, r) => s + (Number(r.new_loyalty_members) || 0), 0);

  // ---------- mutations ----------
  const saveWeek = useMutation({
    mutationFn: async () => {
      const rows = locations
        .filter((loc) => FIELDS.some((f) => (draft[loc.id]?.[f] ?? "").trim() !== ""))
        .map((loc) => {
          const d = draft[loc.id];
          return {
            location_id: loc.id,
            week_ending: week,
            loyalty_visits: n(d.loyalty_visits) ?? 0,
            non_loyalty_visits: n(d.non_loyalty_visits) ?? 0,
            new_loyalty_members: n(d.new_loyalty_members) ?? 0,
            loyalty_aov: n(d.loyalty_aov),
            non_loyalty_aov: n(d.non_loyalty_aov),
            updated_by: profile?.email ?? null,
            updated_at: new Date().toISOString(),
          };
        });
      if (!rows.length) throw new Error("Enter numbers for at least one store.");
      if (rows.some((r) => [r.loyalty_visits, r.non_loyalty_visits, r.new_loyalty_members, r.loyalty_aov ?? 0, r.non_loyalty_aov ?? 0].some((v) => !isFinite(v) || v < 0))) {
        throw new Error("Numbers must be zero or more.");
      }
      const { error } = await supabase.from("store_metrics_weekly").upsert(rows, { onConflict: "location_id,week_ending" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store_metrics_weekly"] }),
  });

  const sendReport = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/store-metrics-report", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ week_ending: week }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
      return out as { sent_to: number; stores: number };
    },
  });

  const saveBaselines = useMutation({
    mutationFn: async () => {
      const rows = locations.map((loc) => ({
        location_id: loc.id,
        starting_loyalty_members: Math.max(0, Math.round(Number(baselineDraft[loc.id] || 0)) || 0),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("store_metrics_baseline").upsert(rows, { onConflict: "location_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_metrics_baseline"] });
      toast({ title: "Starting totals saved" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" }),
  });

  const saveRecipients = useMutation({
    mutationFn: async () => {
      const list = Array.from(new Set(recipientsDraft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));
      const bad = list.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (bad.length) throw new Error(`Not a valid email: ${bad.join(", ")}`);
      const { error } = await supabase.from("store_metrics_settings").upsert({ id: 1, recipients: list, updated_at: new Date().toISOString() });
      if (error) throw error;
      return list.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["store_metrics_settings"] });
      toast({ title: "Recipients saved", description: `${count} email${count === 1 ? "" : "s"} will get the report.` });
    },
    onError: (e) => toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" }),
  });

  const onSave = async (alsoSend: boolean) => {
    try {
      const count = await saveWeek.mutateAsync();
      if (!alsoSend) {
        toast({ title: "Saved", description: `Numbers saved for ${count} store${count === 1 ? "" : "s"}.` });
        return;
      }
      const out = await sendReport.mutateAsync();
      toast({ title: "Report sent", description: `Emailed to ${out.sent_to} recipient${out.sent_to === 1 ? "" : "s"} (${out.stores} stores).` });
    } catch (e) {
      toast({ title: alsoSend ? "Couldn't send report" : "Couldn't save", description: (e as Error).message, variant: "destructive" });
    }
  };

  // ---------- charts ----------
  const perStore = useMemo(() => Object.fromEntries(
    locations.map((loc) => [loc.id, computeStoreHistory(allRows.filter((r) => r.location_id === loc.id), startFor(loc.id))])
  ) as Record<string, ComputedWeek[]>,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allRows, baselines]);
  const savedWeeks = useMemo(() => Array.from(new Set(allRows.map((r) => r.week_ending))).sort().reverse(), [allRows]);
  const metricDef = METRICS.find((m) => m.key === metric)!;
  const cellValue = (locId: string, wk: string): number | null => {
    const w = perStore[locId]?.find((h) => h.week_ending === wk);
    return w ? (w[metric] as number | null) : null;
  };
  const ranking = locations
    .map((loc) => ({ name: loc.name, value: cellValue(loc.id, week) }))
    .filter((r): r is { name: string; value: number } => r.value !== null && isFinite(r.value))
    .sort((a, b) => b.value - a.value)
    .map((r) => ({ ...r, label: metricDef.fmt(r.value) }));

  const chartData = useMemo(() => {
    if (chartLoc !== "all") {
      return (perStore[chartLoc] || []).map((w) => ({
        week: w.week_ending,
        penetration: w.penetration === null ? null : +w.penetration.toFixed(1),
        members: w.total_loyalty_members,
        premium: w.aov_premium === null ? null : +w.aov_premium.toFixed(1),
      }));
    }
    const weeks = Array.from(new Set(allRows.map((r) => r.week_ending))).sort();
    return weeks.map((wk) => {
      let lv = 0, nv = 0, lAovSum = 0, lW = 0, nAovSum = 0, nW = 0, members = 0;
      for (const loc of locations) {
        const hist = perStore[loc.id];
        const cur = hist.find((h) => h.week_ending === wk);
        const lastKnown = [...hist].reverse().find((h) => h.week_ending <= wk);
        members += lastKnown ? lastKnown.total_loyalty_members : startFor(loc.id);
        if (!cur) continue;
        lv += cur.loyalty_visits; nv += cur.non_loyalty_visits;
        if (cur.loyalty_aov !== null) { lAovSum += cur.loyalty_aov * cur.loyalty_visits; lW += cur.loyalty_visits; }
        if (cur.non_loyalty_aov !== null) { nAovSum += cur.non_loyalty_aov * cur.non_loyalty_visits; nW += cur.non_loyalty_visits; }
      }
      const pen = loyaltyPenetration(lv, nv);
      const prem = aovPremium(lW ? lAovSum / lW : null, nW ? nAovSum / nW : null);
      return { week: wk, penetration: pen === null ? null : +pen.toFixed(1), members, premium: prem === null ? null : +prem.toFixed(1) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perStore, allRows, baselines, chartLoc]);

  if (profileLoading) return null;
  if (profile?.role !== "admin") return <Navigate to="/" replace />;

  const busy = saveWeek.isPending || sendReport.isPending;
  const set = (locId: string, f: Field, v: string) =>
    setDraft((d) => ({ ...d, [locId]: { ...(d[locId] || emptyRow()), [f]: v } }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Gauge className="w-6 h-6" /> Store Metrics</h1>
          <p className="text-muted-foreground text-sm mt-1">Weekly loyalty and order-value numbers by store. Enter the previous 7 days, then send the report.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Week ending</label>
            <Input type="date" value={week} onChange={(e) => e.target.value && setWeek(e.target.value)} className="mt-1 w-[170px]" />
          </div>
        </div>
      </div>

      {rowsError && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          Couldn't load Store Metrics data. If this is the first time, run <code>supabase/store-metrics.sql</code> in the Supabase SQL Editor.
          <span className="block text-xs text-muted-foreground mt-1">{(rowsError as Error).message}</span>
        </div>
      )}

      {/* ---------- entry ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Previous 7 days · week ending {format(parseISO(week), "EEE, MMM d, yyyy")}</CardTitle>
          <CardDescription>Gray columns are calculated for you. Leave a store blank to skip it this week.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left font-semibold py-2 pr-2" rowSpan={2}>Store</th>
                  <th className="text-center font-semibold py-1 border-b" colSpan={3}>Store visits</th>
                  <th className="text-center font-semibold py-1 border-b" colSpan={2}>Loyalty signups</th>
                  <th className="text-center font-semibold py-1 border-b" colSpan={3}>Average order value</th>
                </tr>
                <tr className="text-[11px] text-muted-foreground">
                  <th className="font-medium py-1.5 px-1">Loyalty</th>
                  <th className="font-medium py-1.5 px-1">Non-loyalty</th>
                  <th className="font-medium py-1.5 px-1 bg-muted/50">Penetration</th>
                  <th className="font-medium py-1.5 px-1">New members</th>
                  <th className="font-medium py-1.5 px-1 bg-muted/50">Total members</th>
                  <th className="font-medium py-1.5 px-1">Loyalty AOV $</th>
                  <th className="font-medium py-1.5 px-1">Non-loyalty AOV $</th>
                  <th className="font-medium py-1.5 px-1 bg-muted/50">AOV premium</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {locations.map((loc) => {
                  const d = draft[loc.id] || emptyRow();
                  const pen = loyaltyPenetration(n(d.loyalty_visits) ?? 0, n(d.non_loyalty_visits) ?? 0);
                  const prem = aovPremium(n(d.loyalty_aov), n(d.non_loyalty_aov));
                  const total = membersBefore(loc.id) + (n(d.new_loyalty_members) ?? 0);
                  const inp = (f: Field, step: string) => (
                    <Input type="number" inputMode="decimal" min={0} step={step}
                      value={d[f]} onChange={(e) => set(loc.id, f, e.target.value)}
                      className="h-8 text-right tabular-nums" aria-label={`${loc.name} ${f.replace(/_/g, " ")}`} />
                  );
                  return (
                    <tr key={loc.id}>
                      <td className="py-2 pr-2 font-medium whitespace-nowrap">{loc.name}</td>
                      <td className="py-2 px-1 w-[110px]">{inp("loyalty_visits", "1")}</td>
                      <td className="py-2 px-1 w-[110px]">{inp("non_loyalty_visits", "1")}</td>
                      <td className={`py-2 px-2 text-right tabular-nums bg-muted/50 font-semibold ${pen === null ? "" : pen < 25 ? "text-red-800" : pen < 50 ? "text-orange-600" : "text-green-600"}`}>{fmtPct(pen)}</td>
                      <td className="py-2 px-1 w-[110px]">{inp("new_loyalty_members", "1")}</td>
                      <td className="py-2 px-2 text-right tabular-nums bg-muted/50 font-semibold">{fmtInt(total)}</td>
                      <td className="py-2 px-1 w-[120px]">{inp("loyalty_aov", "0.01")}</td>
                      <td className="py-2 px-1 w-[120px]">{inp("non_loyalty_aov", "0.01")}</td>
                      <td className="py-2 px-2 text-right tabular-nums bg-muted/50 font-semibold">{fmtPct(prem)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end mt-4">
            <Button variant="outline" disabled={busy} onClick={() => onSave(false)}>
              {saveWeek.isPending && !sendReport.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save numbers
            </Button>
            <Button disabled={busy} onClick={() => onSave(true)}>
              {sendReport.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Save &amp; send report
            </Button>
          </div>
          {!(settings?.recipients?.length) && (
            <p className="text-xs text-amber-700 dark:text-amber-400 text-right mt-2">Add report recipients below before sending.</p>
          )}
        </CardContent>
      </Card>

      {/* ---------- charts ---------- */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Week-over-week growth</CardTitle>
            <CardDescription>{chartLoc === "all" ? "All stores combined (AOV weighted by visits)." : locations.find((l) => l.id === chartLoc)?.name}</CardDescription>
          </div>
          <Select value={chartLoc} onValueChange={setChartLoc}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {rowsLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : chartData.length < 2 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground text-sm">
              <TrendingUp className="w-8 h-8 mb-2 opacity-20" />
              Charts appear once two or more weeks are saved{chartData.length === 1 ? " (1 so far)" : ""}.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <MetricChart title="Loyalty penetration" data={chartData} dataKey="penetration" format={(v) => `${v}%`} deltaFormat={(v) => `${v} pts`} />
              <MetricChart title="Total loyalty members" data={chartData} dataKey="members" format={(v) => v.toLocaleString("en-US")} />
              <MetricChart title="Loyalty AOV premium" data={chartData} dataKey="premium" format={(v) => `${v}%`} deltaFormat={(v) => `${v} pts`} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- history & comparison ---------- */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> History &amp; store comparison</CardTitle>
            <CardDescription>Pick a number to compare every store. Click a week to open it above.</CardDescription>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-2">
              Store ranking · {metricDef.label} · week ending {format(parseISO(week), "MMM d, yyyy")}
            </div>
            {ranking.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No numbers saved for this week yet.</div>
            ) : (
              <ChartContainer config={{ value: { label: metricDef.label, color: "hsl(var(--chart-1))" } }}
                className="w-full" style={{ height: Math.max(120, ranking.length * 34 + 16) }}>
                <BarChart data={ranking} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={6}>
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={104} fontSize={12} />
                  <ChartTooltip cursor={{ fillOpacity: 0.06 }}
                    content={<ChartTooltipContent hideLabel formatter={(v, _n, item) => (
                      <span><span className="text-muted-foreground mr-2">{item?.payload?.name}</span><span className="font-semibold tabular-nums">{metricDef.fmt(Number(v))}</span></span>
                    )} />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="label" position="right" className="fill-foreground" fontSize={12} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">All saved weeks · {metricDef.label}</div>
            {savedWeeks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nothing saved yet.</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2 max-h-[420px] overflow-y-auto border rounded-md">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="text-[11px] text-muted-foreground uppercase tracking-wider border-b">
                      <th className="text-left font-semibold py-2 px-2">Week ending</th>
                      {locations.map((l) => <th key={l.id} className="text-right font-semibold py-2 px-2 whitespace-nowrap">{l.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {savedWeeks.map((wk) => (
                      <tr key={wk} className={`hover:bg-muted/40 ${wk === week ? "bg-muted/60" : ""}`}>
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <button type="button" className="text-primary hover:underline font-medium"
                            onClick={() => { setWeek(wk); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                            {format(parseISO(wk), "MMM d, yyyy")}
                          </button>
                        </td>
                        {locations.map((l) => {
                          const v = cellValue(l.id, wk);
                          return <td key={l.id} className={`py-1.5 px-2 text-right tabular-nums ${v === null ? "text-muted-foreground" : ""}`}>{metricDef.fmt(v)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---------- recipients ---------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Report recipients</CardTitle>
            <CardDescription>One email per line (or separated by commas). Everyone here gets the full all-stores report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={6} value={recipientsDraft} onChange={(e) => setRecipientsDraft(e.target.value)}
              placeholder={"brian@brianhardy.com\nmanager@squarepegpizzeria.com"} className="font-mono text-sm" />
            <div className="flex justify-end">
              <Button variant="outline" disabled={saveRecipients.isPending} onClick={() => saveRecipients.mutate()}>
                {saveRecipients.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save recipients
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ---------- baselines ---------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Flag className="w-4 h-4" /> Starting loyalty totals</CardTitle>
            <CardDescription>Each store's loyalty member count before the first week you enter. Weekly new members are added on top automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {locations.map((loc) => (
                <label key={loc.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{loc.name}</span>
                  <Input type="number" min={0} step="1" className="h-8 w-28 text-right tabular-nums"
                    value={baselineDraft[loc.id] ?? ""} onChange={(e) => setBaselineDraft((b) => ({ ...b, [loc.id]: e.target.value }))} />
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" disabled={saveBaselines.isPending} onClick={() => saveBaselines.mutate()}>
                {saveBaselines.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save starting totals
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricChart({ title, data, dataKey, format: fmt, deltaFormat }: {
  title: string;
  data: Array<Record<string, string | number | null>>;
  dataKey: string;
  format: (v: number) => string;
  deltaFormat?: (v: number) => string;
}) {
  const latest = [...data].reverse().find((d) => d[dataKey] !== null);
  const prior = latest ? [...data].reverse().filter((d) => d[dataKey] !== null)[1] : undefined;
  const change = latest && prior ? (latest[dataKey] as number) - (prior[dataKey] as number) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-right">
          <span className="text-lg font-semibold tabular-nums">{latest ? fmt(latest[dataKey] as number) : "—"}</span>
          {change !== null && (
            <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">
              {change >= 0 ? "▲" : "▼"} {(deltaFormat ?? fmt)(Math.abs(+change.toFixed(1)))} vs last wk
            </span>
          )}
        </div>
      </div>
      <ChartContainer config={{ [dataKey]: { label: title, color: "hsl(var(--chart-1))" } }} className="h-[180px] w-full">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} tickMargin={6}
            tickFormatter={(w: string) => format(parseISO(w), "MMM d")} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={44}
            tickFormatter={(v: number) => fmt(v)} domain={["auto", "auto"]} />
          <ChartTooltip cursor={{ strokeOpacity: 0.3 }}
            content={<ChartTooltipContent labelFormatter={(_, p) => {
              const w = p?.[0]?.payload?.week as string | undefined;
              return w ? `Week ending ${format(parseISO(w), "MMM d, yyyy")}` : "";
            }} formatter={(v) => <span className="font-semibold tabular-nums">{fmt(Number(v))}</span>} />} />
          <Line type="monotone" dataKey={dataKey} stroke={`var(--color-${dataKey})`} strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
