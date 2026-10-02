import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface TeamMemberLite { name: string; email: string }

/** Shared, cached list of team members with a real email (for assigning work). */
export function useTeamMembers() {
  return useQuery({
    queryKey: ["team_members_lite"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_profiles").select("name,email,status");
      if (error) throw error;
      const seen = new Set<string>();
      return (data || [])
        .filter((p) => p.status !== "disabled" && /@/.test(p.email || ""))
        .map((p) => ({ email: String(p.email).trim().toLowerCase(), name: p.name && !/@/.test(p.name) ? String(p.name) : "" }))
        .filter((p) => (seen.has(p.email) ? false : (seen.add(p.email), true)))
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)) as TeamMemberLite[];
    },
  });
}

export function memberLabel(members: TeamMemberLite[] | undefined, email?: string | null): string {
  if (!email) return "Unassigned";
  const m = members?.find((x) => x.email === email.trim().toLowerCase());
  return m?.name || email;
}

const OTHER = "__other__";
const NONE = "__none__";

/** Pick an assignee from the team list, or type another email (e.g. an outside designer). Value is an email or "". */
export function TeamMemberSelect({
  value, onChange, placeholder = "Assign to…", className, allowNone = true,
}: {
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
  className?: string;
  allowNone?: boolean;
}) {
  const { data: members = [] } = useTeamMembers();
  const v = (value || "").trim().toLowerCase();
  const inList = !!v && members.some((m) => m.email === v);
  const [typing, setTyping] = useState(false);
  const showInput = typing || (!!v && !inList && members.length > 0);

  if (showInput) {
    return (
      <div className={`flex gap-1 ${className ?? ""}`}>
        <Input type="email" autoFocus={typing} value={value} placeholder="name@example.com"
          onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" aria-label="Assignee email" />
        <button type="button" className="text-xs text-primary hover:underline shrink-0 px-1"
          onClick={() => { setTyping(false); onChange(""); }}>
          Team list
        </button>
      </div>
    );
  }

  return (
    <Select
      value={inList ? v : (allowNone && !v ? NONE : undefined)}
      onValueChange={(val) => {
        if (val === OTHER) { setTyping(true); onChange(""); }
        else if (val === NONE) onChange("");
        else onChange(val);
      }}
    >
      <SelectTrigger className={`h-8 text-xs ${className ?? ""}`}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Unassigned</SelectItem>}
        {members.map((m) => (
          <SelectItem key={m.email} value={m.email}>
            {m.name ? `${m.name}` : m.email}
            {m.name && <span className="text-muted-foreground ml-1.5 text-[11px]">{m.email}</span>}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={OTHER}>Someone else (type an email)…</SelectItem>
      </SelectContent>
    </Select>
  );
}
