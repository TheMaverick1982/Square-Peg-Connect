import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertSettingsButton } from "@/components/AlertRecipientsButton";

/** Admin-only controls for the weekly (Mondays) and monthly (the 1st) Leads & Events Report emails. */
export function LeadsReportButtons() {
  const { profile } = useEmployee();
  const { toast } = useToast();
  const [sending, setSending] = useState<"" | "week" | "month">("");
  if (profile?.role !== "admin") return null;

  const sendTest = async (period: "week" | "month") => {
    setSending(period);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/leads-report", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess.session?.access_token || ""}` },
        body: JSON.stringify({ mode: "test", period }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      toast({ title: "Test report sent", description: `Check your inbox for the all-stores version of last ${period}'s report.` });
    } catch (e) {
      toast({ title: "Couldn't send test", description: (e as Error).message, variant: "destructive" });
    } finally { setSending(""); }
  };

  return (
    <>
      <AlertSettingsButton
        title="Leads & Events Report emails"
        buttonLabel="Leads & events emails"
        description="Weekly on Monday mornings (last Monday–Sunday) and monthly on the 1st (last month). Each store automatically gets its own report; the people below get the all-stores report."
        groups={[{ key: "leads_report", label: "Extra recipients (all stores)", description: "One email per line." }]}
      />
      {(["week", "month"] as const).map((p) => (
        <Button key={p} variant="outline" onClick={() => sendTest(p)} disabled={!!sending}>
          {sending === p ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Test {p === "week" ? "weekly" : "monthly"}
        </Button>
      ))}
    </>
  );
}
