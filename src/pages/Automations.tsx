import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Zap, Mail, Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AutomationLog {
  id: string;
  event_type: string;
  event_id: string;
  nurture_stage: string;
  recipient_email: string;
  sent_at: string;
}

export default function Automations() {
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['automation_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as AutomationLog[];
    }
  });

  const getStageLabel = (stage: string) => {
    switch(stage) {
      case 'day_after': return "Day After (Thank You)";
      case '30_days': return "30 Days (Check-in)";
      case '6_months': return "6 Months (Half-year)";
      case '11_months': return "11 Months (Annual Rebook)";
      default: return stage;
    }
  };

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'day_after': return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400";
      case '30_days': return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
      case '6_months': return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400";
      case '11_months': return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nurture Automations</h1>
          <p className="text-muted-foreground mt-1">Live tracking of automated follow-ups sent to past events.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Logs
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-xl border flex flex-col gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Engine Status</span>
          <span className="text-2xl font-bold text-green-600 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            Active
          </span>
          <span className="text-xs text-muted-foreground mt-1">Runs daily at 9:00 AM</span>
        </div>
        
        <div className="bg-card p-6 rounded-xl border flex flex-col gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Mail className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Total Emails Sent</span>
          <span className="text-2xl font-bold">{logs.length}</span>
          <span className="text-xs text-muted-foreground mt-1">Lifetime automated emails</span>
        </div>

        <div className="bg-card p-6 rounded-xl border flex flex-col gap-2 md:col-span-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Active Sequences</span>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs px-2 py-1 rounded bg-muted border font-medium">Day After</span>
            <span className="text-xs px-2 py-1 rounded bg-muted border font-medium">30 Days</span>
            <span className="text-xs px-2 py-1 rounded bg-muted border font-medium">6 Months</span>
            <span className="text-xs px-2 py-1 rounded bg-muted border font-medium">11 Months (Rebook)</span>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/20">
          <h3 className="font-semibold text-lg">Recent Sends</h3>
        </div>
        
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Mail className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No automations sent yet</h3>
              <p className="text-muted-foreground mt-2 max-w-sm">
                The engine runs every morning. As soon as a completed event hits one of the milestones (day after, 30 days, 6 months, 11 months), the email will be sent and logged here.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {log.recipient_email}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStageColor(log.nurture_stage)}`}>
                          {getStageLabel(log.nurture_stage)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{log.event_type}</span>
                        <span>•</span>
                        <span>{format(new Date(log.sent_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}