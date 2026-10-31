import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Search, Users, Inbox, RefreshCw, Mail, Phone, Building, StickyNote, ChevronDown, ChevronUp } from "lucide-react";

type Customer = {
  id: string; name: string | null; email: string | null; phone: string | null; organization: string | null;
  first_source: string | null; notes: string | null; created_at: string;
  catering_count: number; fundraiser_count: number; reservation_count: number; kids_class_count: number;
  lifetime_revenue: number; last_activity_at: string | null;
};

const money = (n: number) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const KIND_LABEL: Record<string, string> = {
  catering: "Catering", fundraiser: "Fundraiser", large_reservation: "Large reservation", kids_class: "Kids class",
  email: "Email", note: "Note", existing_customer: "Existing customer", other: "Other",
};
const KIND_COLOR: Record<string, string> = {
  catering: "bg-green-100 text-green-800", fundraiser: "bg-pink-100 text-pink-800", large_reservation: "bg-blue-100 text-blue-800",
  kids_class: "bg-yellow-100 text-yellow-800", email: "bg-slate-100 text-slate-800", note: "bg-amber-100 text-amber-800",
  existing_customer: "bg-purple-100 text-purple-800", other: "bg-gray-100 text-gray-700",
};
// Where an inbox lead becomes a request.
const PIPELINE: Record<string, { table: string; org: string; guests: boolean; label: string }> = {
  catering: { table: "catering_requests", org: "company", guests: true, label: "Catering Orders" },
  fundraiser: { table: "fundraisers", org: "organization", guests: false, label: "Tuesday Fundraisers" },
  large_reservation: { table: "large_reservations", org: "organization", guests: true, label: "Large Reservations" },
  kids_class: { table: "kids_classes", org: "organization", guests: true, label: "Kids Pizza Classes" },
};
const storeFromText = (s?: string | null) => {
  const t = String(s || "").toLowerCase();
  return locations.find(l => t && (t.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(t)))?.id || "";
};

export default function Customers() {
  const { data: newCount = 0 } = useQuery({
    queryKey: ["inbox_items_count"],
    queryFn: async () => {
      const { count } = await supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "new");
      return count || 0;
    },
  });
  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-1">Everyone who has asked about catering, fundraisers, reservations or kids classes, with their history and totals.</p>
      </div>
      <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") === "inbox" ? "inbox" : "customers"}>
        <TabsList>
          <TabsTrigger value="customers" className="gap-2"><Users className="w-4 h-4" /> Customers</TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2"><Inbox className="w-4 h-4" /> Inbox review{newCount ? <Badge className="ml-1 h-5 px-1.5">{newCount}</Badge> : null}</TabsTrigger>
        </TabsList>
        <TabsContent value="customers" className="mt-4"><CustomerList /></TabsContent>
        <TabsContent value="inbox" className="mt-4"><InboxReview /></TabsContent>
      </Tabs>
    </div>
  );
}

function CustomerList() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ["customer_summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_summary").select("*").limit(5000);
      if (error) throw error;
      return data as Customer[];
    },
  });
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    const rows = customers.filter(c => !t || [c.name, c.email, c.organization].some(v => (v || "").toLowerCase().includes(t))
      || (digits.length >= 4 && (c.phone || "").replace(/\D/g, "").includes(digits)));
    const total = (c: Customer) => Number(c.catering_count) + Number(c.fundraiser_count) + Number(c.reservation_count) + Number(c.kids_class_count);
    return rows.sort((a, b) => sort === "revenue" ? Number(b.lifetime_revenue) - Number(a.lifetime_revenue)
      : sort === "bookings" ? total(b) - total(a)
      : sort === "name" ? (a.organization || a.name || "").localeCompare(b.organization || b.name || "")
      : (b.last_activity_at || b.created_at).localeCompare(a.last_activity_at || a.created_at));
  }, [customers, q, sort]);
  const repeat = customers.filter(c => Number(c.catering_count) + Number(c.fundraiser_count) + Number(c.reservation_count) + Number(c.kids_class_count) > 1).length;

  if (error) return <div className="text-sm text-destructive">Couldn't load customers: {(error as Error).message}. (Has the customers SQL been run in Supabase?)</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Customers" value={customers.length.toLocaleString()} />
        <Stat label="Repeat customers" value={repeat.toLocaleString()} />
        <Stat label="Lifetime revenue" value={money(customers.reduce((s, c) => s + Number(c.lifetime_revenue || 0), 0))} />
        <Stat label="New in last 30 days" value={customers.filter(c => Date.now() - new Date(c.created_at).getTime() < 30 * 86400000).length.toLocaleString()} />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, organization, email or phone…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent activity</SelectItem>
            <SelectItem value="revenue">Highest revenue</SelectItem>
            <SelectItem value="bookings">Most requests</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
          <div className="col-span-4">Customer</div><div className="col-span-3">Requests</div>
          <div className="col-span-2 text-right">Revenue</div><div className="col-span-3">First came from · last activity</div>
        </div>
        {isLoading ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
          : list.length === 0 ? <div className="p-8 text-center text-muted-foreground">No customers found.</div>
          : list.slice(0, 300).map(c => (
          <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full text-left grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/40">
            <div className="md:col-span-4 min-w-0">
              <div className="font-medium truncate">{c.organization || c.name || c.email || "Unknown"}</div>
              <div className="text-xs text-muted-foreground truncate">{[c.organization ? c.name : null, c.email, c.phone].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-1 items-center">
              {Number(c.catering_count) > 0 && <Chip kind="catering" n={c.catering_count} />}
              {Number(c.fundraiser_count) > 0 && <Chip kind="fundraiser" n={c.fundraiser_count} />}
              {Number(c.reservation_count) > 0 && <Chip kind="large_reservation" n={c.reservation_count} />}
              {Number(c.kids_class_count) > 0 && <Chip kind="kids_class" n={c.kids_class_count} />}
            </div>
            <div className="md:col-span-2 md:text-right font-medium">{Number(c.lifetime_revenue) ? money(c.lifetime_revenue) : <span className="text-muted-foreground">—</span>}</div>
            <div className="md:col-span-3 text-xs text-muted-foreground">
              <div className="truncate">{c.first_source || "Source unknown"}</div>
              <div>{c.last_activity_at ? formatDistanceToNow(parseISO(c.last_activity_at), { addSuffix: true }) : ""}</div>
            </div>
          </button>
        ))}
      </div>
      {list.length > 300 && <p className="text-xs text-muted-foreground">Showing the first 300. Search to narrow it down.</p>}
      {openId && <CustomerSheet id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-card border rounded-lg p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold mt-1">{value}</div></div>
);
const Chip = ({ kind, n }: { kind: string; n: number }) => (
  <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${KIND_COLOR[kind]}`}>{KIND_LABEL[kind]}{Number(n) > 1 ? ` ×${n}` : ""}</span>
);

function CustomerSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useEmployee();
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<Record<string, string> | null>(null);
  const { data: c } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await supabase.from("customer_summary").select("*").eq("id", id).single()).data as Customer,
  });
  const { data: acts = [] } = useQuery({
    queryKey: ["customer_activities", id],
    queryFn: async () => (await supabase.from("customer_activities").select("*").eq("customer_id", id).order("created_at", { ascending: false })).data || [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["customer", id] }); qc.invalidateQueries({ queryKey: ["customer_activities", id] }); qc.invalidateQueries({ queryKey: ["customer_summary"] }); };
  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customer_activities").insert({ customer_id: id, kind: "note", title: "Note", body: note.trim(), created_by: profile?.email || null });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); refresh(); },
    onError: (e) => toast({ title: "Couldn't add note", description: (e as Error).message, variant: "destructive" }),
  });
  const save = useMutation({
    mutationFn: async () => {
      const e = edit!;
      const digits = (e.phone || "").replace(/\D/g, "").slice(-10);
      const { error } = await supabase.from("customers").update({
        name: e.name || null, organization: e.organization || null, email: (e.email || "").trim().toLowerCase() || null,
        phone: e.phone || null, phone_digits: digits.length === 10 ? digits : null, notes: e.notes || null, updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setEdit(null); refresh(); toast({ title: "Customer saved" }); },
    onError: (e) => toast({ title: "Couldn't save", description: /duplicate|unique/i.test((e as Error).message) ? "Another customer already has that email." : (e as Error).message, variant: "destructive" }),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        {!c ? <Loader2 className="w-5 h-5 animate-spin m-6" /> : (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-2xl">{c.organization || c.name || c.email}</SheetTitle>
              <SheetDescription>Customer since {format(parseISO(c.created_at), "MMMM d, yyyy")}{c.first_source ? ` · first came from ${c.first_source}` : ""}</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Stat label="Requests" value={String(Number(c.catering_count) + Number(c.fundraiser_count) + Number(c.reservation_count) + Number(c.kids_class_count))} />
              <Stat label="Revenue" value={money(c.lifetime_revenue)} />
              <Stat label="Last activity" value={c.last_activity_at ? format(parseISO(c.last_activity_at), "MMM d") : "—"} />
            </div>

            {edit ? (
              <div className="space-y-3 border rounded-lg p-4 mb-5">
                {(["name", "organization", "email", "phone"] as const).map(k => (
                  <div key={k} className="grid gap-1"><Label className="capitalize">{k}</Label><Input value={edit[k] || ""} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></div>
                ))}
                <div className="grid gap-1"><Label>About this customer</Label><Textarea rows={3} value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
                <div className="flex gap-2"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm mb-5">
                {c.name && <div className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />{c.name}</div>}
                {c.organization && <div className="flex items-center gap-2"><Building className="w-4 h-4 text-muted-foreground" />{c.organization}</div>}
                {c.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a></div>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><a className="hover:underline" href={`tel:${c.phone}`}>{c.phone}</a></div>}
                {c.notes && <div className="flex items-start gap-2 whitespace-pre-wrap"><StickyNote className="w-4 h-4 text-muted-foreground mt-0.5" />{c.notes}</div>}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setEdit({ name: c.name || "", organization: c.organization || "", email: c.email || "", phone: c.phone || "", notes: c.notes || "" })}>Edit details</Button>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <Label>Add a note</Label>
              <Textarea rows={2} placeholder="Called about a holiday party, wants a quote by Friday…" value={note} onChange={e => setNote(e.target.value)} />
              <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>Add note</Button>
            </div>

            <h3 className="text-sm font-semibold border-b pb-2 mb-2">History</h3>
            <div className="space-y-3">
              {acts.length === 0 && <div className="text-sm text-muted-foreground">Nothing yet.</div>}
              {acts.map((a: any) => (
                <div key={a.id} className="flex gap-3">
                  <span className={`h-fit text-[11px] rounded px-1.5 py-0.5 font-medium shrink-0 ${KIND_COLOR[a.kind] || KIND_COLOR.other}`}>{KIND_LABEL[a.kind] || a.kind}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{a.title}</div>
                    {a.body && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</div>}
                    <div className="text-xs text-muted-foreground">{format(parseISO(a.created_at), "MMM d, yyyy h:mm a")}{a.created_by ? ` · ${a.created_by}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InboxReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [show, setShow] = useState<"new" | "ignored" | "applied">("new");
  const [checking, setChecking] = useState(false);
  const { data: status } = useQuery({
    queryKey: ["mailbox_status"],
    queryFn: async () => ((await supabase.rpc("mailbox_status")).data || [])[0] as any,
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inbox_items", show],
    queryFn: async () => {
      const { data, error } = await supabase.from("inbox_items").select("*, customers(id,name,organization,email)").eq("status", show).order("received_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });
  const checkNow = async () => {
    setChecking(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/inbox-sync", { method: "POST", headers: { authorization: `Bearer ${sess.session?.access_token || ""}` } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error || `Request failed (${res.status})`);
      toast({ title: d.skipped ? "No inbox connected" : `Inbox checked`, description: d.skipped ? "Connect the catering inbox under Settings → Catering inbox." : `${d.added || 0} new email${d.added === 1 ? "" : "s"} sorted.` });
      qc.invalidateQueries({ queryKey: ["inbox_items"] }); qc.invalidateQueries({ queryKey: ["inbox_items_count"] }); qc.invalidateQueries({ queryKey: ["mailbox_status"] });
    } catch (e) {
      toast({ title: "Couldn't check the inbox", description: (e as Error).message, variant: "destructive" });
    } finally { setChecking(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-lg p-4">
        <div className="text-sm">
          {status ? <>Watching <b>{status.email}</b>{status.last_checked_at ? ` · last checked ${formatDistanceToNow(parseISO(status.last_checked_at), { addSuffix: true })}` : ""}
            {status.last_error && <div className="text-destructive mt-1">{status.last_error}</div>}</>
            : <>No inbox connected yet. Connect it under <a className="underline" href="/settings?tab=inbox">Settings → Catering inbox</a>.</>}
          <div className="text-xs text-muted-foreground mt-1">AI sorts new emails into leads and customer follow-ups. Nothing is added to Connect until someone approves it here.</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Select value={show} onValueChange={(v) => setShow(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="new">To review</SelectItem><SelectItem value="applied">Done</SelectItem><SelectItem value="ignored">Ignored / not leads</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" onClick={checkNow} disabled={checking || !status}>{checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Check now</Button>
        </div>
      </div>
      {isLoading ? <div className="p-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : items.length === 0 ? <div className="p-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">{show === "new" ? "Nothing to review. New emails will show up here." : "Nothing here."}</div>
        : items.map((it: any) => <InboxCard key={it.id} item={it} />)}
    </div>
  );
}

function InboxCard({ item }: { item: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile } = useEmployee();
  const ai = item.ai || {};
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(PIPELINE[item.category] ? item.category : "catering");
  const [store, setStore] = useState<string>(storeFromText(ai.store));
  const [date, setDate] = useState<string>(ai.event_date || "");
  const [busy, setBusy] = useState(false);
  const who = ai.name || item.from_name || item.from_email;
  const done = async (status: "applied" | "ignored", note: string, customerId?: string | null) => {
    await supabase.from("inbox_items").update({ status, applied_note: note, handled_by: profile?.email || null, handled_at: new Date().toISOString(), ...(customerId ? { customer_id: customerId } : {}) }).eq("id", item.id);
    ["inbox_items", "inbox_items_count", "customer_summary"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };
  const findOrCreateCustomer = async () => {
    if (item.customer_id) return item.customer_id as string;
    const { data, error } = await supabase.rpc("find_or_create_customer", {
      p_email: ai.email || item.from_email, p_phone: ai.phone || null, p_name: who, p_org: ai.organization || null, p_source: "Email (catering inbox)", p_when: item.received_at,
    });
    if (error) throw error;
    return data as string;
  };
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast({ title: "Couldn't do that", description: (e as Error).message, variant: "destructive" }); } finally { setBusy(false); } };

  const createRequest = () => run(async () => {
    const p = PIPELINE[kind];
    if (!store) throw new Error("Pick the store first.");
    if (!date) throw new Error("Add the event date first.");
    const notes = [ai.summary, ai.details, `From email: "${item.subject}" (${format(parseISO(item.received_at), "MMM d")})`].filter(Boolean).join("\n");
    const row: Record<string, unknown> = {
      name: who, email: ai.email || item.from_email, phone: ai.phone || null, [p.org]: ai.organization || null,
      event_date: date, location: store, notes, status: "Requested", lead_source: "Email (catering inbox)",
    };
    if (p.guests && ai.guest_count) row.guest_count = Number(ai.guest_count) || null;
    let { error } = await supabase.from(p.table).insert(row);
    if (error && /lead_source/.test(error.message)) { delete row.lead_source; ({ error } = await supabase.from(p.table).insert(row)); }
    if (error) throw error;
    const cid = await findOrCreateCustomer();
    await done("applied", `Added to ${p.label}`, cid);
    toast({ title: `Added to ${p.label}`, description: "It's in the pipeline as Requested and on the customer's history." });
  });
  const addNote = () => run(async () => {
    const cid = await findOrCreateCustomer();
    const { error } = await supabase.from("customer_activities").insert({
      customer_id: cid, kind: "email", title: `Email: ${item.subject || "(no subject)"}`, body: [ai.summary, ai.details].filter(Boolean).join("\n") || item.snippet,
      ref_table: "inbox_items", ref_id: item.id, created_by: profile?.email || null, created_at: item.received_at,
    });
    if (error) throw error;
    await done("applied", "Added to customer history", cid);
    toast({ title: "Added to customer history" });
  });
  const ignore = () => run(async () => { await done("ignored", "Ignored"); });

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] rounded px-1.5 py-0.5 font-medium ${KIND_COLOR[item.category] || KIND_COLOR.other}`}>{KIND_LABEL[item.category] || "Other"}</span>
            {item.customers ? <span className="text-xs bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5 font-medium">Existing customer: {item.customers.organization || item.customers.name || item.customers.email}</span>
              : <span className="text-xs bg-sky-100 text-sky-800 rounded px-1.5 py-0.5 font-medium">New contact</span>}
          </div>
          <div className="font-semibold mt-1 truncate">{item.subject || "(no subject)"}</div>
          <div className="text-xs text-muted-foreground">{item.from_name ? `${item.from_name} · ` : ""}{item.from_email} · {format(parseISO(item.received_at), "EEE MMM d, h:mm a")}</div>
        </div>
        {item.status !== "new" && <div className="text-xs text-muted-foreground">{item.applied_note}{item.handled_by ? ` · ${item.handled_by}` : ""}</div>}
      </div>
      {ai.summary && <div className="text-sm">{ai.summary}</div>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ai.organization && <span>Org: <b className="text-foreground">{ai.organization}</b></span>}
        {ai.phone && <span>Phone: <b className="text-foreground">{ai.phone}</b></span>}
        {ai.event_date && <span>Date: <b className="text-foreground">{format(parseISO(ai.event_date), "MMM d, yyyy")}</b></span>}
        {ai.guest_count && <span>Guests: <b className="text-foreground">{ai.guest_count}</b></span>}
        {ai.store && <span>Store: <b className="text-foreground">{ai.store}</b></span>}
        {ai.details && <span className="basis-full">{ai.details}</span>}
      </div>
      <button className="text-xs text-primary flex items-center gap-1" onClick={() => setOpen(o => !o)}>{open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}{open ? "Hide email" : "Show email"}</button>
      {open && <div className="text-sm bg-muted/40 rounded p-3 whitespace-pre-wrap max-h-80 overflow-y-auto">{item.body || item.snippet}</div>}

      {item.status !== "applied" && (
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
          <div className="grid gap-1"><Label className="text-xs">Add as</Label>
            <Select value={kind} onValueChange={setKind}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PIPELINE).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1"><Label className="text-xs">Store</Label>
            <Select value={store} onValueChange={setStore}><SelectTrigger className="h-8 w-40"><SelectValue placeholder="Pick store" /></SelectTrigger>
              <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1"><Label className="text-xs">Event date</Label><Input type="date" className="h-8 w-40" value={date} onChange={e => setDate(e.target.value)} /></div>
          <Button size="sm" onClick={createRequest} disabled={busy}>Create request</Button>
          <Button size="sm" variant="outline" onClick={addNote} disabled={busy}>Just add to customer history</Button>
          {item.status === "new" && <Button size="sm" variant="ghost" onClick={ignore} disabled={busy}>Ignore</Button>}
        </div>
      )}
    </div>
  );
}
