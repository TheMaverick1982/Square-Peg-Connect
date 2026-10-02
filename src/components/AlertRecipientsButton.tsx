import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface AlertGroup { key: string; label: string; description: string }

const parseEmails = (text: string) => Array.from(new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));

/** Admin-only button + dialog to edit who receives one or more email alerts (notification_settings rows). */
export function AlertSettingsButton({ groups, title, description, buttonLabel = "Email alerts", size }: {
  groups: AlertGroup[]; title: string; description?: string; buttonLabel?: string; size?: "sm" | "default";
}) {
  const { profile } = useEmployee();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const isAdmin = profile?.role === "admin";
  const keys = groups.map((g) => g.key);

  const { data: saved, error } = useQuery({
    queryKey: ["notification_settings", ...keys],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_settings").select("key,recipients").in("key", keys);
      if (error) throw error;
      const out: Record<string, string[]> = {};
      for (const k of keys) out[k] = ((data || []).find((r) => r.key === k)?.recipients as string[]) || [];
      return out;
    },
  });

  useEffect(() => {
    if (open && saved) setDrafts(Object.fromEntries(keys.map((k) => [k, (saved[k] || []).join("\n")])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saved]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = keys.map((k) => ({ key: k, recipients: parseEmails(drafts[k] || ""), updated_at: new Date().toISOString() }));
      const bad = rows.flatMap((r) => r.recipients).filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (bad.length) throw new Error(`Not a valid email: ${bad.join(", ")}`);
      const { error } = await supabase.from("notification_settings").upsert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_settings"] });
      toast({ title: "Email alerts saved" });
      setOpen(false);
    },
    onError: (e) => toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" }),
  });

  if (!isAdmin) return null;
  const count = saved ? keys.reduce((n, k) => n + (saved[k]?.length ?? 0), 0) : null;

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <Mail className="w-4 h-4 mr-2" /> {buttonLabel}{groups.length === 1 && count !== null ? ` (${count})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {error ? (
            <p className="text-sm text-amber-700">Couldn't load settings. Run the latest setup SQL in Supabase first.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="text-sm font-medium">{g.label}</div>
                  <div className="text-xs text-muted-foreground mb-1.5">{g.description}</div>
                  <Textarea rows={3} value={drafts[g.key] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [g.key]: e.target.value }))}
                    className="font-mono text-sm" placeholder={"one email per line"} aria-label={g.label} />
                </div>
              ))}
            </div>
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

/** Single-list version (used on Staff Photos). */
export function AlertRecipientsButton({ settingKey, title, description }: { settingKey: string; title: string; description: string }) {
  return <AlertSettingsButton title={title} groups={[{ key: settingKey, label: "Recipients", description }]} />;
}
