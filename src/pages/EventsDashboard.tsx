import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Clock, Users, Plus, Bell, ChevronLeft, ChevronRight, Repeat, Info, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Event {
  id: string;
  location_id: string;
  title: string;
  details: string;
  start_date: string;
  end_date: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  no_end_date: boolean;
  recurrence_end_date: string | null;
  notify_emails: string | null;
}

export default function EventsDashboard() {
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('events').select('*').order('start_date', { ascending: true });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Event[];
    }
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Expanded recurring events for calendar view
  const expandedEvents = () => {
    let allOccurrences: any[] = [];
    events.forEach(evt => {
      if (!evt.is_recurring) {
        allOccurrences.push({ ...evt, displayDate: parseISO(evt.start_date) });
        return;
      }
      
      // Basic expansion for recurring events (just for display in current view)
      // In a real app with complex recurrence, you'd use rrule or similar
      const startDate = parseISO(evt.start_date);
      const endDateLimit = evt.no_end_date ? addMonths(currentMonth, 2) : parseISO(evt.recurrence_end_date || evt.start_date);
      
      let curr = startDate;
      // Safety limit to prevent infinite loops
      let limit = 0;
      while (curr <= endDateLimit && limit < 100) {
        // Only add if it's remotely near our current month view to save memory
        if (curr >= subMonths(currentMonth, 1) && curr <= addMonths(currentMonth, 1)) {
           allOccurrences.push({ ...evt, displayDate: new Date(curr) });
        }
        
        if (evt.recurrence_pattern === 'weekly') {
          curr = new Date(curr.setDate(curr.getDate() + 7));
        } else if (evt.recurrence_pattern === 'monthly') {
          curr = addMonths(curr, 1);
        } else {
          break; // Fallback
        }
        limit++;
      }
    });
    return allOccurrences;
  };

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const occurrences = expandedEvents();

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">
            {selectedLocationId ? `Managing events for ${selectedLocation?.name}` : 'Managing events across all locations.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <EventSheet />
        </div>
      </div>

      {isLoading ? (
         <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
         </div>
      ) : view === "list" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.length === 0 ? (
            <div className="col-span-full py-12 text-center border rounded-lg bg-card border-dashed">
              <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-3" />
              <h3 className="text-lg font-medium">No upcoming events</h3>
              <p className="text-muted-foreground text-sm mt-1">Get started by creating your first event.</p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="bg-card border rounded-lg p-5 flex flex-col hover:border-primary/50 transition-colors group relative">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <EventSheet eventToEdit={event} triggerButton={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="w-4 h-4 text-muted-foreground" /></Button>} />
                </div>
                <div className="flex justify-between items-start mb-3">
                  <div className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                    {format(parseISO(event.start_date), "MMM d, yyyy")}
                  </div>
                  {event.is_recurring && (
                    <div className="flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      <Repeat className="w-3 h-3 mr-1" />
                      {event.recurrence_pattern}
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-bold line-clamp-1 mb-1">{event.title}</h3>
                
                <div className="space-y-2 mt-2 mb-4 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 opacity-70" />
                    {locations.find(l => l.id === event.location_id)?.name || 'All Locations'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-2 opacity-70" />
                    {format(parseISO(event.start_date), "h:mm a")} - {format(parseISO(event.end_date), "h:mm a")}
                  </div>
                  {event.details && (
                    <div className="flex items-start text-sm text-muted-foreground mt-3 pt-3 border-t">
                      <Info className="w-4 h-4 mr-2 opacity-70 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{event.details}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)]">
            {/* Empty slots for start of month */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="border-r border-b bg-muted/10 p-2 min-h-[120px]"></div>
            ))}
            
            {calendarDays.map((day, i) => {
              const dayEvents = occurrences.filter(e => isSameDay(e.displayDate, day));
              const isToday = isSameDay(day, new Date());
              
              return (
                <div key={day.toString()} className={`border-r border-b p-2 min-h-[120px] relative group/day ${isToday ? 'bg-primary/5' : ''}`}>
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((evt, j) => (
                      <div key={`${evt.id}-${j}`} className="relative group/event">
                        <EventSheet 
                          eventToEdit={evt} 
                          triggerButton={
                            <div className="text-xs truncate px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors" title={evt.title}>
                              {format(parseISO(evt.start_date), "h:mma").toLowerCase()} {evt.title}
                            </div>
                          } 
                        />
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground font-medium pl-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EventSheet({ eventToEdit, triggerButton }: { eventToEdit?: Event, triggerButton?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { selectedLocationId } = useLocationContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!eventToEdit;
  
  const [formData, setFormData] = useState({
    title: "",
    location_id: selectedLocationId || "all",
    details: "",
    start_date: new Date(),
    start_time: "17:00",
    end_time: "19:00",
    is_recurring: false,
    recurrence_pattern: "weekly",
    no_end_date: true,
    recurrence_end_date: new Date(),
    notify_emails: "brian@brianhardy.com, darene.gtomp@gmail.com"
  });

  // Pre-fill form when editing, or reset to defaults when creating new
  useEffect(() => {
    if (open) {
      if (eventToEdit) {
        const startDate = parseISO(eventToEdit.start_date);
        const endDate = parseISO(eventToEdit.end_date);
        
        setFormData({
          title: eventToEdit.title,
          location_id: eventToEdit.location_id || "all",
          details: eventToEdit.details || "",
          start_date: startDate,
          start_time: format(startDate, "HH:mm"),
          end_time: format(endDate, "HH:mm"),
          is_recurring: eventToEdit.is_recurring,
          recurrence_pattern: eventToEdit.recurrence_pattern || "weekly",
          no_end_date: eventToEdit.no_end_date,
          recurrence_end_date: eventToEdit.recurrence_end_date ? parseISO(eventToEdit.recurrence_end_date) : new Date(),
          notify_emails: eventToEdit.notify_emails || "brian@brianhardy.com, darene.gtomp@gmail.com"
        });
      } else {
        // Reset to default blank state for new events
        setFormData({
          title: "",
          location_id: selectedLocationId || "all",
          details: "",
          start_date: new Date(),
          start_time: "17:00",
          end_time: "19:00",
          is_recurring: false,
          recurrence_pattern: "weekly",
          no_end_date: true,
          recurrence_end_date: new Date(),
          notify_emails: "brian@brianhardy.com, darene.gtomp@gmail.com"
        });
      }
    }
  }, [open, eventToEdit, selectedLocationId]);

  const saveEvent = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Combine dates and times for DB
      const startDateStr = format(data.start_date, 'yyyy-MM-dd');
      const startDateTime = new Date(`${startDateStr}T${data.start_time}:00`).toISOString();
      const endDateTime = new Date(`${startDateStr}T${data.end_time}:00`).toISOString();
      
      const payload = {
        title: data.title,
        location_id: data.location_id === "all" ? null : data.location_id,
        details: data.details,
        start_date: startDateTime,
        end_date: endDateTime,
        is_recurring: data.is_recurring,
        recurrence_pattern: data.is_recurring ? data.recurrence_pattern : null,
        no_end_date: data.no_end_date,
        recurrence_end_date: (data.is_recurring && !data.no_end_date) ? data.recurrence_end_date.toISOString() : null,
        notify_emails: data.notify_emails
      };

      if (isEditing) {
        const { error } = await supabase.from('events').update(payload).eq('id', eventToEdit.id);
        if (error) throw error;
        
        // Trigger notification edge function for the edit
        if (data.notify_emails) {
          const { error: fnError, data: fnData } = await supabase.functions.invoke('notify-event', {
            body: { event: { ...payload, id: eventToEdit.id }, action: 'updated' }
          });
          
          if (fnError) {
            toast({ title: "Email Error", description: fnError.message, duration: 8000, variant: "destructive" });
          } else if (fnData?.error) {
             toast({ title: "Setup Required", description: fnData.error, duration: 8000, variant: "destructive" });
          } else {
             toast({ title: "Diagnostics", description: JSON.stringify(fnData), duration: 15000 });
          }
        }
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;

        // Trigger notification edge function for creation
        // We do not rely on returning the row (which RLS might block), we just use the payload
        if (data.notify_emails) {
          const { error: fnError, data: fnData } = await supabase.functions.invoke('notify-event', {
            body: { event: payload, action: 'created' }
          });
          
          if (fnError) {
            toast({ title: "Email Error", description: fnError.message, duration: 8000, variant: "destructive" });
          } else if (fnData?.error) {
             toast({ title: "Setup Required", description: fnData.error, duration: 8000, variant: "destructive" });
          } else {
             toast({ title: "Diagnostics", description: JSON.stringify(fnData), duration: 15000 });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      toast({ title: isEditing ? "Event updated successfully!" : "Event created successfully!" });
    },
    onError: (error) => {
      toast({ title: "Failed to save event", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {triggerButton || <Button><Plus className="w-4 h-4 mr-2" /> Create Event</Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Event" : "Create New Event"}</SheetTitle>
          <SheetDescription>{isEditing ? "Update the event details." : "Schedule an event for one or all locations."}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6 pb-20">
          <div className="space-y-4">
            <div>
              <Label>Event Title</Label>
              <Input 
                placeholder="e.g. Trivia Night, Vendor Pop-up" 
                value={formData.title}
                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label>Location</Label>
              <Select 
                value={formData.location_id} 
                onValueChange={v => setFormData(f => ({ ...f, location_id: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select location..." />
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
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1.5 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(formData.start_date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.start_date}
                      onSelect={(d) => d && setFormData(f => ({ ...f, start_date: d }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start Time</Label>
                  <Input 
                    type="time" 
                    className="mt-1.5" 
                    value={formData.start_time}
                    onChange={e => setFormData(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input 
                    type="time" 
                    className="mt-1.5"
                    value={formData.end_time}
                    onChange={e => setFormData(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="recurring" 
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData(f => ({ ...f, is_recurring: !!checked }))}
                />
                <Label htmlFor="recurring" className="font-medium cursor-pointer">This is a recurring event</Label>
              </div>
              
              {formData.is_recurring && (
                <div className="pl-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Repeats</Label>
                      <Select 
                        value={formData.recurrence_pattern} 
                        onValueChange={v => setFormData(f => ({ ...f, recurrence_pattern: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Ends</Label>
                      <Select 
                        value={formData.no_end_date ? "never" : "date"} 
                        onValueChange={v => setFormData(f => ({ ...f, no_end_date: v === "never" }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="date">On a specific date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {!formData.no_end_date && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.recurrence_end_date ? format(formData.recurrence_end_date, "PPP") : <span>Pick an end date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.recurrence_end_date}
                            onSelect={(d) => d && setFormData(f => ({ ...f, recurrence_end_date: d }))}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Event Details</Label>
              <Textarea 
                placeholder="Include setup instructions, special menus, etc." 
                className="mt-1.5 min-h-[100px]"
                value={formData.details}
                onChange={e => setFormData(f => ({ ...f, details: e.target.value }))}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Notifications</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">Notify your social media or marketing team when this event is created or changed.</p>
              <Label>Email Addresses (comma separated)</Label>
              <Input 
                placeholder="social@example.com, manager@example.com" 
                className="mt-1.5"
                value={formData.notify_emails}
                onChange={e => setFormData(f => ({ ...f, notify_emails: e.target.value }))}
              />
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={() => saveEvent.mutate(formData)}
            disabled={!formData.title || !formData.location_id || saveEvent.isPending}
          >
            {saveEvent.isPending ? "Saving..." : (isEditing ? "Save Changes" : "Create Event")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
