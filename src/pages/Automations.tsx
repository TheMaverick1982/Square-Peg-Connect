import { storeClock, tzForLocation, tzLabel } from "@/lib/tz";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Zap, Mail, Calendar, CheckCircle2, RefreshCw, Plus, Edit2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AutomationLog {
  id: string;
  event_type: string;
  event_id: string;
  nurture_stage: string;
  recipient_email: string;
  sent_at: string;
}

interface NurtureTemplate {
  id: string;
  name: string;
  event_type: string;
  days_after: number;
  subject: string;
  body_html: string;
  is_active: boolean;
}

export default function Automations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"logs" | "builder">("builder");
  
  // Builder states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<NurtureTemplate> | null>(null);

  const { data: logs = [], isLoading: loadingLogs, refetch, isFetching } = useQuery({
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

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['nurture_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nurture_templates')
        .select('*')
        .order('days_after', { ascending: true });
      
      if (error) throw error;
      return data as NurtureTemplate[];
    }
  });

  const saveTemplate = useMutation({
    mutationFn: async (template: Partial<NurtureTemplate>) => {
      if (template.id) {
        const { error } = await supabase
          .from('nurture_templates')
          .update({
            name: template.name,
            event_type: template.event_type,
            days_after: template.days_after,
            subject: template.subject,
            body_html: template.body_html,
            is_active: template.is_active
          })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('nurture_templates')
          .insert([template]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurture_templates'] });
      toast({ title: "Template Saved", description: "Your nurture sequence has been updated." });
      setIsSheetOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleTemplateStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const { error } = await supabase
        .from('nurture_templates')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurture_templates'] });
    }
  });

  const sendTestEmail = useMutation({
    mutationFn: async ({ email, subject, body_html }: { email: string, subject: string, body_html: string }) => {
      const { data, error } = await supabase.functions.invoke('send-test-nurture-email', {
        body: { toEmail: email, subject, bodyHtml: body_html }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Test Email Sent", description: "Check your inbox for the preview." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send test", description: err.message, variant: "destructive" });
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    saveTemplate.mutate(editingTemplate);
  };

  const openNewTemplate = () => {
    setEditingTemplate({
      name: "",
      event_type: "all",
      days_after: 7,
      subject: "",
      body_html: "<p>Hi [Name],</p>\n\n<p>Your message here.</p>\n\n<p>- The Square Peg Team</p>",
      is_active: true
    });
    setIsSheetOpen(true);
  };

  const getStageLabel = (logStageId: string) => {
    const tmpl = templates.find(t => t.id === logStageId);
    if (tmpl) return tmpl.name;
    // Fallbacks for older logs if they existed before migration
    switch(logStageId) {
      case 'day_after': return "Day After (Thank You)";
      case '30_days': return "30 Days (Check-in)";
      case '6_months': return "6 Months (Half-year)";
      case '11_months': return "11 Months (Annual Rebook)";
      default: return "Automated Email";
    }
  };

  const getStageColor = (logStageId: string) => {
    // Generate a consistent color based on string length or just use default
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
  };

  return (
    <div className="flex flex-col space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nurture Automations</h1>
          <p className="text-muted-foreground mt-1">Manage and track automated follow-ups sent to past events.</p>
        </div>
        <div className="flex bg-muted/50 p-1 rounded-lg border">
          <button 
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'builder' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Sequence Builder
          </button>
          <button 
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'logs' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Activity Logs
          </button>
        </div>
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
            {templates.filter(t => t.is_active).length > 0 ? (
              templates.filter(t => t.is_active).map(t => (
                <span key={t.id} className="text-xs px-2 py-1 rounded bg-muted border font-medium">{t.name} ({t.days_after}d)</span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">No active sequences.</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl flex flex-col">
        {activeTab === "builder" ? (
          <>
            <div className="px-6 py-4 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Email Sequence Builder</h3>
              <Button size="sm" className="gap-2" onClick={openNewTemplate}>
                <Plus className="w-4 h-4" />
                New Sequence
              </Button>
            </div>
            <div className="p-6">
              {loadingTemplates ? (
                <div className="flex justify-center items-center h-32 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-6 max-w-5xl mx-auto">
                  {Object.entries({
                    "Catering": templates.filter(t => t.event_type === "Catering Event"),
                    "Large Reservations": templates.filter(t => t.event_type === "Large Reservation"),
                    "Tuesday Fundraisers": templates.filter(t => t.event_type === "Tuesday Fundraiser"),
                    "Global (All Events)": templates.filter(t => t.event_type === "all"),
                  }).map(([groupName, groupTemplates]) => {
                    if (groupTemplates.length === 0) return null;
                    return (
                      <div key={groupName} className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">{groupName} Sequences</h4>
                        <div className="grid gap-3">
                          {groupTemplates.map(template => (
                            <div key={template.id} className={`border rounded-lg p-5 transition-colors ${template.is_active ? 'bg-card' : 'bg-muted/30 opacity-75'}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-lg ${template.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    {template.days_after}d
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-lg">{template.name}</h4>
                                    <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-2 items-center">
                                      <span>Subject: "{template.subject}"</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground hidden sm:inline">{template.is_active ? 'Active' : 'Paused'}</span>
                                    <Switch 
                                      checked={template.is_active} 
                                      onCheckedChange={(checked) => toggleTemplateStatus.mutate({ id: template.id, is_active: checked })}
                                    />
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                      setEditingTemplate(template);
                                      setIsSheetOpen(true);
                                    }}
                                  >
                                    <Edit2 className="w-4 h-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {templates.length === 0 && (
                    <div className="text-center py-12 border border-dashed rounded-lg">
                      <p className="text-muted-foreground">No nurture templates found.</p>
                      <Button variant="link" onClick={openNewTemplate}>Create your first sequence</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-4 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Recent Sends</h3>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="">
              {loadingLogs ? (
                <div className="p-8 text-center text-muted-foreground">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <Mail className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium">No automations sent yet</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm">
                    The engine runs every morning. As soon as a completed event hits one of the milestones, the email will be sent and logged here.
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
                            <span>{format(storeClock(log.sent_at), "MMM d, yyyy 'at' h:mm a")} {tzLabel(log.sent_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTemplate?.id ? 'Edit Sequence' : 'New Sequence'}</SheetTitle>
            <SheetDescription>Configure when this email sends and what it says.</SheetDescription>
          </SheetHeader>
          {editingTemplate && (
            <form onSubmit={handleSave} className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sequence Name</Label>
                  <Input 
                    value={editingTemplate.name} 
                    onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})} 
                    placeholder="e.g. 30 Day Check-in"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Days After Event</Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={editingTemplate.days_after} 
                    onChange={(e) => setEditingTemplate({...editingTemplate, days_after: parseInt(e.target.value)})} 
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Target Event Type</Label>
                <Select 
                  value={editingTemplate.event_type} 
                  onValueChange={(val) => setEditingTemplate({...editingTemplate, event_type: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="Catering Event">Catering Only</SelectItem>
                    <SelectItem value="Large Reservation">Large Reservations Only</SelectItem>
                    <SelectItem value="Tuesday Fundraiser">Fundraisers Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email Subject Line</Label>
                <Input 
                  value={editingTemplate.subject} 
                  onChange={(e) => setEditingTemplate({...editingTemplate, subject: e.target.value})} 
                  placeholder="Checking in from Square Peg Pizzeria"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Email Body (HTML)</Label>
                <p className="text-xs text-muted-foreground">Use <strong>[Name]</strong> to dynamically insert the guest's name.</p>
                <Textarea 
                  className="font-mono text-sm h-64"
                  value={editingTemplate.body_html} 
                  onChange={(e) => setEditingTemplate({...editingTemplate, body_html: e.target.value})} 
                  required
                />
              </div>

              <div className="flex items-center justify-between border p-4 rounded-lg bg-muted/20">
                <div>
                  <h4 className="font-semibold text-sm">Sequence Active</h4>
                  <p className="text-xs text-muted-foreground">If disabled, this email will not be sent during the daily run.</p>
                </div>
                <Switch 
                  checked={editingTemplate.is_active} 
                  onCheckedChange={(checked) => setEditingTemplate({...editingTemplate, is_active: checked})}
                />
              </div>

              <div className="border border-dashed p-4 rounded-lg flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
                <div className="w-full">
                  <Label>Send Test Preview</Label>
                  <p className="text-xs text-muted-foreground mb-2">Send this draft to yourself to see how it looks.</p>
                  <div className="flex gap-2">
                    <Input 
                      type="email" 
                      id="testEmail" 
                      placeholder="your@email.com" 
                      className="max-w-[250px]"
                    />
                    <Button 
                      type="button" 
                      variant="secondary"
                      disabled={sendTestEmail.isPending}
                      onClick={() => {
                        const emailInput = document.getElementById('testEmail') as HTMLInputElement;
                        if (!emailInput.value) {
                          toast({ title: "Email required", description: "Please enter an email address for the test.", variant: "destructive" });
                          return;
                        }
                        sendTestEmail.mutate({
                          email: emailInput.value,
                          subject: editingTemplate.subject || "No Subject",
                          body_html: editingTemplate.body_html || ""
                        });
                      }}
                    >
                      {sendTestEmail.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                      Send Test
                    </Button>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <SheetClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </SheetClose>
                <Button type="submit" disabled={saveTemplate.isPending}>
                  {saveTemplate.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Sequence
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
