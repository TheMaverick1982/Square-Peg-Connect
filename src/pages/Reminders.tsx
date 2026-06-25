import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle2, Circle, Clock, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Reminder {
  id: string;
  title: string;
  description: string;
  due_date: string;
  is_completed: boolean;
  contact_id: string | null;
  location_id: string | null;
  b2b_contacts?: {
    contact_name: string;
    organization_name: string;
  };
}

export default function Reminders() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [contactId, setContactId] = useState<string>("none");

  // Fetch Reminders
  const { data: reminders = [], refetch } = useQuery({
    queryKey: ["reminders", selectedLocationId],
    queryFn: async () => {
      let q = supabase
        .from("reminders")
        .select(`
          *,
          b2b_contacts (
            contact_name,
            organization_name
          )
        `)
        .order("due_date", { ascending: true });
        
      if (selectedLocationId && selectedLocationId !== "all") {
        q = q.eq("location_id", selectedLocationId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as Reminder[];
    }
  });

  // Fetch B2B Contacts for the dropdown
  const { data: contacts = [] } = useQuery({
    queryKey: ["b2b_contacts_for_reminders", selectedLocationId],
    queryFn: async () => {
      let q = supabase.from("b2b_contacts").select("id, contact_name, organization_name").order("contact_name");
      if (selectedLocationId && selectedLocationId !== "all") {
        q = q.eq("location_id", selectedLocationId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        contact_id: contactId === "none" ? null : contactId,
        location_id: (!selectedLocationId || selectedLocationId === "all") ? null : selectedLocationId
      };

      if (editingId) {
        const { error } = await supabase.from("reminders").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reminders").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Reminder updated" : "Reminder created" });
      refetch();
      setIsSlideoutOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error saving reminder", description: error.message, variant: "destructive" });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string, is_completed: boolean }) => {
      const { error } = await supabase.from("reminders").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch()
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reminder deleted" });
      refetch();
    }
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(new Date());
    setContactId("none");
    setEditingId(null);
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setTitle(reminder.title);
    setDescription(reminder.description || "");
    setDueDate(reminder.due_date ? new Date(reminder.due_date) : undefined);
    setContactId(reminder.contact_id || "none");
    setIsSlideoutOpen(true);
  };

  const handleCreate = () => {
    resetForm();
    setIsSlideoutOpen(true);
  };

  const filteredReminders = reminders.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.b2b_contacts?.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.b2b_contacts?.organization_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingReminders = filteredReminders.filter(r => !r.is_completed);
  const completedReminders = filteredReminders.filter(r => r.is_completed);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
          <p className="text-muted-foreground mt-1">Track tasks and follow-ups.</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Reminder
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search reminders..." 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingReminders.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedReminders.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingReminders.length === 0 ? (
            <div className="text-center p-12 border rounded-lg bg-card border-dashed">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">All caught up!</h3>
              <p className="text-muted-foreground text-sm mt-1">No pending reminders found.</p>
            </div>
          ) : (
            pendingReminders.map(reminder => (
              <ReminderCard 
                key={reminder.id} 
                reminder={reminder} 
                onToggle={() => toggleStatusMutation.mutate({ id: reminder.id, is_completed: true })}
                onEdit={() => handleEdit(reminder)}
                onDelete={() => deleteMutation.mutate(reminder.id)}
              />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-4 space-y-4">
          {completedReminders.length === 0 ? (
            <div className="text-center p-12 border rounded-lg bg-card border-dashed">
              <p className="text-muted-foreground text-sm">No completed tasks yet.</p>
            </div>
          ) : (
            completedReminders.map(reminder => (
              <ReminderCard 
                key={reminder.id} 
                reminder={reminder} 
                onToggle={() => toggleStatusMutation.mutate({ id: reminder.id, is_completed: false })}
                onEdit={() => handleEdit(reminder)}
                onDelete={() => deleteMutation.mutate(reminder.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={isSlideoutOpen} onOpenChange={setIsSlideoutOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Reminder" : "New Reminder"}</SheetTitle>
            <SheetDescription>Set a task or follow-up reminder.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Follow up about happy hour" />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Related Contact (Optional)</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No contact --</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contact_name} ({c.organization_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Details / Notes</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Additional context..." 
                className="min-h-[100px]"
              />
            </div>
            
            <div className="pt-4">
              <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={!title || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Reminder"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReminderCard({ reminder, onToggle, onEdit, onDelete }: { reminder: Reminder, onToggle: () => void, onEdit: () => void, onDelete: () => void }) {
  const isOverdue = !reminder.is_completed && reminder.due_date && new Date(reminder.due_date) < new Date(new Date().setHours(0,0,0,0));
  
  return (
    <Card className={cn("transition-colors", reminder.is_completed && "opacity-60 bg-muted/50")}>
      <CardContent className="p-4 flex gap-4">
        <button onClick={onToggle} className="mt-1 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
          {reminder.is_completed ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Circle className="h-6 w-6" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h4 className={cn("font-medium text-base truncate", reminder.is_completed && "line-through text-muted-foreground")}>
              {reminder.title}
            </h4>
            <div className="flex items-center gap-2 flex-shrink-0">
              {reminder.due_date && (
                <Badge variant={isOverdue ? "destructive" : "secondary"} className="flex items-center gap-1 font-normal">
                  <Clock className="h-3 w-3" />
                  {format(new Date(reminder.due_date), "MMM d, yyyy")}
                </Badge>
              )}
            </div>
          </div>
          
          {reminder.b2b_contacts && (
            <div className="text-sm text-primary font-medium mt-1">
              @{reminder.b2b_contacts.contact_name} — {reminder.b2b_contacts.organization_name}
            </div>
          )}
          
          {reminder.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {reminder.description}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-4 pt-3 border-t">
            <button onClick={onEdit} className="text-xs font-medium hover:underline text-muted-foreground hover:text-foreground">
              Edit
            </button>
            <button onClick={onDelete} className="text-xs font-medium hover:underline text-destructive hover:text-destructive/80">
              Delete
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
