import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, parseISO, differenceInDays } from "date-fns";
import { CalendarDays, AlertTriangle, Plus, CheckSquare, Megaphone, Share2, Mail, LayoutList, CalendarIcon, Loader2, CheckCircle2, UserCircle2 } from "lucide-react";

export default function MarketingPlanner() {
  const { selectedLocationId } = useLocationContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("planning");

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['marketing_campaigns', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('marketing_campaigns').select('*').order('target_date', { ascending: true });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
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
    queryKey: ['social_posts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('social_posts').select('*').order('target_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // --- Campaign Mutations ---
  const [isDraftingCampaign, setIsDraftingCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ title: "", description: "", target_date: new Date() });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const payload = {
        title: newCampaign.title,
        description: newCampaign.description,
        target_date: format(newCampaign.target_date, 'yyyy-MM-dd'),
        location_id: selectedLocationId || null,
        status: 'planning'
      };
      const { error } = await supabase.from('marketing_campaigns').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      setIsDraftingCampaign(false);
      setNewCampaign({ title: "", description: "", target_date: new Date() });
      toast({ title: "Campaign created!" });
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
        });
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
  const [newPost, setNewPost] = useState({ title: "", content: "", assigned_to: "", target_date: new Date() });

  const createSocialPost = useMutation({
    mutationFn: async () => {
      const payload = {
        title: newPost.title,
        content: newPost.content,
        assigned_to: newPost.assigned_to,
        target_date: format(newPost.target_date, 'yyyy-MM-dd'),
        status: 'draft'
      };
      const { data, error } = await supabase.from('social_posts').insert(payload).select().single();
      if (error) throw error;

      // Notify social media manager
      if (newPost.assigned_to) {
        await supabase.functions.invoke('send-social-post-alert', {
          body: { post: data, action: 'requested' }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social_posts'] });
      setIsRequestingPost(false);
      setNewPost({ title: "", content: "", assigned_to: "", target_date: new Date() });
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
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
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

function CampaignCard({ campaign, status, tasks, progress, createTask, toggleTask }: any) {
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
        <div className="mt-4 md:mt-0 text-right">
          <div className="text-sm font-medium mb-1">Task Progress</div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold">{progress}%</span>
          </div>
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
