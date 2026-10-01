import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Admin-only button + dialog to edit who receives a given email alert (notification_settings row). */
export function AlertRecipientsButton({ settingKey, title, description }: { settingKey: string; title: string; description: string }) {
  const { profile } = useEmployee();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const isAdmin = profile?.role === "admin";

  const { data: recipients, error } = useQuery({
    queryKey: ["notification_settings", settingKey],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_settings").select("recipients").eq("key", settingKey).maybeSingle();
      if (error) throw error;
      return ((data?.recipients as string[]) || []);
    },
  });

  useEffect(() => { if (open && recipients) setDraft(recipients.join("\n")); }, [open, recipients]);

  const save = useMutation({
    mutationFn: async () => {
      const list = Array.from(new Set(draft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));
      const bad = list.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (bad.length) throw new Error(`Not a valid email: ${bad.join(", ")}`);
      const { error } = await supabase.from("notification_settings").upsert({ key: settingKey, recipients: list, updated_at: new Date().toISOString() });
      if (error) throw error;
      return list.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["notification_settings", settingKey] });
      toast({ title: "Saved", description: `${n} email${n === 1 ? "" : "s"} will get these alerts.` });
      setOpen(false);
    },
    onError: (e) => toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" }),
  });

  if (!isAdmin) return null;
  const count = recipients?.length ?? 0;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Mail className="w-4 h-4 mr-2" /> Email alerts{recipients ? ` (${count})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-amber-700">Couldn't load settings. Run <code>supabase/marketing-and-alerts.sql</code> in Supabase first.</p>
          ) : (
            <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono text-sm"
              placeholder={"brian@brianhardy.com\nname@squarepegpizzeria.com"} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !!error}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
