import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/components/marketing/TeamMemberSelect";

const WEB = "__web__";

/** "Intake by": who entered this request. Blank = it came in through the website (Web lead). Saves right away. */
export function IntakeBySelect({ table, id }: { table: "catering_requests" | "fundraisers" | "large_reservations" | "kids_classes"; id: string | number }) {
  const { toast } = useToast();
  const { data: members = [] } = useTeamMembers();
  const [value, setValue] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    supabase.from(table).select("intake_by").eq("id", id as any).single().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setValue(null); return; }
      setValue(((data as any)?.intake_by as string | null) || null);
    });
    return () => { alive = false; };
  }, [table, id]);

  const save = async (v: string) => {
    const next = v === WEB ? null : v;
    setValue(next);
    const { error } = await supabase.from(table).update({ intake_by: next }).eq("id", id as any);
    if (error) toast({ title: "Couldn't save Intake by", description: /intake_by/.test(error.message) ? "Run the latest SQL update in Supabase first." : error.message, variant: "destructive" });
  };

  if (value === undefined) return null;
  const v = value || WEB;
  const known = !value || members.some((m) => m.email === value);
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Intake by</Label>
      <Select value={v} onValueChange={save}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={WEB}>Web lead</SelectItem>
          {members.map((m) => <SelectItem key={m.email} value={m.email}>{m.name || m.email}</SelectItem>)}
          {!known && value && <SelectItem value={value}>{value}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}

/** "Intake by" for the New Request forms. Starts on whoever is signed in; "" = Web lead. */
export function IntakeByField({ value, onChange }: { value: string; onChange: (email: string) => void }) {
  const { data: members = [] } = useTeamMembers();
  useEffect(() => {
    if (value) return;
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      const me = data.user?.email?.trim().toLowerCase();
      if (alive && me) onChange(me);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const known = !value || members.some((m) => m.email === value);
  return (
    <div className="grid gap-2">
      <Label>Intake by</Label>
      <Select value={value || WEB} onValueChange={(v) => onChange(v === WEB ? "" : v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={WEB}>Web lead</SelectItem>
          {members.map((m) => <SelectItem key={m.email} value={m.email}>{m.name || m.email}</SelectItem>)}
          {!known && <SelectItem value={value}>{value}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}
