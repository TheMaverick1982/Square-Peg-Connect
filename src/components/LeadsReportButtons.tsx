import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertSettingsButton } from "@/components/AlertRecipientsButton";

/** Admin-only controls for the Monday "Weekly Leads & Events Report" email. */
export function LeadsReportButtons() {
  const { profile } = useEmployee();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  if (profile?.role !== "admin") return null;

  const sendTest = async () => {
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/leads-report", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess.session?.access_token || ""}` },
        body: JSON.stringify({ mode: "test" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      toast({ title: "Test report sent", description: "Check your inbox for the all-stores version of last week's report." });
    } catch (e) {
      toast({ title: "Couldn't send test", description: (e as Error).message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <>
      <AlertSettingsButton
        title="Weekly Leads & Events Report"
        buttonLabel="Weekly leads & events email"
        description="Sent Monday mornings for last Monday–Sunday. Each store automatically gets its own report; the people below get the all-stores report."
        groups={[{ key: "leads_report", label: "Extra recipients (all stores)", description: "One email per line." }]}
      />
      <Button variant="outline" onClick={sendTest} disabled={sending}>
        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
        Send me a test
      </Button>
    </>
  );
}
