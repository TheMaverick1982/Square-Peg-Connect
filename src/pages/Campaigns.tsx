import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useEmployee } from "@/lib/EmployeeContext";
import { notifyMarketing, alertMarketingRequest } from "@/lib/notify";
import { CAMPAIGN_TEMPLATES, eventsForYear, upcomingEvents, templateDueDate, isTaskOverdue, daysUntil, campaignRisk } from "@/lib/marketing";
import { CampaignCard, dateRangeLabel } from "@/components/marketing/CampaignCard";
import { CampaignDetailsSheet } from "@/components/marketing/CampaignDetailsSheet";
import { TeamMemberSelect, memberLabel, useTeamMembers } from "@/components/marketing/TeamMemberSelect";
import { AlertSettingsButton } from "@/components/AlertRecipientsButton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, addDays, parseISO, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths } from "date-fns";
import { CalendarDays, AlertTriangle, Plus, CheckSquare, Megaphone, Share2, Mail, LayoutList, CalendarIcon, Loader2, CheckCircle2, UserCircle2, MapPin, Sparkles, ChevronLeft, ChevronRight, Briefcase, Store, XCircle, FileText, Download, Edit2, Trash2, ExternalLink, Image as ImageIcon, Link as LinkIcon, ClipboardList, Archive, ArchiveRestore, History } from "lucide-react";

function CustomPromptsManager() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPrompt, setNewPrompt] = useState({ name: "", month: "0", day: "1" });

  const { data: customPrompts = [], isLoading } = useQuery({
    queryKey: ['custom_seasonal_prompts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_seasonal_prompts').select('*').order('month').order('day');
      if (error) throw error;
      return data;
    }
  });

  const addPrompt = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('custom_seasonal_prompts').insert({
        name: newPrompt.name,
        month: parseInt(newPrompt.month, 10),
        day: parseInt(newPrompt.day, 10)
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_seasonal_prompts'] });
      setNewPrompt({ name: "", month: "0", day: "1" });
      toast({ title: "Custom Prompt Added" });
    }
  });

  const deletePrompt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_seasonal_prompts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_seasonal_prompts'] });
      toast({ title: "Prompt deleted" });
    }
  });

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarIcon className="w-4 h-4 mr-2" /> Manage Prompts
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Custom Seasonal Prompts</SheetTitle>
          <SheetDescription>Add your own recurring local events (like town fairs or anniversaries) to appear on the planning calendar year after year.</SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6">
          <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
            <h4 className="font-medium text-sm">Add New Prompt</h4>
            <div>
              <Label>Event Name</Label>
              <Input placeholder="e.g. Glastonbury Apple Fest" value={newPrompt.name} onChange={e => setNewPrompt(f => ({...f, name: e.target.value}))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month</Label>
                <Select value={newPrompt.month} onValueChange={v => setNewPrompt(f => ({...f, month: v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day</Label>
                <Input type="number" min="1" max="31" value={newPrompt.day} onChange={e => setNewPrompt(f => ({...f, day: e.target.value}))} className="mt-1" />
              </div>
            </div>
            <Button className="w-full" onClick={() => addPrompt.mutate()} disabled={!newPrompt.name || addPrompt.isPending}>
              Add Custom Prompt
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Your Custom Prompts</h4>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
            ) : customPrompts.length === 0 ? (
              <div className="text-sm text-muted-foreground italic text-center py-4 border rounded bg-muted/10">No custom prompts added yet.</div>
            ) : (
              customPrompts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded bg-card">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{months[p.month]} {p.day}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deletePrompt.mutate(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const blankCampaign = () => ({
  title: "", description: "", target_date: new Date(), end_date: "", location_id: "all", template: "none", owner: "",
});

function MarketingSupportRequestSheet() {
  const [open, setOpen] = useState(false);
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: "",
    target_date: new Date(),
    location_id: selectedLocationId || "",
    description: "",
    support_needed: "",
    external_links: ""
  });

  const submitRequest = useMutation({
    mutationFn: async (data: typeof formData) => {
      // 1. Create a Draft Campaign on the Horizon planner
      const campaignPayload = {
        title: `Support: ${data.title}`,
        description: `Marketing Support Request.\nNeeds: ${data.support_needed}\nLinks: ${data.external_links}\nNotes: ${data.description}`,
        target_date: format(data.target_date, 'yyyy-MM-dd'),
        location_id: data.location_id === "all" ? null : data.location_id,
        status: 'planning', // Puts it on the dashboard
      };

      const { data: campaign, error: campaignError } = await supabase
        .from('marketing_campaigns')
        .insert(campaignPayload)
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 2. Also log it to the structured requests table just for records if we want, or just rely on campaigns.
      const requestPayload = {
        event_name: data.title,
        event_date: format(data.target_date, 'yyyy-MM-dd'),
        location_id: data.location_id === "all" ? null : data.location_id,
        support_needed: data.support_needed,
        external_links: data.external_links,
        notes: data.description,
        status: 'Draft'
      };

      const { error: requestError, data: supportRequest } = await supabase
        .from('marketing_support_requests')
        .insert(requestPayload)
        .select()
        .single();
        
      if (requestError) throw requestError;

      // 3. Email the marketing inbox (recipients set under Email alerts)
      void supportRequest;
      await alertMarketingRequest(data.title);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      setOpen(false);
      setFormData({
        title: "",
        target_date: new Date(),
        location_id: selectedLocationId || "",
        description: "",
        support_needed: "",
        external_links: ""
      });
      toast({ title: "Request Submitted!", description: "The marketing team has been notified." });
    },
    onError: (error: any) => {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="shrink-0"><Briefcase className="w-4 h-4 mr-2" /> Request Support</Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Request Marketing Support</SheetTitle>
          <SheetDescription>Submit an upcoming event or promotion that needs marketing team support.</SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 pb-20">
          <div>
            <Label>Event / Promotion Name <span className="text-destructive">*</span></Label>
            <Input 
              placeholder="e.g. Local Brewery Tap Takeover" 
              value={formData.title}
              onChange={e => setFormData(f => ({...f, title: e.target.value}))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Location <span className="text-destructive">*</span></Label>
            <Select value={formData.location_id} onValueChange={v => setFormData(f => ({...f, location_id: v}))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations (Global Promo)</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Event Date <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.target_date ? format(formData.target_date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent mode="single" selected={formData.target_date} onSelect={d => d && setFormData(f => ({...f, target_date: d}))} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>What specific support do you need? <span className="text-destructive">*</span></Label>
            <Textarea 
              placeholder="e.g. Need an Instagram flyer, an email blast to our list, and table tents designed." 
              value={formData.support_needed}
              onChange={e => setFormData(f => ({...f, support_needed: e.target.value}))}
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label>External Links (Optional)</Label>
            <Input 
              placeholder="Links to partner websites, menus, or inspiration..." 
              value={formData.external_links}
              onChange={e => setFormData(f => ({...f, external_links: e.target.value}))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Additional Context</Label>
            <Textarea 
              placeholder="Any other details the marketing team should know..." 
              value={formData.description}
              onChange={e => setFormData(f => ({...f, description: e.target.value}))}
              className="mt-1 min-h-[80px]"
            />
          </div>

          <Button 
            className="w-full mt-4" 
            onClick={() => submitRequest.mutate(formData)}
            disabled={!formData.title || !formData.location_id || !formData.support_needed || submitRequest.isPending}
          >
            {submitRequest.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting Request...</>
            ) : (
              "Submit Request to Marketing"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function MarketingPlanner() {
  const { selectedLocationId } = useLocationContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("planning");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showArchived, setShowArchived] = useState(false);
  // When planning from a seasonal prompt, the campaign we're repeating from last year (tasks get copied).
  const [copyFrom, setCopyFrom] = useState<any | null>(null);
  const [copyTasks, setCopyTasks] = useState(true);

  const { data: customPrompts = [] } = useQuery({
    queryKey: ['custom_seasonal_prompts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_seasonal_prompts').select('*');
      if (error) throw error;
      return data;
    }
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['marketing_campaigns', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('marketing_campaigns').select('*').order('target_date', { ascending: true });
      if (selectedLocationId) {
        query = query.or(`location_id.eq.${selectedLocationId},location_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['marketing_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketing_tasks').select('*');
      if (error) throw error;
      return data;
    }
  });

  // Fetch social posts
  const { data: socialPosts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ['social_posts', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('social_posts').select('*').order('target_date', { ascending: true });
      if (selectedLocationId) {
        query = query.or(`location_id.eq.${selectedLocationId},location_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // --- Campaign Mutations ---
  const [isDraftingCampaign, setIsDraftingCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState(blankCampaign());
  const { profile } = useEmployee();
  const myEmail = (profile?.email || "").trim().toLowerCase();
  const { data: members } = useTeamMembers();
  const [detailsCampaign, setDetailsCampaign] = useState<any | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  const createCampaign = useMutation({
    mutationFn: async () => {
      const startYmd = format(newCampaign.target_date, 'yyyy-MM-dd');
      const payload: Record<string, unknown> = {
        title: newCampaign.title,
        description: newCampaign.description,
        target_date: startYmd,
        location_id: newCampaign.location_id === "all" ? null : newCampaign.location_id,
        status: 'planning'
      };
      if (newCampaign.end_date && newCampaign.end_date > startYmd) payload.end_date = newCampaign.end_date;
      const { data: created, error } = await supabase.from('marketing_campaigns').insert(payload).select().single();
      if (error) throw error;
      // Template: ready-made task list, due dates counted back from the event.
      const template = CAMPAIGN_TEMPLATES.find((t) => t.id === newCampaign.template);
      if (template && created && !(copyFrom && copyTasks)) {
        const owner = newCampaign.owner || myEmail;
        const { error: tplErr } = await supabase.from('marketing_tasks').insert(template.tasks.map((t) => ({
          campaign_id: created.id, title: t.title, assigned_to: owner,
          due_date: templateDueDate(newCampaign.target_date, t.daysBefore), is_completed: false,
        })));
        if (tplErr) throw tplErr;
      }
      // Repeating last year's campaign: copy its tasks, moving due dates forward by the same gap.
      if (copyFrom && copyTasks && created) {
        const shift = differenceInDays(newCampaign.target_date, parseISO(copyFrom.target_date));
        const oldTasks = tasks.filter((t: any) => t.campaign_id === copyFrom.id);
        if (oldTasks.length) {
          const { error: taskErr } = await supabase.from('marketing_tasks').insert(oldTasks.map((t: any) => ({
            campaign_id: created.id,
            title: t.title,
            assigned_to: t.assigned_to,
            due_date: format(addDays(parseISO(t.due_date), shift), 'yyyy-MM-dd'),
            is_completed: false,
          })));
          if (taskErr) throw taskErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['marketing_tasks'] });
      setCopyFrom(null);
      setIsDraftingCampaign(false);
      setNewCampaign(blankCampaign());
      toast({ title: "Campaign created!" });
    },
    onError: (e) => toast({ title: "Couldn't create campaign", description: (e as Error).message, variant: "destructive" }),
  });

  const updateCampaignDetails = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { error } = await supabase.from('marketing_campaigns').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      toast({ title: "Campaign details updated!" });
    }
  });

  const archiveCampaign = useMutation({
    mutationFn: async ({ campaign, archive, remember, recap }: { campaign: any; archive: boolean; remember?: boolean; recap?: { worked: string; improve: string; results: string } }) => {
      const updates: Record<string, unknown> = { archived_at: archive ? new Date().toISOString() : null };
      if (archive && recap && (recap.worked.trim() || recap.improve.trim() || recap.results.trim())) {
        updates.recap_worked = recap.worked.trim() || null;
        updates.recap_improve = recap.improve.trim() || null;
        updates.recap_results = recap.results.trim() || null;
      }
      const { error } = await supabase.from('marketing_campaigns').update(updates).eq('id', campaign.id);
      if (error) throw error;
      if (archive && remember) {
        const d = parseISO(campaign.target_date);
        const already = customPrompts.some((p: any) => p.source_campaign_id === campaign.id ||
          (String(p.name).toLowerCase() === String(campaign.title).toLowerCase() && p.month === d.getMonth()));
        if (!already) {
          const { error: pErr } = await supabase.from('custom_seasonal_prompts').insert({
            name: campaign.title, month: d.getMonth(), day: d.getDate(),
            notes: campaign.description || null, source_campaign_id: campaign.id,
          });
          if (pErr) throw pErr;
        }
      }
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['custom_seasonal_prompts'] });
      toast({
        title: v.archive ? "Campaign archived" : "Campaign restored",
        description: v.archive && v.remember ? "It'll show up in Seasonal Prompts next year." : undefined,
      });
    },
    onError: (e) => toast({ title: "Couldn't update campaign", description: (e as Error).message, variant: "destructive" }),
  });

  // Find what we did for this occasion last time (for Seasonal Prompts).
  const findLastTime = (prompt: any) => {
    const target = prompt.date as Date;
    const name = String(prompt.name).toLowerCase();
    const cutoff = addDays(target, -180);
    const candidates = campaigns.filter((c: any) => {
      const d = parseISO(c.target_date);
      if (d >= cutoff) return false; // must be from a previous season
      if (prompt.source_campaign_id && c.id === prompt.source_campaign_id) return true;
      if (String(c.title).toLowerCase().includes(name.replace(/ promo$/, ''))) return true;
      const lastYear = new Date(target.getFullYear() - 1, target.getMonth(), target.getDate());
      return Math.abs(differenceInDays(d, lastYear)) <= 14 && String(c.title).toLowerCase().includes(name.split(/[\s(']/)[0]);
    });
    return candidates.sort((a: any, b: any) => b.target_date.localeCompare(a.target_date))[0] || null;
  };

  const planFromPrompt = (prompt: any) => {
    const lastTime = findLastTime(prompt);
    setCopyFrom(lastTime);
    setCopyTasks(true);
    setNewCampaign({
      ...blankCampaign(),
      title: lastTime ? lastTime.title : `${prompt.name} Promo`,
      description: lastTime?.description || prompt.notes || "",
      target_date: prompt.date,
      location_id: lastTime?.location_id || "all",
      template: lastTime ? "none" : "holiday",
    });
    setIsDraftingCampaign(true);
  };

  // --- Task Mutations ---
  const createTask = useMutation({
    mutationFn: async ({ campaign_id, title, assigned_to, due_date }: { campaign_id: string, title: string, assigned_to: string, due_date: string | Date }) => {
      const due = typeof due_date === 'string' ? due_date : format(due_date, 'yyyy-MM-dd');
      const payload = { campaign_id, title, assigned_to, due_date: due };
      const { error } = await supabase.from('marketing_tasks').insert(payload);
      if (error) throw error;
      if (assigned_to && assigned_to !== myEmail) {
        const camp = campaigns.find((c: any) => c.id === campaign_id);
        await notifyMarketing({ type: 'task_assigned', to: assigned_to, taskTitle: title, campaignTitle: camp?.title || '', dueDate: due });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_tasks'] });
      toast({ title: "Task added" });
    },
    onError: (e) => toast({ title: "Couldn't add task", description: (e as Error).message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ task, updates, campaignTitle }: { task: any; updates: { title: string; assigned_to: string; due_date: string }; campaignTitle?: string }) => {
      const { error } = await supabase.from('marketing_tasks').update(updates).eq('id', task.id);
      if (error) throw error;
      // New owner? Let them know.
      if (updates.assigned_to && updates.assigned_to !== (task.assigned_to || '') && updates.assigned_to !== myEmail) {
        await notifyMarketing({ type: 'task_assigned', to: updates.assigned_to, taskTitle: updates.title, campaignTitle: campaignTitle || '', dueDate: updates.due_date });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['marketing_tasks'] }); toast({ title: "Task updated" }); },
    onError: (e) => toast({ title: "Couldn't update task", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['marketing_tasks'] }); toast({ title: "Task deleted" }); },
    onError: (e) => toast({ title: "Couldn't delete task", description: (e as Error).message, variant: "destructive" }),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ task_id, is_completed }: { task_id: string, is_completed: boolean }) => {
      const { error } = await supabase.from('marketing_tasks').update({ is_completed }).eq('id', task_id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing_tasks'] })
  });

  // --- Social Post Mutations ---
  const [isRequestingPost, setIsRequestingPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", assigned_to: "", target_date: new Date(), location_id: "all", media_url: "", platform: "", format: "" });
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `approvals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('social-media-posts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('social-media-posts')
        .getPublicUrl(filePath);

      setNewPost(prev => ({ ...prev, media_url: data.publicUrl }));
      toast({ title: "Media uploaded successfully" });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const createSocialPost = useMutation({
    mutationFn: async () => {
      const payload = {
        title: newPost.title,
        content: newPost.content,
        assigned_to: newPost.assigned_to || myEmail,
        target_date: format(newPost.target_date, 'yyyy-MM-dd'),
        location_id: newPost.location_id === "all" ? null : newPost.location_id,
        media_url: newPost.media_url,
        platform: newPost.platform,
        format: newPost.format,
        status: 'draft'
      };
      const { data, error } = await supabase.from('social_posts').insert(payload).select().single();
      if (error) throw error;

      // Notify social media manager (or admin if submitted by social team)
      await notifyMarketing({ type: 'social_post', action: 'requested', post: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social_posts'] });
      setIsRequestingPost(false);
      setNewPost({ title: "", content: "", assigned_to: "", target_date: new Date(), location_id: "all", media_url: "", platform: "", format: "" });
      toast({ title: "Social post submitted for approval!" });
    }
  });

  const updatePostStatus = useMutation({
    mutationFn: async ({ post_id, status, post, feedback }: { post_id: string, status: string, post: any, feedback?: string }) => {
      const updates: any = { status };
      if (feedback) updates.feedback_notes = feedback;
      
      const { error } = await supabase.from('social_posts').update(updates).eq('id', post_id);
      if (error) throw error;
      
      // Notify on approval, review request, or changes needed
      if (['approved', 'needs_approval', 'changes_needed'].includes(status)) {
         await notifyMarketing({ type: 'social_post', action: status, post: { ...post, ...updates }, feedback });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social_posts'] });
      toast({ title: "Status updated" });
    }
  });


  // Helpers
  const today = new Date();
  const getHorizonStatus = (dateStr: string) => {
    const target = parseISO(dateStr);
    const diff = differenceInDays(target, today);
    if (diff < 0) return { label: 'Passed', color: 'bg-muted text-muted-foreground' };
    if (diff <= 30) return { label: 'Approaching Fast', color: 'bg-red-100 text-red-800 border-red-200' };
    if (diff <= 90) return { label: '90-Day Window', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Future Planning', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  const upcomingPrompts = upcomingEvents(customPrompts, 6);

  const activeCampaignIds = new Set(campaigns.filter((c: any) => !c.archived_at).map((c: any) => c.id));
  const openTasks = tasks
    .filter((t: any) => !t.is_completed && activeCampaignIds.has(t.campaign_id))
    .filter((t: any) => showAllTasks || (t.assigned_to || "").trim().toLowerCase() === myEmail)
    .sort((a: any, b: any) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")));
  const overdueCount = openTasks.filter(isTaskOverdue).length;
  const campaignRiskLevel = (c: any) => campaignRisk(c, tasks.filter((t: any) => t.campaign_id === c.id))?.level ?? "ok";

  const sendMyDigest = async () => {
    setSendingDigest(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/marketing-digest", { method: "POST", headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
      toast(out.empty
        ? { title: "Nothing to send", description: "You have no overdue tasks or tasks due in the next 7 days." }
        : { title: "Digest sent", description: `Check ${myEmail}.` });
    } catch (e) {
      toast({ title: "Couldn't send digest", description: (e as Error).message, variant: "destructive" });
    } finally { setSendingDigest(false); }
  };

  const renderCalendar = (campaignList: any[]) => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex flex-col h-[600px] bg-card border rounded-lg overflow-hidden mt-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="py-2 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const dayYmd = format(day, "yyyy-MM-dd");
            // A campaign shows on every day from its start to its end date.
            const dayCampaigns = campaignList.filter(c => dayYmd >= c.target_date && dayYmd <= (c.end_date && c.end_date > c.target_date ? c.end_date : c.target_date));
            // Seasonal prompts for whichever month is on screen (not just the next few).
            const dayPrompt = eventsForYear(day.getFullYear(), customPrompts).find(p => isSameDay(p.date, day));
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toString()} 
                className={`
                  min-h-[100px] p-2 border-r border-b relative
                  ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : ""}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""}`}>{format(day, "d")}</span>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  {dayCampaigns.map(camp => (
                    <div 
                      key={camp.id}
                      className={`text-xs px-1.5 py-1 rounded border font-medium truncate cursor-pointer ${campaignRiskLevel(camp) === "risk" ? "bg-red-600 text-white border-red-600 hover:bg-red-700" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"}`}
                      title={`${camp.title} · ${dateRangeLabel(camp)} · click to open`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailsCampaign(camp)}
                      onKeyDown={(e) => { if (e.key === "Enter") setDetailsCampaign(camp); }}
                    >
                      {dayYmd === camp.target_date || day.getDay() === 0 ? camp.title : "\u00A0"}
                    </div>
                  ))}
                  
                  {dayPrompt && dayCampaigns.length === 0 && (
                    <div 
                      className="text-[10px] px-1.5 py-1 rounded border border-dashed font-medium truncate bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted/50 hover:text-foreground transition-colors"
                      title={`Suggested: ${dayPrompt.name}`}
                      onClick={() => planFromPrompt(dayPrompt)}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1 opacity-50" />
                      {dayPrompt.name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCampaignsView = (allCampaigns: any[]) => {
    const archivedList = allCampaigns.filter((c: any) => c.archived_at);
    const activeList = allCampaigns.filter((c: any) => !c.archived_at);
    const campaignList = showArchived ? [...archivedList].reverse() : activeList;
    return (
      <div className="space-y-4 m-0">
        <div className="flex items-center justify-end gap-2 mb-2">
          <Button variant={showArchived ? "secondary" : "ghost"} size="sm" className="h-8 px-3"
            onClick={() => setShowArchived((v) => !v)}>
            <Archive className="w-4 h-4 mr-2" /> {showArchived ? "Back to active" : `Archived (${archivedList.length})`}
          </Button>
          <div className="flex items-center bg-muted p-1 rounded-lg">
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 px-3"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="w-4 h-4 mr-2" /> List
            </Button>
            <Button 
              variant={viewMode === "calendar" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 px-3"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarIcon className="w-4 h-4 mr-2" /> Calendar
            </Button>
          </div>
        </div>

        {viewMode === "calendar" && !showArchived ? (
           renderCalendar(campaignList)
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-card p-4 rounded-lg border shadow-sm mb-4 gap-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Upcoming Horizons
                  </h3>
                  <p className="text-sm text-muted-foreground">Campaigns entering the 90-day critical planning window.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CustomPromptsManager />
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL}public/marketing-request`);
                    toast({ title: "Link Copied!", description: "Intake form URL copied to clipboard." });
                  }}>
                    <LinkIcon className="w-4 h-4 mr-2" /> Share Intake Form
                  </Button>
                  <Sheet open={isDraftingCampaign} onOpenChange={setIsDraftingCampaign}>
                    <SheetTrigger asChild>
                      <Button size="sm" onClick={() => { setCopyFrom(null); setNewCampaign({ ...blankCampaign(), title: "", description: "", target_date: new Date(), location_id: "all" }); }}>
                        <Plus className="w-4 h-4 mr-2" /> Plan Campaign
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader className="mb-6">
                        <SheetTitle>Plan New Campaign</SheetTitle>
                        <SheetDescription>Set a target date to begin tracking this campaign's horizon.</SheetDescription>
                      </SheetHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Campaign Title</Label>
                          <Input placeholder="e.g. Thanksgiving Catering, Super Bowl" value={newCampaign.title} onChange={e => setNewCampaign({...newCampaign, title: e.target.value})} className="mt-1" />
                        </div>
                        <div>
                          <Label>Location</Label>
                          <Select value={newCampaign.location_id} onValueChange={v => setNewCampaign({...newCampaign, location_id: v})}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Locations</SelectItem>
                              {locations.map(l => (
                                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {!copyFrom && (
                          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                            <Label>Start from a template</Label>
                            <Select value={newCampaign.template} onValueChange={v => setNewCampaign({...newCampaign, template: v})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No template (blank)</SelectItem>
                                {CAMPAIGN_TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.name} · {t.tasks.length} tasks</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {newCampaign.template !== "none" && (() => {
                              const tpl = CAMPAIGN_TEMPLATES.find(t => t.id === newCampaign.template)!;
                              return (
                                <>
                                  <p className="text-xs text-muted-foreground">{tpl.description} Due dates count back from the start date.</p>
                                  <ul className="text-xs space-y-0.5 max-h-36 overflow-y-auto pr-1">
                                    {tpl.tasks.map(t => (
                                      <li key={t.title} className="flex justify-between gap-2">
                                        <span className="truncate">{t.title}</span>
                                        <span className="text-muted-foreground shrink-0 tabular-nums">{format(parseISO(templateDueDate(newCampaign.target_date, t.daysBefore)), "MMM d")}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <div>
                                    <Label className="text-xs">Assign these tasks to</Label>
                                    <TeamMemberSelect value={newCampaign.owner || myEmail} onChange={v => setNewCampaign({...newCampaign, owner: v})} allowNone={false} className="mt-1" />
                                    <p className="text-[11px] text-muted-foreground mt-1">You can reassign individual tasks afterward.</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <div>
                          <Label>Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newCampaign.target_date ? format(newCampaign.target_date, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent mode="single" selected={newCampaign.target_date} onSelect={d => d && setNewCampaign({...newCampaign, target_date: d})} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>End Date <span className="text-muted-foreground font-normal">(optional, for multi-day promos)</span></Label>
                          <Input type="date" className="mt-1" min={format(newCampaign.target_date, "yyyy-MM-dd")}
                            value={newCampaign.end_date} onChange={e => setNewCampaign({...newCampaign, end_date: e.target.value})} />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea placeholder="High level goals for this season..." value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} className="mt-1" />
                        </div>
                        {copyFrom && (
                          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                            <div className="flex items-center gap-2 font-medium"><History className="w-4 h-4" /> Repeating last year's campaign</div>
                            <div className="text-xs text-muted-foreground">
                              {copyFrom.title} · {format(parseISO(copyFrom.target_date), "MMM d, yyyy")}
                            </div>
                            {(copyFrom.recap_results || copyFrom.recap_worked || copyFrom.recap_improve) && (
                              <div className="text-xs space-y-1 border-t pt-2">
                                <div className="font-medium">Last year's recap</div>
                                {copyFrom.recap_results && <div><span className="text-muted-foreground">Results: </span>{copyFrom.recap_results}</div>}
                                {copyFrom.recap_worked && <div><span className="text-muted-foreground">What worked: </span>{copyFrom.recap_worked}</div>}
                                {copyFrom.recap_improve && <div><span className="text-muted-foreground">Do differently: </span>{copyFrom.recap_improve}</div>}
                              </div>
                            )}
                            {tasks.filter((t: any) => t.campaign_id === copyFrom.id).length > 0 && (
                              <label className="flex items-center gap-2 text-xs">
                                <Checkbox checked={copyTasks} onCheckedChange={(v) => setCopyTasks(!!v)} />
                                Copy its {tasks.filter((t: any) => t.campaign_id === copyFrom.id).length === 1 ? "1 task" : `${tasks.filter((t: any) => t.campaign_id === copyFrom.id).length} tasks`} (due dates moved forward)
                              </label>
                            )}
                          </div>
                        )}
                        <Button className="w-full mt-4" onClick={() => createCampaign.mutate()} disabled={!newCampaign.title || createCampaign.isPending}>
                          {createCampaign.isPending ? "Saving..." : "Save Campaign"}
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {loadingCampaigns ? (
                <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading campaigns...</div>
              ) : campaignList.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                  <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-medium">{showArchived ? "No archived campaigns" : "No campaigns planned"}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Start planning 3+ months ahead to never miss a holiday.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignList.map(camp => {
                    const status = getHorizonStatus(camp.target_date);
                    const campTasks = tasks.filter(t => t.campaign_id === camp.id);
                    const completedTasks = campTasks.filter(t => t.is_completed).length;
                    const progress = campTasks.length > 0 ? Math.round((completedTasks / campTasks.length) * 100) : 0;

                    return (
                      <CampaignCard 
                        key={camp.id} 
                        campaign={camp} 
                        status={status} 
                        tasks={campTasks} 
                        progress={progress} 
                        createTask={createTask} 
                        toggleTask={toggleTask}
                        updateTask={updateTask}
                        deleteTask={deleteTask}
                        updateCampaignDetails={updateCampaignDetails}
                        archiveCampaign={archiveCampaign}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Card className="bg-primary/5 border-primary/20 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Seasonal Prompts
                  </CardTitle>
                  <CardDescription className="text-xs">Upcoming events to plan for.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingPrompts.map(prompt => {
                      const lastTime = findLastTime(prompt);
                      const lastTasks = lastTime ? tasks.filter((t: any) => t.campaign_id === lastTime.id).length : 0;
                      return (
                      <div key={prompt.name} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{prompt.name}</div>
                          <div className="text-xs text-muted-foreground">{format(prompt.date, "MMM d, yyyy")}</div>
                          {lastTime && (
                            <div className="text-[11px] text-primary mt-0.5 flex items-center gap-1 truncate" title={lastTime.description || lastTime.title}>
                              <History className="w-3 h-3 shrink-0" />
                              <span className="truncate">Last time: {lastTime.title} ({format(parseISO(lastTime.target_date), "yyyy")}){lastTasks ? ` · ${lastTasks} tasks` : ""}</span>
                            </div>
                          )}
                          {!lastTime && prompt.notes && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1" title={prompt.notes}>{prompt.notes}</div>
                          )}
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-7 text-xs bg-background hover:bg-background/80"
                          onClick={() => planFromPrompt(prompt)}
                        >
                          {lastTime ? "Repeat" : "Plan"}
                        </Button>
                      </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">{showAllTasks ? "Everyone's Tasks" : "My Tasks"}{overdueCount > 0 && <Badge className="ml-2 bg-red-600 text-white hover:bg-red-600">{overdueCount} overdue</Badge>}</CardTitle>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAllTasks(v => !v)}>
                    {showAllTasks ? "Show mine" : "Show everyone's"}
                  </button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {openTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">{showAllTasks ? "No open tasks." : "Nothing assigned to you. Nice."}</p>
                    ) : (
                      openTasks.slice(0, 10).map((task: any) => {
                        const late = isTaskOverdue(task);
                        const camp = campaigns.find((c: any) => c.id === task.campaign_id);
                        return (
                          <div key={task.id} className="flex items-start gap-2 text-sm">
                            <button aria-label="Mark done" onClick={() => toggleTask.mutate({ task_id: task.id, is_completed: true })} className="mt-0.5 text-muted-foreground hover:text-primary">
                              <CheckSquare className="w-4 h-4" />
                            </button>
                            <div className="min-w-0">
                              <div className="font-medium line-clamp-1">{task.title}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {camp?.title ? `${camp.title} · ` : ""}
                                {showAllTasks ? `${memberLabel(members, task.assigned_to)} · ` : ""}
                                <span className={late ? "text-red-700 font-semibold" : ""}>
                                  {task.due_date ? (late ? `${-daysUntil(task.due_date)}d overdue` : `Due ${format(parseISO(task.due_date), "MMM d")}`) : "No due date"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {openTasks.length > 10 && <p className="text-[11px] text-muted-foreground">+ {openTasks.length - 10} more</p>}
                  </div>
                  <div className="border-t mt-4 pt-3">
                    <p className="text-[11px] text-muted-foreground mb-2">Everyone gets their open and overdue tasks by email every Monday morning.</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs w-full" disabled={sendingDigest} onClick={sendMyDigest}>
                      {sendingDigest ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Mail className="w-3 h-3 mr-1.5" />} Email me my digest now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketing & Social Planner</h1>
          <p className="text-muted-foreground mt-1">Plan campaigns 3+ months out, assign tasks, and manage social approvals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertSettingsButton
            title="Marketing email alerts"
            description="Who gets each kind of email. One email per line."
            groups={[
              { key: "marketing_requests", label: "Marketing support requests", description: "Gets an email when a store submits a support request (public form or Request Support)." },
              { key: "social_approvals", label: "Social post approvers", description: "Gets an email when a post is uploaded or sent for approval." },
              { key: "social_team", label: "Social / creative team", description: "Gets creative requests, plus approvals and change requests when a post has no named owner." },
            ]}
          />
          <MarketingSupportRequestSheet />
        </div>
      </div>

      {detailsCampaign && (
        <CampaignDetailsSheet
          hideTrigger
          campaign={campaigns.find((c: any) => c.id === detailsCampaign.id) || detailsCampaign}
          updateCampaignDetails={updateCampaignDetails}
          open={!!detailsCampaign}
          onOpenChange={(o) => { if (!o) setDetailsCampaign(null); }}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger value="planning" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Global Campaigns
          </TabsTrigger>
          <TabsTrigger value="promotions" className="gap-2">
            <Store className="w-4 h-4" />
            Store Promotions
          </TabsTrigger>
          <TabsTrigger value="social_requests" className="gap-2">
            <FileText className="w-4 h-4" />
            Creative Requests
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="w-4 h-4" />
            Social Approvals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="m-0 mt-4">
          {renderCampaignsView(campaigns.filter((c: any) => !c.location_id))}
        </TabsContent>

        <TabsContent value="promotions" className="m-0 mt-4">
          {renderCampaignsView(campaigns.filter((c: any) => c.location_id))}
        </TabsContent>

        <TabsContent value="social_requests" className="space-y-4 m-0 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Creative Briefs Queue</h2>
            <p className="text-sm text-muted-foreground">Requests sent from marketing campaigns.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {socialPosts.filter(p => p.status === 'Requested').length === 0 ? (
              <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-medium">No pending requests</h3>
                <p className="text-sm text-muted-foreground mt-1">When a campaign owner clicks "Alert Social Team", it appears here.</p>
              </div>
            ) : (
              socialPosts.filter(p => p.status === 'Requested').map(post => (
                <Card key={post.id} className="p-4 shadow-sm border border-l-4 border-l-blue-500 bg-background text-sm relative">
                  <div className="font-semibold mb-1 pr-6 leading-tight">{post.title}</div>
                  <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    Campaign Target: {format(parseISO(post.target_date), "MMM d")}
                  </div>
                  {post.content && (
                    <div className="text-xs bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded border border-blue-100 dark:border-blue-900/30 mb-4 whitespace-pre-wrap">
                      <strong className="block mb-1 text-blue-800 dark:text-blue-300">Creative Guidance:</strong>
                      {post.content}
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs h-8" 
                    onClick={() => updatePostStatus.mutate({ post_id: post.id, status: 'acknowledged', post })}
                  >
                    Mark as Received
                  </Button>
                </Card>
              ))
            )}
          </div>
          
          {socialPosts.filter(p => p.status === 'acknowledged').length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Currently Working On</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {socialPosts.filter(p => p.status === 'acknowledged').map(post => (
                  <Card key={post.id} className="p-4 shadow-sm border bg-muted/30 text-sm relative opacity-70">
                    <div className="font-semibold mb-1 leading-tight">{post.title}</div>
                    <div className="text-xs text-muted-foreground mb-3">Target: {format(parseISO(post.target_date), "MMM d")}</div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs h-8" 
                      onClick={() => {
                        setActiveTab("social");
                        setNewPost(prev => ({...prev, title: post.title, content: post.content, target_date: parseISO(post.target_date), location_id: post.location_id || "all"}));
                        setIsRequestingPost(true);
                      }}
                    >
                      Upload Finished Post
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="social" className="space-y-4 m-0 mt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">Social Media Approvals Calendar</h2>
              <p className="text-sm text-muted-foreground">Upload finished creative for management review.</p>
            </div>
            <Sheet open={isRequestingPost} onOpenChange={setIsRequestingPost}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Upload Post for Approval</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader className="mb-6">
                  <SheetTitle>Submit Post for Approval</SheetTitle>
                  <SheetDescription>Upload finished media and caption copy for review by management.</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 pb-20">
                  <div>
                    <Label>Concept / Topic <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. Highlight new Fall drink menu" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} className="mt-1" />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Select value={newPost.location_id} onValueChange={v => setNewPost({...newPost, location_id: v})}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Platform <span className="text-destructive">*</span></Label>
                      <Select value={newPost.platform} onValueChange={v => setNewPost({...newPost, platform: v})}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="Facebook">Facebook</SelectItem>
                          <SelectItem value="TikTok">TikTok</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Format <span className="text-destructive">*</span></Label>
                      <Select value={newPost.format} onValueChange={v => setNewPost({...newPost, format: v})}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Post">Feed Post</SelectItem>
                          <SelectItem value="Story">Story</SelectItem>
                          <SelectItem value="Reel">Reel / Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Target Post Date <span className="text-destructive">*</span></Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newPost.target_date ? format(newPost.target_date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent mode="single" selected={newPost.target_date} onSelect={d => d && setNewPost({...newPost, target_date: d})} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Caption Copy <span className="text-destructive">*</span></Label>
                    <Textarea placeholder="Write the exact caption copy here..." value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} className="mt-1 min-h-[100px]" />
                  </div>

                  <div>
                    <Label>Media Upload (Optional)</Label>
                    <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
                      {newPost.media_url ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                          <span className="text-sm font-medium text-green-600">Media attached</span>
                          <a href={newPost.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> View Upload
                          </a>
                          <Button variant="ghost" size="sm" onClick={() => setNewPost(p => ({...p, media_url: ""}))} className="mt-2 text-xs h-7 text-muted-foreground">Remove</Button>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="file" 
                            id="media-upload" 
                            className="hidden" 
                            accept="image/*,video/*"
                            onChange={handleFileUpload} 
                            disabled={isUploading}
                          />
                          <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center gap-2">
                            {isUploading ? (
                              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium text-primary">
                              {isUploading ? "Uploading..." : "Click to upload image or video"}
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  <Button className="w-full mt-4" onClick={() => createSocialPost.mutate()} disabled={!newPost.title || !newPost.content || !newPost.platform || !newPost.format || isUploading || createSocialPost.isPending}>
                    {createSocialPost.isPending ? "Submitting..." : "Submit for Approval"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Needs Approval */}
            <div className="bg-muted/30 rounded-lg p-3 border">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Needs Approval</span>
                <Badge variant="secondary">{socialPosts.filter(p => p.status === 'draft' || p.status === 'needs_approval').length}</Badge>
              </h3>
              <div className="space-y-3">
                {socialPosts.filter(p => p.status === 'draft' || p.status === 'needs_approval').map(post => (
                  <SocialPostCard key={post.id} post={post} updateStatus={updatePostStatus} />
                ))}
              </div>
            </div>

            {/* Approved */}
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between text-primary">
                <span>Approved & Ready</span>
                <Badge className="bg-primary/20 text-primary hover:bg-primary/20">{socialPosts.filter(p => p.status === 'approved').length}</Badge>
              </h3>
              <div className="space-y-3">
                {socialPosts.filter(p => p.status === 'approved').map(post => (
                  <SocialPostCard key={post.id} post={post} updateStatus={updatePostStatus} />
                ))}
              </div>
            </div>

            {/* Posted */}
            <div className="bg-muted/10 rounded-lg p-3 border">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between text-muted-foreground">
                <span>Recently Posted</span>
              </h3>
              <div className="space-y-3">
                {socialPosts.filter(p => p.status === 'posted').slice(0, 10).map(post => (
                  <SocialPostCard key={post.id} post={post} updateStatus={updatePostStatus} />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Subcomponents

function SocialPostCard({ post, updateStatus }: any) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedback, setFeedback] = useState(post.feedback_notes || "");

  return (
    <Card className="p-3 shadow-sm border bg-background text-sm relative">
      <div className="font-semibold mb-1 pr-6 leading-tight">{post.title}</div>
      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
        <CalendarDays className="w-3 h-3" />
        Target: {format(parseISO(post.target_date), "MMM d")}
      </div>
      
      {post.content && (
        <div className="text-xs bg-muted/30 p-2 rounded border mb-3 line-clamp-3 italic">
          "{post.content}"
        </div>
      )}

      {post.media_url && (
        <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded border border-primary/20 mb-3 w-max">
          <ImageIcon className="w-3 h-3" /> View Media
        </a>
      )}

      {post.feedback_notes && post.status === 'changes_needed' && (
        <div className="text-xs bg-destructive/10 text-destructive p-2 rounded border border-destructive/20 mb-3">
          <strong>Feedback:</strong> {post.feedback_notes}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-2 pt-2 border-t">
        {post.status === 'draft' && (
          <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => updateStatus.mutate({ post_id: post.id, status: 'needs_approval', post })}>
            Submit for Approval
          </Button>
        )}
        
        {post.status === 'needs_approval' && !isReviewing && (
          <Button variant="default" size="sm" className="w-full text-xs h-7 bg-primary" onClick={() => setIsReviewing(true)}>
            Review Post
          </Button>
        )}

        {post.status === 'needs_approval' && isReviewing && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reviewer Feedback</Label>
              <Textarea 
                placeholder="Leave notes if changes are needed..." 
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-xs h-7 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                onClick={() => {
                  updateStatus.mutate({ post_id: post.id, status: 'changes_needed', post, feedback });
                  setIsReviewing(false);
                }}
              >
                <XCircle className="w-3 h-3 mr-1" /> Request Changes
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1 text-xs h-7 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  updateStatus.mutate({ post_id: post.id, status: 'approved', post, feedback });
                  setIsReviewing(false);
                }}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground" onClick={() => setIsReviewing(false)}>Cancel Review</Button>
          </div>
        )}

        {post.status === 'changes_needed' && (
           <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => updateStatus.mutate({ post_id: post.id, status: 'needs_approval', post })}>
             Resubmit for Approval
           </Button>
        )}

        {post.status === 'approved' && (
          <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => updateStatus.mutate({ post_id: post.id, status: 'posted', post })}>
            Mark as Posted
          </Button>
        )}
        {post.status === 'posted' && (
          <div className="text-xs text-center w-full text-muted-foreground flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Posted
          </div>
        )}
      </div>
    </Card>
  );
}
