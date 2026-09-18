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
import { format, addDays, parseISO, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths } from "date-fns";
import { CalendarDays, AlertTriangle, Plus, CheckSquare, Megaphone, Share2, Mail, LayoutList, CalendarIcon, Loader2, CheckCircle2, UserCircle2, MapPin, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

const SEASONAL_EVENTS = [
  { name: "Super Bowl", month: 1, day: 9, type: 'Sports' },
  { name: "Valentine's Day", month: 1, day: 14, type: 'Holiday' },
  { name: "March Madness Begins", month: 2, day: 18, type: 'Sports' },
  { name: "St. Patrick's Day", month: 2, day: 17, type: 'Holiday' },
  { name: "Golf Season (The Masters)", month: 3, day: 10, type: 'Sports' },
  { name: "Cinco de Mayo", month: 4, day: 5, type: 'Holiday' },
  { name: "Mother's Day", month: 4, day: 11, type: 'Holiday' },
  { name: "Father's Day", month: 5, day: 15, type: 'Holiday' },
  { name: "4th of July", month: 6, day: 4, type: 'Holiday' },
  { name: "Back to School", month: 7, day: 20, type: 'Season' },
  { name: "Football Season Kickoff", month: 8, day: 5, type: 'Sports' },
  { name: "NBA Season Begins", month: 9, day: 22, type: 'Sports' },
  { name: "Halloween", month: 9, day: 31, type: 'Holiday' },
  { name: "Veterans Day", month: 10, day: 11, type: 'Holiday' },
  { name: "Thanksgiving", month: 10, day: 28, type: 'Holiday' },
  { name: "Black Friday (Gift Card Promo)", month: 10, day: 29, type: 'Holiday' },
  { name: "Toys for Tots Drop-off Launch", month: 11, day: 1, type: 'Community' },
  { name: "Winter Coat Drive", month: 11, day: 10, type: 'Community' },
  { name: "Christmas", month: 11, day: 25, type: 'Holiday' },
  { name: "New Year's Eve", month: 11, day: 31, type: 'Holiday' }
];

const getUpcomingEvents = () => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const currentYear = today.getFullYear();
  
  const upcoming = SEASONAL_EVENTS.map(event => {
    let d = new Date(currentYear, event.month, event.day);
    if (d < today) {
      d = new Date(currentYear + 1, event.month, event.day);
    }
    return { ...event, date: d };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return upcoming.slice(0, 5); 
};

export default function MarketingPlanner() {
  const { selectedLocationId } = useLocationContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("planning");
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
  const [newCampaign, setNewCampaign] = useState({ title: "", description: "", target_date: new Date(), location_id: "all" });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const payload = {
        title: newCampaign.title,
        description: newCampaign.description,
        target_date: format(newCampaign.target_date, 'yyyy-MM-dd'),
        location_id: newCampaign.location_id === "all" ? null : newCampaign.location_id,
        status: 'planning'
      };
      const { error } = await supabase.from('marketing_campaigns').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      setIsDraftingCampaign(false);
      setNewCampaign({ title: "", description: "", target_date: new Date(), location_id: "all" });
      toast({ title: "Campaign created!" });
    }
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

  // --- Task Mutations ---
  const createTask = useMutation({
    mutationFn: async ({ campaign_id, title, assigned_to, due_date }: { campaign_id: string, title: string, assigned_to: string, due_date: Date }) => {
      const payload = { campaign_id, title, assigned_to, due_date: format(due_date, 'yyyy-MM-dd') };
      const { data, error } = await supabase.from('marketing_tasks').insert(payload).select('*, marketing_campaigns(title)').single();
      if (error) throw error;

      // Notify assignee
      if (assigned_to) {
        await supabase.functions.invoke('send-marketing-task-assigned', {
          body: { task: payload, campaign: { title: data.marketing_campaigns.title } }
        }).catch(err => console.error("Error sending task assignment email", err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_tasks'] });
      toast({ title: "Task assigned!" });
    }
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
  const [newPost, setNewPost] = useState({ title: "", content: "", assigned_to: "", target_date: new Date(), location_id: "all" });

  const createSocialPost = useMutation({
    mutationFn: async () => {
      const payload = {
        title: newPost.title,
        content: newPost.content,
        assigned_to: newPost.assigned_to,
        target_date: format(newPost.target_date, 'yyyy-MM-dd'),
        location_id: newPost.location_id === "all" ? null : newPost.location_id,
        status: 'draft'
      };
      const { data, error } = await supabase.from('social_posts').insert(payload).select().single();
      if (error) throw error;

      // Notify social media manager
      if (newPost.assigned_to) {
        await supabase.functions.invoke('send-social-post-alert', {
          body: { post: data, action: 'requested' }
        }).catch(err => console.error("Error sending social post alert", err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social_posts'] });
      setIsRequestingPost(false);
      setNewPost({ title: "", content: "", assigned_to: "", target_date: new Date(), location_id: "all" });
      toast({ title: "Social post requested!" });
    }
  });

  const updatePostStatus = useMutation({
    mutationFn: async ({ post_id, status, post }: { post_id: string, status: string, post: any }) => {
      const { error } = await supabase.from('social_posts').update({ status }).eq('id', post_id);
      if (error) throw error;
      
      // Notify on approval or review request
      if (status === 'approved' || status === 'needs_approval') {
         await supabase.functions.invoke('send-social-post-alert', {
           body: { post, action: status }
         });
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

  const upcomingPrompts = getUpcomingEvents();

  const renderCalendar = () => {
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
            const dayCampaigns = campaigns.filter(c => isSameDay(parseISO(c.target_date), day));
            // Find if this day has a seasonal prompt
            const dayPrompt = upcomingPrompts.find(p => isSameDay(p.date, day));

            return (
              <div 
                key={day.toString()} 
                className={`
                  min-h-[100px] p-2 border-r border-b relative
                  ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : ""}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium">{format(day, "d")}</span>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  {dayCampaigns.map(camp => (
                    <div 
                      key={camp.id}
                      className="text-xs px-1.5 py-1 rounded border font-medium truncate bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20"
                      title={camp.title}
                    >
                      {camp.title}
                    </div>
                  ))}
                  
                  {dayPrompt && dayCampaigns.length === 0 && (
                    <div 
                      className="text-[10px] px-1.5 py-1 rounded border border-dashed font-medium truncate bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted/50 hover:text-foreground transition-colors"
                      title={`Suggested: ${dayPrompt.name}`}
                      onClick={() => {
                        setNewCampaign({ title: `${dayPrompt.name} Promo`, description: "", target_date: dayPrompt.date, location_id: "all" });
                        setIsDraftingCampaign(true);
                      }}
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

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketing & Social Planner</h1>
          <p className="text-muted-foreground mt-1">Plan campaigns 3+ months out, assign tasks, and manage social approvals.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="planning" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            90-Day Horizon & Campaigns
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="w-4 h-4" />
            Social Media Approval Engine
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-4 m-0">
          <div className="flex items-center justify-end mb-2">
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

          {viewMode === "calendar" ? (
             renderCalendar()
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Upcoming Horizons
                  </h3>
                  <p className="text-sm text-muted-foreground">Campaigns entering the 90-day critical planning window.</p>
                </div>
                <Sheet open={isDraftingCampaign} onOpenChange={setIsDraftingCampaign}>
                  <SheetTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Plan Campaign</Button>
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
                      <div>
                        <Label>Target Date</Label>
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
                        <Label>Description</Label>
                        <Textarea placeholder="High level goals for this season..." value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} className="mt-1" />
                      </div>
                      <Button className="w-full mt-4" onClick={() => createCampaign.mutate()} disabled={!newCampaign.title || createCampaign.isPending}>
                        {createCampaign.isPending ? "Saving..." : "Save Campaign"}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {loadingCampaigns ? (
                <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                  <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-medium">No campaigns planned</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Start planning 3+ months ahead to never miss a holiday.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map(camp => {
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
                        updateCampaignDetails={updateCampaignDetails}
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
                    {upcomingPrompts.map(prompt => (
                      <div key={prompt.name} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{prompt.name}</div>
                          <div className="text-xs text-muted-foreground">{format(prompt.date, "MMM d, yyyy")}</div>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-7 text-xs bg-background hover:bg-background/80"
                          onClick={() => {
                            setNewCampaign({ title: `${prompt.name} Promo`, description: "", target_date: prompt.date, location_id: "all" });
                            setIsDraftingCampaign(true);
                          }}
                        >
                          Plan
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">My Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasks.filter(t => !t.is_completed).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No pending tasks.</p>
                    ) : (
                      tasks.filter(t => !t.is_completed).slice(0, 8).map(task => (
                        <div key={task.id} className="flex items-start gap-2 text-sm">
                          <button onClick={() => toggleTask.mutate({ task_id: task.id, is_completed: true })} className="mt-0.5 text-muted-foreground hover:text-primary">
                            <CheckSquare className="w-4 h-4" />
                          </button>
                          <div>
                            <div className="font-medium line-clamp-1">{task.title}</div>
                            <div className="text-[10px] text-muted-foreground">{task.assigned_to} • Due {format(parseISO(task.due_date), "MMM d")}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          )}
        </TabsContent>

        <TabsContent value="social" className="space-y-4 m-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Content Pipeline</h2>
            <Sheet open={isRequestingPost} onOpenChange={setIsRequestingPost}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Request Post</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader className="mb-6">
                  <SheetTitle>Request Social Post</SheetTitle>
                  <SheetDescription>Assign a post concept to your social media manager.</SheetDescription>
                </SheetHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Concept / Topic</Label>
                    <Input placeholder="e.g. Highlight new Fall drink menu" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} className="mt-1" />
                  </div>
                  <div>
                    <Label>Assign To (Email)</Label>
                    <Input placeholder="social@squarepegpizzeria.com" value={newPost.assigned_to} onChange={e => setNewPost({...newPost, assigned_to: e.target.value})} className="mt-1" />
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
                  <div>
                    <Label>Target Post Date</Label>
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
                    <Label>Details & Direction</Label>
                    <Textarea placeholder="Make sure to mention the discount code..." value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} className="mt-1 min-h-[100px]" />
                  </div>
                  <Button className="w-full mt-4" onClick={() => createSocialPost.mutate()} disabled={!newPost.title || !newPost.assigned_to || createSocialPost.isPending}>
                    {createSocialPost.isPending ? "Sending Request..." : "Request Post"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Draft / Needs Approval */}
            <div className="bg-muted/30 rounded-lg p-3 border">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Draft / Needs Approval</span>
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

function CampaignCard({ campaign, status, tasks, progress, createTask, toggleTask, updateCampaignDetails }: any) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assigned_to: "", due_date: new Date() });

  const handleCreate = () => {
    createTask.mutate({ ...newTask, campaign_id: campaign.id }, {
      onSuccess: () => {
        setIsAssigning(false);
        setNewTask({ title: "", assigned_to: "", due_date: new Date() });
      }
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-muted/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{campaign.title}</h3>
            <Badge className={status.color} variant="outline">{status.label}</Badge>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            Target: {format(parseISO(campaign.target_date), "MMM d, yyyy")}
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex items-center justify-end gap-6">
          <div className="text-right">
            <div className="text-sm font-medium mb-1">Task Progress</div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-semibold">{progress}%</span>
            </div>
          </div>
          <CampaignDetailsSheet campaign={campaign} updateCampaignDetails={updateCampaignDetails} />
        </div>
      </div>
      <div className="p-4">
        {campaign.description && (
          <p className="text-sm text-muted-foreground mb-4">{campaign.description}</p>
        )}
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delegated Tasks</h4>
            <Sheet open={isAssigning} onOpenChange={setIsAssigning}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Plus className="w-3 h-3" /> Assign Task</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader className="mb-6">
                  <SheetTitle>Assign Campaign Task</SheetTitle>
                  <SheetDescription>Delegate work for {campaign.title}. They will receive an email alert.</SheetDescription>
                </SheetHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Task Description</Label>
                    <Input placeholder="e.g. Create Special Drink Menu" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="mt-1" />
                  </div>
                  <div>
                    <Label>Assignee Email</Label>
                    <Input placeholder="chef@squarepegpizzeria.com" value={newTask.assigned_to} onChange={e => setNewTask({...newTask, assigned_to: e.target.value})} className="mt-1" />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newTask.due_date ? format(newTask.due_date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent mode="single" selected={newTask.due_date} onSelect={d => d && setNewTask({...newTask, due_date: d})} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button className="w-full mt-4" onClick={handleCreate} disabled={!newTask.title || createTask.isPending}>
                    {createTask.isPending ? "Assigning..." : "Assign Task & Email"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {tasks.length === 0 ? (
            <div className="text-xs italic text-muted-foreground">No tasks assigned yet.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {tasks.map((task: any) => (
                <div key={task.id} className={`flex items-start gap-2 p-2 rounded border text-sm ${task.is_completed ? 'bg-muted/30' : 'bg-background'}`}>
                  <button onClick={() => toggleTask.mutate({ task_id: task.id, is_completed: !task.is_completed })} className={`mt-0.5 shrink-0 ${task.is_completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                    {task.is_completed ? <CheckCircle2 className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0">
                    <div className={`font-medium line-clamp-1 ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <UserCircle2 className="w-3 h-3" />
                      <span className="truncate">{task.assigned_to}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CampaignDetailsSheet({ campaign, updateCampaignDetails }: any) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isAlertingSocial, setIsAlertingSocial] = useState(false);
  const [formData, setFormData] = useState({
    drinks_plan: campaign.drinks_plan || "",
    drinks_due_date: campaign.drinks_due_date ? parseISO(campaign.drinks_due_date) : undefined,
    drinks_assigned_to: campaign.drinks_assigned_to || "",
    menu_plan: campaign.menu_plan || "",
    menu_due_date: campaign.menu_due_date ? parseISO(campaign.menu_due_date) : undefined,
    menu_assigned_to: campaign.menu_assigned_to || "",
    activity_plan: campaign.activity_plan || "",
    activity_due_date: campaign.activity_due_date ? parseISO(campaign.activity_due_date) : undefined,
    activity_assigned_to: campaign.activity_assigned_to || "",
    promo_social: campaign.promo_social || false,
    promo_como: campaign.promo_como || false,
    promo_email: campaign.promo_email || false,
    promo_in_store: campaign.promo_in_store || false,
    promo_notes: campaign.promo_notes || "",
    promo_due_date: campaign.promo_due_date ? parseISO(campaign.promo_due_date) : undefined,
    promo_assigned_to: campaign.promo_assigned_to || "",
    social_email: campaign.social_email || "",
    como_notes: campaign.como_notes || "",
    como_assigned_to: campaign.como_assigned_to || "",
    email_notes: campaign.email_notes || "",
    email_assigned_to: campaign.email_assigned_to || "",
    in_store_notes: campaign.in_store_notes || "",
    in_store_assigned_to: campaign.in_store_assigned_to || ""
  });

  const handleSave = () => {
    const updates = {
      ...formData,
      drinks_due_date: formData.drinks_due_date ? format(formData.drinks_due_date, 'yyyy-MM-dd') : null,
      menu_due_date: formData.menu_due_date ? format(formData.menu_due_date, 'yyyy-MM-dd') : null,
      activity_due_date: formData.activity_due_date ? format(formData.activity_due_date, 'yyyy-MM-dd') : null,
      promo_due_date: formData.promo_due_date ? format(formData.promo_due_date, 'yyyy-MM-dd') : null,
    };
    updateCampaignDetails.mutate({ id: campaign.id, updates }, {
      onSuccess: () => setOpen(false)
    });
  };

  const handleAlertSocial = async () => {
    setIsAlertingSocial(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-social-post-alert', {
        body: { 
          source: 'campaign',
          campaign: campaign.title,
          target_date: campaign.target_date,
          due_date: formData.promo_due_date ? format(formData.promo_due_date, 'yyyy-MM-dd') : null,
          guidance: formData.promo_notes
        }
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast({ title: "Social Team Alerted", description: "An email notification has been sent with your creative guidance." });
    } catch (err: any) {
      toast({ title: "Alert Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsAlertingSocial(false);
    }
  };

  const isOverdue = (date?: Date, content?: string) => {
    if (!date) return false;
    // Overdue if the date is in the past AND the content plan is empty
    return (new Date().getTime() > date.getTime() + 86400000) && (!content || content.trim() === "");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">Open Details</Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{campaign.title} Planning</SheetTitle>
          <SheetDescription>Detailed planning for drinks, menu, activities, and promotion.</SheetDescription>
        </SheetHeader>
        
        <div className="space-y-8 pb-20">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-semibold">Drink Menu Plan</h4>
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Assign To (Email)" 
                  value={formData.drinks_assigned_to || ""}
                  onChange={e => setFormData(f => ({...f, drinks_assigned_to: e.target.value}))}
                  className="h-8 text-xs w-[180px]"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 text-xs ${isOverdue(formData.drinks_due_date, formData.drinks_plan) ? 'text-destructive border-destructive' : ''}`}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {formData.drinks_due_date ? format(formData.drinks_due_date, "MMM d, yyyy") : <span>Set Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent mode="single" selected={formData.drinks_due_date} onSelect={d => setFormData(f => ({...f, drinks_due_date: d}))} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Textarea 
              placeholder="List specific drinks, specials, or prep needed..." 
              value={formData.drinks_plan}
              onChange={e => setFormData(f => ({...f, drinks_plan: e.target.value}))}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-semibold">Food Menu Plan</h4>
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Assign To (Email)" 
                  value={formData.menu_assigned_to || ""}
                  onChange={e => setFormData(f => ({...f, menu_assigned_to: e.target.value}))}
                  className="h-8 text-xs w-[180px]"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 text-xs ${isOverdue(formData.menu_due_date, formData.menu_plan) ? 'text-destructive border-destructive' : ''}`}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {formData.menu_due_date ? format(formData.menu_due_date, "MMM d, yyyy") : <span>Set Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent mode="single" selected={formData.menu_due_date} onSelect={d => setFormData(f => ({...f, menu_due_date: d}))} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Textarea 
              placeholder="List specific food specials, prep needed, ingredients..." 
              value={formData.menu_plan}
              onChange={e => setFormData(f => ({...f, menu_plan: e.target.value}))}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-semibold">Activity & Event Plan</h4>
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Assign To (Email)" 
                  value={formData.activity_assigned_to || ""}
                  onChange={e => setFormData(f => ({...f, activity_assigned_to: e.target.value}))}
                  className="h-8 text-xs w-[180px]"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 text-xs ${isOverdue(formData.activity_due_date, formData.activity_plan) ? 'text-destructive border-destructive' : ''}`}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {formData.activity_due_date ? format(formData.activity_due_date, "MMM d, yyyy") : <span>Set Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent mode="single" selected={formData.activity_due_date} onSelect={d => setFormData(f => ({...f, activity_due_date: d}))} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Textarea 
              placeholder="Decorations, games, music, schedule of events..." 
              value={formData.activity_plan}
              onChange={e => setFormData(f => ({...f, activity_plan: e.target.value}))}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h4 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Promotional Strategy</h4>
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Promo Lead (Email)" 
                  value={formData.promo_assigned_to || ""}
                  onChange={e => setFormData(f => ({...f, promo_assigned_to: e.target.value}))}
                  className="h-8 text-xs w-[180px] bg-background"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 text-xs bg-background ${isOverdue(formData.promo_due_date, formData.promo_notes) ? 'text-destructive border-destructive' : ''}`}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {formData.promo_due_date ? format(formData.promo_due_date, "MMM d, yyyy") : <span>Master Promo Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent mode="single" selected={formData.promo_due_date} onSelect={d => setFormData(f => ({...f, promo_due_date: d}))} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="p-social" checked={formData.promo_social} onCheckedChange={c => setFormData(f => ({...f, promo_social: !!c}))} />
                <Label htmlFor="p-social" className="text-sm cursor-pointer">Social Media</Label>
              </div>
              <label className="flex items-center space-x-2">
                <Checkbox checked={formData.promo_como} onCheckedChange={(checked) => setFormData(f => ({...f, promo_como: !!checked}))} />
                <span className="text-sm cursor-pointer">Como (Loyalty Members)</span>
              </label>
              <label className="flex items-center space-x-2">
                <Checkbox checked={formData.promo_email} onCheckedChange={(checked) => setFormData(f => ({...f, promo_email: !!checked}))} />
                <span className="text-sm cursor-pointer">Email Broadcast</span>
              </label>
              <label className="flex items-center space-x-2">
                <Checkbox checked={formData.promo_in_store} onCheckedChange={(checked) => setFormData(f => ({...f, promo_in_store: !!checked}))} />
                <span className="text-sm cursor-pointer">In-Store Signage</span>
              </label>
            </div>
            
              {formData.promo_social && (
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-md border border-blue-100 dark:border-blue-900/30 space-y-3 mt-4">
                  <h4 className="font-medium text-sm text-blue-800 dark:text-blue-300">Social Media Creative Alert</h4>
                  <p className="text-xs text-blue-700/80 dark:text-blue-400/80">Send a direct request to the social media manager to prepare creative assets for this campaign.</p>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Social Team Email</Label>
                      <Input 
                        placeholder="social@example.com"
                        className="h-8 mt-1 bg-white dark:bg-background"
                        value={formData.social_email || ""}
                        onChange={e => setFormData(f => ({...f, social_email: e.target.value}))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Creative Guidance / Notes</Label>
                      <Textarea 
                        placeholder="e.g., Needs to feel energetic. Make sure to feature the new cocktail prominently." 
                        className="min-h-[80px] bg-white dark:bg-background"
                        value={formData.promo_notes || ""}
                        onChange={e => setFormData(f => ({...f, promo_notes: e.target.value}))}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    type="button"
                    disabled={!formData.social_email}
                    onClick={async () => {
                      try {
                        const { error } = await supabase.from('social_posts').insert({
                          title: `Campaign Creative: ${campaign.title}`,
                          content: formData.promo_notes,
                          target_date: campaign.target_date,
                          location_id: campaign.location_id,
                          status: 'Requested',
                          campaign_id: campaign.id
                        });
                        
                        if (error) throw error;
                        
                        await supabase.functions.invoke('send-social-post-alert', {
                          body: { 
                            type: "campaign_creative_request",
                            campaignTitle: campaign.title,
                            targetDate: campaign.target_date,
                            notes: formData.promo_notes,
                            locationId: campaign.location_id,
                            socialEmail: formData.social_email,
                            dueDate: formData.promo_due_date
                          }
                        });
                        toast({ title: "Alert Sent", description: "The social media team has been notified and task queued." });
                      } catch (e: any) {
                        toast({ title: "Error", description: e.message, variant: "destructive" });
                      }
                    }}
                  >
                    Alert Social Team
                  </Button>
                </div>
              )}
              
              {!formData.promo_social && (
                <>
                  <Label className="mt-4 block">Promotion Notes / Submit to Marketing</Label>
                  <Textarea 
                    placeholder="What specifically needs to be promoted? Assets needed? Details for social media..." 
                    value={formData.promo_notes}
                    onChange={e => setFormData(f => ({...f, promo_notes: e.target.value}))}
                    className="min-h-[100px]"
                  />
                </>
              )}
              
              {formData.promo_como && (
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Como (Loyalty) Strategy</Label>
                    <Input 
                      placeholder="Assign To (Email)" 
                      value={formData.como_assigned_to || ""}
                      onChange={e => setFormData(f => ({...f, como_assigned_to: e.target.value}))}
                      className="h-7 text-xs w-[160px] bg-background"
                    />
                  </div>
                  <Textarea 
                    placeholder="Points multipliers, push notifications, offers..." 
                    value={formData.como_notes || ""}
                    onChange={e => setFormData(f => ({...f, como_notes: e.target.value}))}
                    className="min-h-[60px] text-sm"
                  />
                </div>
              )}
              
              {formData.promo_email && (
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Email Broadcast Details</Label>
                    <Input 
                      placeholder="Assign To (Email)" 
                      value={formData.email_assigned_to || ""}
                      onChange={e => setFormData(f => ({...f, email_assigned_to: e.target.value}))}
                      className="h-7 text-xs w-[160px] bg-background"
                    />
                  </div>
                  <Textarea 
                    placeholder="Subject lines, audience segments, send dates..." 
                    value={formData.email_notes || ""}
                    onChange={e => setFormData(f => ({...f, email_notes: e.target.value}))}
                    className="min-h-[60px] text-sm"
                  />
                </div>
              )}

              {formData.promo_in_store && (
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">In-Store Signage Requirements</Label>
                    <Input 
                      placeholder="Assign To (Email)" 
                      value={formData.in_store_assigned_to || ""}
                      onChange={e => setFormData(f => ({...f, in_store_assigned_to: e.target.value}))}
                      className="h-7 text-xs w-[160px] bg-background"
                    />
                  </div>
                  <Textarea 
                    placeholder="Table tents, TV screens, posters..." 
                    value={formData.in_store_notes || ""}
                    onChange={e => setFormData(f => ({...f, in_store_notes: e.target.value}))}
                    className="min-h-[60px] text-sm"
                  />
                </div>
              )}
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Details
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SocialPostCard({ post, updateStatus }: any) {
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

      <div className="flex items-center gap-2 mt-2 pt-2 border-t">
        {post.status === 'draft' && (
          <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => updateStatus.mutate({ post_id: post.id, status: 'needs_approval', post })}>
            Submit for Approval
          </Button>
        )}
        {post.status === 'needs_approval' && (
          <>
            <Button variant="default" size="sm" className="w-full text-xs h-7 bg-green-600 hover:bg-green-700" onClick={() => updateStatus.mutate({ post_id: post.id, status: 'approved', post })}>
              Approve
            </Button>
          </>
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
