import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPES } from "@/lib/eventTypes";
import { EmailStoreButton } from "@/components/EmailStoreButton";
import type { LeadKind } from "@/lib/leadEmail";
import { Loader2, Paperclip, Trash2, UploadCloud, ClipboardList } from "lucide-react";

type Attachment = { path: string; name: string; type: string; size: number; url: string };
type Extras = {
  event_type: string | null; pickup_time: string | null; paid_by_invoice: boolean | null;
  deposit_amount: number | null; deposit_paid: boolean | null; attachments: Attachment[] | null;
};
const BUCKET = "order-files";
const MAX_MB = 25;

/**
 * Staff-only order details for catering orders and large reservations:
 * type of event, pickup time (catering), paid by invoice, deposit, attachments, and "email to store".
 * Saves straight to the record as you change things.
 */
export function OrderExtras({ table, kind, id, showPickupTime, showDeposit, onSaved }: {
  table: "catering_requests" | "large_reservations"; kind: LeadKind; id: string;
  showPickupTime?: boolean; showDeposit?: boolean; onSaved?: (changes: Partial<Extras>) => void;
}) {
  const { toast } = useToast();
  const [x, setX] = useState<Extras | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cols = ["event_type", "paid_by_invoice", "attachments", ...(showPickupTime ? ["pickup_time"] : []), ...(showDeposit ? ["deposit_amount", "deposit_paid"] : [])].join(",");

  useEffect(() => {
    let alive = true;
    supabase.from(table).select(cols).eq("id", id).single().then(({ data, error }) => {
      if (!alive) return;
      if (error) { toast({ title: "Couldn't load order details", description: /column/i.test(error.message) ? "Run the latest SQL update in Supabase first." : error.message, variant: "destructive" }); return; }
      setX(data as unknown as Extras);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, id]);

  const save = async (changes: Partial<Extras>) => {
    setX((prev) => (prev ? { ...prev, ...changes } : prev));
    const { error } = await supabase.from(table).update(changes).eq("id", id);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else onSaved?.(changes);
  };

  const upload = async (list: FileList | null) => {
    if (!list || !x) return;
    const files = Array.from(list);
    const big = files.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (big.length) toast({ title: `Files over ${MAX_MB}MB were skipped`, description: big.map((f) => f.name).join(", "), variant: "destructive" });
    setUploading(true);
    try {
      const added: Attachment[] = [];
      for (const f of files.filter((f) => f.size <= MAX_MB * 1024 * 1024)) {
        const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
        const path = `${table}/${id}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        added.push({ path, name: f.name, type: f.type, size: f.size, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
      }
      if (added.length) {
        await save({ attachments: [...(x.attachments || []), ...added] });
        toast({ title: `${added.length} file${added.length === 1 ? "" : "s"} attached`, description: "Use “Email details to store” to send them to the location." });
      }
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!x) return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading order details…</div>;
  const files = x.attachments || [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-muted-foreground" />Order details</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">Type of event</Label>
          <Select value={x.event_type || "none"} onValueChange={(v) => save({ event_type: v === "none" ? null : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {showPickupTime && (
          <div className="grid gap-1.5">
            <Label className="text-xs">Pickup / ready time</Label>
            <Input type="time" className="h-9" value={x.pickup_time || ""} onChange={(e) => setX({ ...x, pickup_time: e.target.value })}
              onBlur={(e) => save({ pickup_time: e.target.value || null })} />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={!!x.paid_by_invoice} onCheckedChange={(c) => save({ paid_by_invoice: !!c })} />
        Paid by invoice
      </label>
      {showDeposit && (
        <div className="grid grid-cols-2 gap-4 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs">Deposit amount ($)</Label>
            <Input type="number" min="0" step="0.01" className="h-9" value={x.deposit_amount ?? ""} placeholder="0.00"
              onChange={(e) => setX({ ...x, deposit_amount: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={(e) => save({ deposit_amount: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer h-9">
            <Checkbox checked={!!x.deposit_paid} onCheckedChange={(c) => save({ deposit_paid: !!c })} />
            Deposit paid
          </label>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Attachments</Label>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={f.path} className="flex items-center justify-between gap-2 text-sm bg-muted/30 rounded px-3 py-1.5">
                <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 hover:underline">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                </a>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => save({ attachments: files.filter((_, j) => j !== i) })}>
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}Attach files
        </Button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        <p className="text-[11px] text-muted-foreground">Menus, invoices, layouts, photos… up to {MAX_MB}MB each. They're included when you email the store.</p>
      </div>

      <EmailStoreButton kind={kind} id={id} className="w-full" />
    </div>
  );
}
