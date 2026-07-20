import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Mail, Loader2, Clock, CheckCircle2 } from "lucide-react";

interface EmailLog {
  id: string;
  created_at: string;
  nurture_stage: string;
  recipient_email: string;
  template_subject?: string;
  template_days?: number;
}

export function EmailLogs({ eventId, eventType }: { eventId: string, eventType: string }) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      if (!eventId) return;
      
      setIsLoading(true);
      
      // Fetch logs for this event
      const { data: logsData, error: logsError } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('event_id', eventId)
        .eq('event_type', eventType)
        .order('created_at', { ascending: false });
        
      if (logsError || !logsData) {
        setIsLoading(false);
        return;
      }
      
      // Fetch the templates to enrich the logs with subject lines
      const { data: templates } = await supabase
        .from('nurture_templates')
        .select('id, subject, days_after');
        
      const templateMap = new Map();
      if (templates) {
        templates.forEach(t => templateMap.set(t.id, t));
      }
      
      const enrichedLogs = logsData.map(log => ({
        ...log,
        template_subject: templateMap.get(log.nurture_stage)?.subject || 'Automated Email',
        template_days: templateMap.get(log.nurture_stage)?.days_after || 0,
      }));
      
      setLogs(enrichedLogs);
      setIsLoading(false);
    }
    
    fetchLogs();
  }, [eventId, eventType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading email history...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-6 bg-muted/20 border border-dashed rounded-lg">
        <Mail className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground font-medium">No automated emails sent yet</p>
        <p className="text-xs text-muted-foreground mt-1">Automations will appear here once triggered.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 items-start p-3 bg-card border rounded-lg shadow-sm">
          <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground truncate">
                Day {log.template_days} Nurture
              </span>
              <span className="text-xs text-muted-foreground flex items-center shrink-0">
                <Clock className="w-3 h-3 mr-1" />
                {format(new Date(log.created_at), "MMM d, h:mm a")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mb-1">
              <span className="font-medium text-foreground mr-1">Subject:</span>
              {log.template_subject}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span>Sent to {log.recipient_email}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}