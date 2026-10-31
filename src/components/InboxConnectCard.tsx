import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

const RESULT: Record<string, { title: string; description?: string; bad?: boolean }> = {
  connected: { title: "Inbox connected", description: "New emails will be sorted into Customers → Inbox review." },
  cancelled: { title: "Connection cancelled", bad: true },
  expired: { title: "That sign-in link expired", description: "Click Connect again.", bad: true },
  "no-refresh": { title: "Google didn't give lasting access", description: "Click Connect again and approve on the Google screen.", bad: true },
  "not-configured": { title: "Google sign-in isn't set up yet", description: "Brian needs to add the Google keys in Vercel.", bad: true },
  failed: { title: "Couldn't connect the inbox", description: "Please try again.", bad: true },
};

async function call(action: string) {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/google-connect", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sess.session?.access_token || ""}` },
    body: JSON.stringify({ action }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || `Request failed (${res.status})`);
  return d;
}

/** Connect the catering Gmail inbox (read-only) so AI can sort new leads into Connect. */
export function InboxConnectCard() {
  const { profile } = useEmployee();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const isAdmin = profile?.role === "admin";
  const { data: status, isLoading } = useQuery({
    queryKey: ["mailbox_status"],
    queryFn: async () => ((await supabase.rpc("mailbox_status")).data || [])[0] as any,
  });

  // Coming back from Google.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("inbox");
    if (r && RESULT[r]) {
      toast({ title: RESULT[r].title, description: RESULT[r].description, variant: RESULT[r].bad ? "destructive" : undefined });
      params.delete("inbox");
      window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
      qc.invalidateQueries({ queryKey: ["mailbox_status"] });
    }
  }, [toast, qc]);

  const connect = async () => {
    setBusy(true);
    try { const { url } = await call("start"); window.location.href = url; }
    catch (e) { toast({ title: "Couldn't start", description: (e as Error).message, variant: "destructive" }); setBusy(false); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect the catering inbox? Connect will stop checking it for new leads.")) return;
    setBusy(true);
    try { await call("disconnect"); qc.invalidateQueries({ queryKey: ["mailbox_status"] }); toast({ title: "Inbox disconnected" }); }
    catch (e) { toast({ title: "Couldn't disconnect", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Mail className="w-6 h-6 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-medium">Catering inbox</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect the catering Gmail (catering@squarepegpizzeria.com) so AI can spot new leads and customer follow-ups,
              match them to customers, and line them up in <a className="underline" href="/customers?tab=inbox">Customers → Inbox review</a> for approval.
            </p>
            <div className="mt-4">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" />
                : status ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-green-600" />Connected: <b>{status.email}</b></div>
                    <div className="text-xs text-muted-foreground">
                      Connected by {status.connected_by} {formatDistanceToNow(parseISO(status.connected_at), { addSuffix: true })}
                      {status.last_checked_at ? ` · last checked ${formatDistanceToNow(parseISO(status.last_checked_at), { addSuffix: true })}` : " · not checked yet"}
                    </div>
                    {status.last_error && <div className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="w-4 h-4 mt-0.5" />{status.last_error}</div>}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={connect} disabled={busy}>Reconnect</Button>
                      {isAdmin && <Button variant="ghost" className="text-destructive" onClick={disconnect} disabled={busy}>Disconnect</Button>}
                    </div>
                  </div>
                ) : (
                  <Button onClick={connect} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Connect Gmail inbox</Button>
                )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>Read-only: Connect can read new emails but can never send, delete or move anything in the inbox. Sign in as the inbox you want to connect (e.g. catering@). Only one inbox is connected at a time.</span>
      </div>
    </div>
  );
}
