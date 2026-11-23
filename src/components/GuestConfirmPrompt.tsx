import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { emailGuest, type GuestPrompt } from "@/lib/leadEmail";

const NOUN = { catering: "catering order", fundraiser: "Tuesday fundraiser", large_reservation: "large reservation", kids_class: "kids pizza class" } as const;
const TABLE = { catering: "catering_requests", fundraiser: "fundraisers", large_reservation: "large_reservations", kids_class: "kids_classes" } as const;

/** Mounted once in App. Pops up when a request is marked Confirmed, asking whether to email the guest. */
export function GuestConfirmPrompt() {
  const { toast } = useToast();
  const [p, setP] = useState<GuestPrompt | null>(null);
  const [checked, setChecked] = useState(true);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<GuestPrompt>).detail;
      setP(d); setChecked(true); setSentAt(null);
      // Already emailed before? Say so, and leave the box unticked.
      supabase.from(TABLE[d.kind]).select("guest_emailed_at").eq("id", d.id as any).maybeSingle()
        .then(({ data }) => { if ((data as any)?.guest_emailed_at) { setSentAt((data as any).guest_emailed_at); setChecked(false); } }, () => {});
    };
    window.addEventListener("ask-email-guest", on);
    return () => window.removeEventListener("ask-email-guest", on);
  }, []);

  const done = async () => {
    if (!p) return;
    if (!checked) { setP(null); return; }
    setSending(true);
    try {
      if (p.send) {
        await p.send();
        await supabase.from(TABLE[p.kind]).update({ guest_emailed_at: new Date().toISOString() } as any).eq("id", p.id as any).then(() => {}, () => {});
      } else await emailGuest(p.kind, p.id);
      toast({ title: "Confirmation sent", description: `${p.name || "The guest"} was emailed at ${p.email}.` });
      setP(null);
    } catch (err) {
      toast({ title: "Couldn't email the guest", description: (err as Error).message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <Dialog open={!!p} onOpenChange={(o) => { if (!o && !sending) setP(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Marked as confirmed</DialogTitle>
          <DialogDescription>Let {p?.name || "the guest"} know their {p ? NOUN[p.kind] : "booking"} is confirmed? The email includes the date, time, store address, phone and directions. Replies go to catering@.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
          <span className="text-sm">
            Email the guest a confirmation<span className="block text-muted-foreground">{p?.email}</span>
            {sentAt && <span className="block text-amber-700 mt-1">Already emailed on {new Date(sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</span>}
          </span>
        </label>
        <DialogFooter>
          <Button onClick={done} disabled={sending}>{sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{checked ? "Send" : "Done"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
