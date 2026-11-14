import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { emailToStore, type LeadKind } from "@/lib/leadEmail";
import { CalendarEventEditor, type CalendarType } from "@/components/CalendarEventEditor";

const KIND: Record<string, LeadKind> = { Catering: "catering", Fundraiser: "fundraiser", LargeReservation: "large_reservation", KidsClass: "kids_class" };

const TABLE: Record<Exclude<CalendarType, "Entertainment" | "StoreEvent">, string> = {
  Catering: "catering_requests", Fundraiser: "fundraisers", LargeReservation: "large_reservations", KidsClass: "kids_classes",
};

/**
 * "Edit date, time & details" for a catering order, fundraiser, large reservation or kids class.
 * Opens an inline editor (same one the Master Calendar uses) and calls onSaved after saving.
 */
export function EditRequestButton({ type, id, onSaved }: { type: keyof typeof TABLE; id: string | number; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [row, setRow] = useState<any | null>(null);
  useEffect(() => {
    if (!open) return;
    setRow(null);
    supabase.from(TABLE[type]).select("*").eq("id", id as any).single().then(({ data }) => setRow(data));
  }, [open, type, id]);

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Pencil className="w-4 h-4 mr-2" /> Edit date, time &amp; details
      </Button>
    );
  }
  return (
    <div className="border rounded-lg p-4 bg-muted/10">
      <div className="text-sm font-semibold">Edit date, time &amp; details</div>
      {!row ? <div className="py-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        : <>
            <CalendarEventEditor type={type} row={row} onCancel={() => setOpen(false)} onSaved={() => {
              setOpen(false);
              if (notify) {
                emailToStore(KIND[type], id)
                  .then((r) => toast({ title: "Store updated", description: `The new details were emailed to ${r.store}.` }))
                  .catch((err) => toast({ title: "Saved, but the store email failed", description: (err as Error).message, variant: "destructive" }));
              }
              onSaved();
            }} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={notify} onCheckedChange={(c) => setNotify(!!c)} />
              Email the updated details to the store when I save
            </label>
          </>}
    </div>
  );
}
