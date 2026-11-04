import { useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { storeClock, storeTimeToInstant, tzForLocation } from "@/lib/tz";
import { EVENT_TYPES } from "@/lib/eventTypes";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type CalendarType = "Entertainment" | "Fundraiser" | "StoreEvent" | "LargeReservation" | "KidsClass" | "Catering";

type Field = { key: string; label: string; kind: "text" | "email" | "date" | "time" | "number" | "textarea" | "location" | "status" | "eventType" };
const BASIC_STATUSES = ["Requested", "Confirmed", "Completed", "Cancelled"];
const CATERING_STATUSES = ["Requested", "Waiting on you", "Waiting on the customer", "Confirmed", "Completed", "Cancelled"];

const CONFIG: Record<Exclude<CalendarType, "Entertainment">, { table: string; statuses: string[]; fields: Field[] }> = {
  Fundraiser: { table: "fundraisers", statuses: BASIC_STATUSES, fields: [
    { key: "organization", label: "Organization", kind: "text" }, { key: "name", label: "Contact name", kind: "text" },
    { key: "email", label: "Email", kind: "email" }, { key: "phone", label: "Phone", kind: "text" },
    { key: "event_date", label: "Date", kind: "date" }, { key: "location", label: "Location", kind: "location" },
    { key: "status", label: "Status", kind: "status" }, { key: "notes", label: "Notes", kind: "textarea" },
  ] },
  StoreEvent: { table: "store_events", statuses: BASIC_STATUSES, fields: [
    { key: "organization", label: "Organization / event", kind: "text" }, { key: "name", label: "Contact name", kind: "text" },
    { key: "email", label: "Email", kind: "email" }, { key: "phone", label: "Phone", kind: "text" },
    { key: "event_date", label: "Date", kind: "date" }, { key: "location", label: "Location", kind: "location" },
    { key: "status", label: "Status", kind: "status" }, { key: "notes", label: "Notes", kind: "textarea" },
  ] },
  LargeReservation: { table: "large_reservations", statuses: BASIC_STATUSES, fields: [
    { key: "name", label: "Name", kind: "text" }, { key: "organization", label: "Organization", kind: "text" },
    { key: "email", label: "Email", kind: "email" }, { key: "phone", label: "Phone", kind: "text" },
    { key: "event_date", label: "Date", kind: "date" }, { key: "time_start", label: "Start time", kind: "time" }, { key: "time_finish", label: "End time", kind: "time" },
    { key: "guest_count", label: "Guests", kind: "number" }, { key: "location", label: "Location", kind: "location" },
    { key: "event_type", label: "Type of event", kind: "eventType" }, { key: "status", label: "Status", kind: "status" }, { key: "notes", label: "Notes", kind: "textarea" },
  ] },
  KidsClass: { table: "kids_classes", statuses: BASIC_STATUSES, fields: [
    { key: "name", label: "Parent / guardian", kind: "text" }, { key: "organization", label: "Organization / school", kind: "text" },
    { key: "email", label: "Email", kind: "email" }, { key: "phone", label: "Phone", kind: "text" },
    { key: "event_date", label: "Date", kind: "date" }, { key: "time_start", label: "Start time", kind: "time" }, { key: "time_finish", label: "End time", kind: "time" },
    { key: "guest_count", label: "Number of kids", kind: "number" }, { key: "location", label: "Location", kind: "location" },
    { key: "status", label: "Status", kind: "status" }, { key: "notes", label: "Notes", kind: "textarea" },
  ] },
  Catering: { table: "catering_requests", statuses: CATERING_STATUSES, fields: [
    { key: "company", label: "Company / event", kind: "text" }, { key: "name", label: "Contact name", kind: "text" },
    { key: "email", label: "Email", kind: "email" }, { key: "phone", label: "Phone", kind: "text" },
    { key: "event_date", label: "Date", kind: "date" }, { key: "pickup_time", label: "Pickup / ready time", kind: "time" },
    { key: "guest_count", label: "Guests", kind: "number" }, { key: "location", label: "Location", kind: "location" },
    { key: "event_type", label: "Type of event", kind: "eventType" }, { key: "status", label: "Status", kind: "status" }, { key: "notes", label: "Notes", kind: "textarea" },
  ] },
};

/** Edit any Master Calendar entry in place. Saves to the same record its pipeline uses. */
export function CalendarEventEditor({ type, row, onSaved, onCancel }: { type: CalendarType; row: any; onSaved: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // Entertainment keeps its times in the store's time zone.
  const tz = tzForLocation(type === "Entertainment" ? row.location_id : row.location);
  const [f, setF] = useState<Record<string, any>>(() => {
    if (type !== "Entertainment") {
      const out: Record<string, any> = {};
      CONFIG[type].fields.forEach((fl) => { out[fl.key] = row[fl.key] ?? ""; });
      out.event_date = String(row.event_date || "").slice(0, 10);
      return out;
    }
    const start = storeClock(row.start_date, tz), end = storeClock(row.end_date || row.start_date, tz);
    return { title: row.title || "", details: row.details || "", location_id: row.location_id || "all",
      date: format(start, "yyyy-MM-dd"), start_time: format(start, "HH:mm"), end_time: format(end, "HH:mm") };
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      if (type === "Entertainment") {
        if (!f.title.trim() || !f.date || !f.start_time || !f.end_time) throw new Error("Title, date and times are required.");
        const zone = tzForLocation(f.location_id === "all" ? null : f.location_id);
        const start = storeTimeToInstant(f.date, f.start_time, zone);
        let end = storeTimeToInstant(f.date, f.end_time, zone);
        if (end <= start) end = storeTimeToInstant(format(addDays(parseISO(f.date), 1), "yyyy-MM-dd"), f.end_time, zone);
        const { error } = await supabase.from("events").update({
          title: f.title.trim(), details: f.details, location_id: f.location_id === "all" ? null : f.location_id,
          start_date: start.toISOString(), end_date: end.toISOString(),
        }).eq("id", row.id);
        if (error) throw error;
      } else {
        const cfg = CONFIG[type];
        if (!f.event_date) throw new Error("Pick a date.");
        const updates: Record<string, any> = {};
        cfg.fields.forEach((fl) => {
          let v = f[fl.key];
          if (fl.kind === "number") v = v === "" || v === null ? null : Number(v);
          else if (fl.kind === "time" || fl.kind === "eventType") v = v ? v : null;
          updates[fl.key] = v;
        });
        const { error } = await supabase.from(cfg.table).update(updates).eq("id", row.id);
        if (error) throw error;
      }
      toast({ title: "Saved", description: "The calendar and the pipeline are updated." });
      onSaved();
    } catch (e) {
      toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const input = (fl: Field) => {
    const v = f[fl.key] ?? "";
    switch (fl.kind) {
      case "textarea": return <Textarea rows={3} value={v} onChange={(e) => set(fl.key, e.target.value)} />;
      case "location": return (
        <Select value={v || ""} onValueChange={(x) => set(fl.key, x)}>
          <SelectTrigger><SelectValue placeholder="Pick a location" /></SelectTrigger>
          <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
        </Select>);
      case "status": return (
        <Select value={v || ""} onValueChange={(x) => set(fl.key, x)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{(type === "Entertainment" ? [] : CONFIG[type].statuses).map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
        </Select>);
      case "eventType": return (
        <Select value={v || "none"} onValueChange={(x) => set(fl.key, x === "none" ? "" : x)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">Not set</SelectItem>{EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>)}</SelectContent>
        </Select>);
      default: return <Input type={fl.kind} value={v} onChange={(e) => set(fl.key, e.target.value)} />;
    }
  };

  return (
    <div className="space-y-4 py-4">
      {type === "Entertainment" ? (
        <>
          {row.is_recurring && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2">This repeats {row.recurrence_pattern}. Changes apply to every date in the series, starting from the date below.</div>}
          <div className="grid gap-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Start</Label><Input type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>End</Label><Input type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Location</Label>
            <Select value={f.location_id} onValueChange={(x) => set("location_id", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-1.5"><Label>Details</Label><Textarea rows={4} value={f.details} onChange={(e) => set("details", e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Times are in the store's local time.</p>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {CONFIG[type].fields.map((fl) => (
            <div key={fl.key} className={`grid gap-1.5 ${["textarea", "email"].includes(fl.kind) || fl.key === "organization" || fl.key === "company" ? "col-span-2" : ""}`}>
              <Label>{fl.label}</Label>{input(fl)}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save changes</Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
