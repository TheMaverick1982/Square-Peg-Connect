import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPES } from "@/lib/eventTypes";
import { ORDER_FILE_MAX_MB } from "@/lib/orderFiles";
import { Paperclip, UploadCloud, X } from "lucide-react";

export type NewOrderExtrasValue = { eventType: string; paidByInvoice: boolean; depositAmount: string; depositPaid: boolean; files: File[] };
export const blankNewOrderExtras = (): NewOrderExtrasValue => ({ eventType: "", paidByInvoice: false, depositAmount: "", depositPaid: false, files: [] });

/** Type of event, paid by invoice, (deposit), and files on the New Request forms. Files upload after the request is saved. */
export function NewOrderExtras({ value, onChange, showDeposit }: { value: NewOrderExtrasValue; onChange: (v: NewOrderExtrasValue) => void; showDeposit?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<NewOrderExtrasValue>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Type of event</Label>
        <Select value={value.eventType || "none"} onValueChange={(v) => set({ eventType: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={value.paidByInvoice} onCheckedChange={(c) => set({ paidByInvoice: !!c })} />
        Paid by invoice
      </label>
      {showDeposit && (
        <div className="grid grid-cols-2 gap-4 items-end">
          <div className="grid gap-2">
            <Label>Deposit amount ($)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={value.depositAmount} onChange={(e) => set({ depositAmount: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer h-10">
            <Checkbox checked={value.depositPaid} onCheckedChange={(c) => set({ depositPaid: !!c })} />
            Deposit paid
          </label>
        </div>
      )}
      <div className="grid gap-2">
        <Label>Attachments</Label>
        {value.files.length > 0 && (
          <ul className="space-y-1">
            {value.files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm bg-muted/30 rounded px-3 py-1.5">
                <span className="flex items-center gap-2 min-w-0"><Paperclip className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f.name}</span></span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => set({ files: value.files.filter((_, j) => j !== i) })}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => fileRef.current?.click()}>
          <UploadCloud className="w-4 h-4 mr-2" />Attach files
        </Button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => {
          const picked = Array.from(e.target.files || []).filter((f) => f.size <= ORDER_FILE_MAX_MB * 1024 * 1024);
          set({ files: [...value.files, ...picked] });
          if (fileRef.current) fileRef.current.value = "";
        }} />
        <p className="text-[11px] text-muted-foreground">Menus, invoices, layouts… up to {ORDER_FILE_MAX_MB}MB each. They're sent to the store with the details.</p>
      </div>
    </div>
  );
}
