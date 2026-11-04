import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { emailToStore, type LeadKind } from "@/lib/leadEmail";

/** "Email to store" button: sends this request's details (with attachments) to its assigned location. */
export function EmailStoreButton({ kind, id, className, label = "Email details to store" }: { kind: LeadKind; id: string | number; className?: string; label?: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="outline" className={className} disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const r = await emailToStore(kind, id);
        toast({ title: `Sent to ${r.store}`, description: `Details emailed to ${r.to}.` });
      } catch (e) {
        toast({ title: "Couldn't email the store", description: (e as Error).message, variant: "destructive" });
      } finally { setBusy(false); }
    }}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}{label}
    </Button>
  );
}
