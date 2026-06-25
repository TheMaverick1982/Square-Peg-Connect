import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Calendar as CalendarIcon, 
  MapPin, 
  Users, 
  Handshake, 
  UserCheck, 
  UtensilsCrossed, 
  PartyPopper 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { useUnifiedContacts, type UnifiedContact, type SourceTag } from "@/hooks/useUnifiedContacts";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Reminders() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("pending");
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDesc, setReminderDesc] = useState("");
  const [reminderDueDate, setReminderDueDate] = useState<Date | undefined>(new Date());
  const [selectedContactId, setSelectedContactId] = useState<string>("none");

  const { data: contacts = [] } = useUnifiedContacts(selectedLocationId);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["all_reminders", selectedLocationId],
    queryFn: async () => {
      let q = supabase.from("reminders").select("*").order("due_date", { ascending: true });
      if (selectedLocationId && selectedLocationId !== "all") {
        q = q.eq("location_id", selectedLocationId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });

  const saveReminderMutation = useMutation({
    mutationFn: async () => {
      let b2b_id = null;
      let guest_id = null;
      let catering_id = null;
      let fundraiser_id = null;
      let location_id = selectedLocationId && selectedLocationId !== "all" ? selectedLocationId : null;

      if (selectedContactId !== "none") {
        const contact = contacts.find(c => c.id === selectedContactId);
        if (contact) {
          b2b_id = contact.b2bRecord?.id || null;
          guest_id = contact.guestBounceBackRecord?.id || null;
          catering_id = contact.cateringRecords?.[0]?.id || null;
          fundraiser_id = contact.fundraiserRecords?.[0]?.id || null;
          // Prefer contact's location if the task is linked
          if (contact.location_id) location_id = contact.location_id;
        }
      }

      const payload = {
        title: reminderTitle,
        description: reminderDesc,
        due_date: reminderDueDate ? format(reminderDueDate, 'yyyy-MM-dd') : null,
        location_id,
        b2b_contact_id: b2b_id,
        guest_bounce_back_id: guest_id,
        catering_request_id: catering_id,
        fundraiser_id
      };

      const { error } = await supabase.from("reminders").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Task created successfully" });
      queryClient.invalidateQueries({ queryKey: ["all_reminders"] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] }); // Invalidate contact-specific queries too
      resetForm();
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" })
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string, is_completed: boolean }) => {
      const { error } = await supabase.from("reminders").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_reminders"] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    }
  });

  const resetForm = () => {
    setIsCreating(false);
    setReminderTitle("");
    setReminderDesc("");
    setReminderDueDate(new Date());
    setSelectedContactId("none");
  };

  // Helper to map reminder -> contact
  const getAssociatedContact = (reminder: any): UnifiedContact | undefined => {
    if (!reminder) return undefined;
    return contacts.find(c => 
      (reminder.b2b_contact_id && c.b2bRecord?.id === reminder.b2b_contact_id) ||
      (reminder.guest_bounce_back_id && c.guestBounceBackRecord?.id === reminder.guest_bounce_back_id) ||
      (reminder.catering_request_id && c.cateringRecords?.some((cr: any) => cr.id === reminder.catering_request_id)) ||
      (reminder.fundraiser_id && c.fundraiserRecords?.some((fr: any) => fr.id === reminder.fundraiser_id))
    );
  };

  const getSourceIcon = (source: SourceTag) => {
    switch (source) {
      case "B2B": return <Handshake className="w-3 h-3" />;
      case "Guest Bounce Back": return <UserCheck className="w-3 h-3" />;
      case "Catering": return <UtensilsCrossed className="w-3 h-3" />;
      case "Fundraiser": return <PartyPopper className="w-3 h-3" />;
    }
  };

  const filteredReminders = reminders.filter((r: any) => {
    const isCompleted = activeTab === "completed";
    if (r.is_completed !== isCompleted) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const contact = getAssociatedContact(r);
      const contactMatches = contact?.name.toLowerCase().includes(q) || contact?.organization?.toLowerCase().includes(q);
      const textMatches = r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
      if (!contactMatches && !textMatches) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 flex flex-col h-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks & Reminders</h1>
          <p className="text-muted-foreground mt-1">Manage your to-do list across all CRM modules.</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <Input 
          placeholder="Search tasks or contacts..." 
          className="max-w-xs bg-background"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1">
        <TabsList className="grid w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="pending">Pending Tasks</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-0">
          {isLoading ? (
             <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>
          ) : filteredReminders.length === 0 ? (
             <div className="p-12 text-center border rounded-lg bg-card text-muted-foreground flex flex-col items-center justify-center">
               <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
               <h3 className="text-lg font-medium text-foreground">No tasks found</h3>
               <p className="text-sm mt-1">
                 {activeTab === "pending" ? "You're all caught up!" : "No completed tasks yet."}
               </p>
             </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((reminder: any) => {
                const contact = getAssociatedContact(reminder);
                const loc = locations.find(l => l.id === reminder.location_id);
                return (
                  <Card key={reminder.id} className={cn("transition-colors", reminder.is_completed && "opacity-60 bg-muted/50")}>
                    <CardContent className="p-4 flex gap-4 sm:items-center">
                      <button 
                        onClick={() => toggleStatusMutation.mutate({ id: reminder.id, is_completed: !reminder.is_completed })} 
                        className="mt-0.5 sm:mt-0 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {reminder.is_completed ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Circle className="h-6 w-6" />}
                      </button>
                      
                      <div className="flex-1 min-w-0 grid sm:grid-cols-12 gap-4 items-center">
                        <div className="sm:col-span-6">
                          <h4 className={cn("font-medium text-base truncate", reminder.is_completed && "line-through text-muted-foreground")}>
                            {reminder.title}
                          </h4>
                          {reminder.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{reminder.description}</p>
                          )}
                        </div>

                        <div className="sm:col-span-4 flex items-center gap-3">
                          {contact ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border text-sm">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="font-medium truncate text-xs">{contact.name}</div>
                                {contact.sources[0] && (
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    {getSourceIcon(contact.sources[0])} {contact.sources[0]}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">No contact linked</div>
                          )}
                        </div>

                        <div className="sm:col-span-2 flex flex-col sm:items-end text-sm text-muted-foreground gap-1">
                          {reminder.due_date && (
                            <Badge variant={
                              !reminder.is_completed && new Date(reminder.due_date) < new Date(new Date().setHours(0,0,0,0)) 
                                ? "destructive" 
                                : "secondary"
                            } className="font-medium">
                              {format(new Date(reminder.due_date), "MMM d, yyyy")}
                            </Badge>
                          )}
                          {loc && (
                            <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                              <MapPin className="w-3 h-3" /> {loc.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={isCreating} onOpenChange={setIsCreating}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>New Task</SheetTitle>
            <SheetDescription>Create a reminder and optionally link it to a CRM contact.</SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <Label>Task Title *</Label>
              <Input 
                value={reminderTitle} 
                onChange={e => setReminderTitle(e.target.value)} 
                placeholder="Follow up on catering quote" 
              />
            </div>
            
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reminderDueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reminderDueDate ? format(reminderDueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={reminderDueDate} onSelect={setReminderDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Link to Contact (Optional)</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact linked</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.organization ? `(${c.organization})` : ''} - {c.sources.join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Linking a contact lets you see this task on their profile.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (Optional)</Label>
              <Textarea 
                value={reminderDesc} 
                onChange={e => setReminderDesc(e.target.value)} 
                className="min-h-[100px]" 
                placeholder="Details about this follow-up..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
              <Button 
                disabled={!reminderTitle || saveReminderMutation.isPending} 
                onClick={() => saveReminderMutation.mutate()}
              >
                {saveReminderMutation.isPending ? "Saving..." : "Save Task"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
