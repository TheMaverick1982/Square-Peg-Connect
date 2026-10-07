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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Clock, Users, Plus, Bell, ChevronLeft, ChevronRight, Repeat, Info, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storeClock, storeTimeToInstant, tzForLocation, tzLabel, tzFriendly } from "@/lib/tz";

// Every event time is the store's local time, whoever is typing or viewing.
const evtTz = (evt: { location_id?: string | null }) => tzForLocation(evt.location_id);
const evtClock = (evt: any, field: "start_date" | "end_date" | "recurrence_end_date" = "start_date") => storeClock(evt[field], evtTz(evt));

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const deleteEvent = useMutation({
    mutationFn: async (eventToDelete: Event) => {
      // 1. Send notification before deleting
      if (eventToDelete.notify_emails) {
        const locName = eventToDelete.location_id 
          ? locations.find(l => l.id === eventToDelete.location_id)?.name || "All Locations" 
          : "All Locations";
          
        const { error: fnError, data: fnData } = await supabase.functions.invoke('notify-event', {
          body: { event: eventToDelete, action: 'deleted', locationName: locName }
        });
        if (fnError) {
          console.error("Failed to send delete notification:", fnError);
        } else if (fnData?.error) {
          throw new Error(fnData.error);
        }
      }
      
      // 2. Perform delete
      const { error } = await supabase.from('events').delete().eq('id', eventToDelete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: "Entertainment deleted successfully." });
    },
    onError: (error) => {
      if (error.message.includes("RESEND_API_KEY")) {
        toast({ 
          title: "Setup Required", 
          description: error.message, 
          duration: 8000, 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Failed to delete entertainment", description: error.message, variant: "destructive" });
      }
    }
  });
  
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
        allOccurrences.push({ ...evt, displayDate: evtClock(evt) });
        return;
      }
      
      // Basic expansion for recurring events (just for display in current view)
      // In a real app with complex recurrence, you'd use rrule or similar
      const startDate = evtClock(evt);
      const endDateLimit = evt.no_end_date ? addMonths(currentMonth, 2) : storeClock(evt.recurrence_end_date || evt.start_date, evtTz(evt));
      
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
          <h1 className="text-3xl font-bold tracking-tight">Entertainment</h1>
          <p className="text-muted-foreground mt-1">
            {selectedLocationId ? `Managing entertainment for ${selectedLocation?.name}` : 'Managing entertainment across all locations.'}
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
              <h3 className="text-lg font-medium">No upcoming entertainment</h3>
              <p className="text-muted-foreground text-sm mt-1">Get started by adding your first entertainment.</p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="bg-card border rounded-lg p-5 flex flex-col hover:border-primary/50 transition-colors group relative">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <EventSheet eventToEdit={event} triggerButton={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="w-4 h-4 text-muted-foreground" /></Button>} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Entertainment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{event.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteEvent.mutate(event)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center gap-2 mb-3 pr-16 flex-wrap">
                  <div className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded shrink-0">
                    {format(evtClock(event), "MMM d, yyyy")}
                  </div>
                  {event.is_recurring && (
                    <div className="flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded shrink-0 capitalize">
                      <Repeat className="w-3 h-3 mr-1" />
                      {event.recurrence_pattern}
                    </div>
                  )}
                  <div className="px-2 py-1 bg-muted text-muted-foreground text-xs font-medium rounded shrink-0">
                    {format(evtClock(event), "EEEE")}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold line-clamp-1 mb-1">{event.title}</h3>
                
                <div className="space-y-2 mt-2 mb-4 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 opacity-70" />
                    {locations.find(l => l.id === event.location_id)?.name || 'All Locations'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-2 opacity-70" />
                    {format(evtClock(event), "h:mm a")} - {format(evtClock(event, "end_date"), "h:mm a")} <span className="ml-1 text-xs opacity-70" title="Store local time">{tzLabel(event.start_date, evtTz(event))}</span>
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
                      <div key={`${evt.id}-${j}`} className="relative group/event flex items-center gap-1">
                        <div className="flex-1 min-w-0">
                          <EventSheet 
                            eventToEdit={evt} 
                            triggerButton={
                              <div className="text-xs truncate px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors" title={evt.title}>
                                {format(evtClock(evt), "h:mma").toLowerCase()} {evt.title}
                              </div>
                            } 
                          />
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-0 group-hover/event:opacity-100 hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Entertainment</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{evt.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteEvent.mutate(evt)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
        const startDate = evtClock(eventToEdit);
        const endDate = evtClock(eventToEdit, "end_date");
        
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
          recurrence_end_date: eventToEdit.recurrence_end_date ? evtClock(eventToEdit, "recurrence_end_date") : new Date(),
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
      // The times typed are the store's local time, not the time zone of whoever is typing.
      const tz = tzForLocation(data.location_id === "all" ? null : data.location_id);
      const startDateStr = format(data.start_date, 'yyyy-MM-dd');
      const startInstant = storeTimeToInstant(startDateStr, data.start_time, tz);
      let endInstant = storeTimeToInstant(startDateStr, data.end_time, tz);
      // Ends after midnight (e.g. 9:00 PM to 1:00 AM): the end is the next day.
      if (endInstant <= startInstant) endInstant = storeTimeToInstant(format(new Date(data.start_date.getFullYear(), data.start_date.getMonth(), data.start_date.getDate() + 1), 'yyyy-MM-dd'), data.end_time, tz);
      const startDateTime = startInstant.toISOString();
      const endDateTime = endInstant.toISOString();
      
      const payload = {
        title: data.title,
        location_id: data.location_id === "all" ? null : data.location_id,
        details: data.details,
        start_date: startDateTime,
        end_date: endDateTime,
        is_recurring: data.is_recurring,
        recurrence_pattern: data.is_recurring ? data.recurrence_pattern : null,
        no_end_date: data.no_end_date,
        recurrence_end_date: (data.is_recurring && !data.no_end_date) ? storeTimeToInstant(format(data.recurrence_end_date, 'yyyy-MM-dd'), "23:59", tz).toISOString() : null,
        notify_emails: data.notify_emails
      };

      if (isEditing) {
        const { error } = await supabase.from('events').update(payload).eq('id', eventToEdit.id);
        if (error) throw error;
        
        // Trigger notification edge function for the edit
        if (data.notify_emails) {
          const locName = payload.location_id 
            ? locations.find(l => l.id === payload.location_id)?.name || "All Locations" 
            : "All Locations";
            
          const { error: fnError, data: fnData } = await supabase.functions.invoke('notify-event', {
            body: { event: { ...payload, id: eventToEdit.id }, action: 'updated', locationName: locName }
          });
          
          if (fnError) {
            toast({ title: "Email Error", description: fnError.message, duration: 8000, variant: "destructive" });
          } else if (fnData?.error) {
             toast({ title: "Setup Required", description: fnData.error, duration: 8000, variant: "destructive" });
          }
        }
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;

        // Trigger notification edge function for creation
        // We do not rely on returning the row (which RLS might block), we just use the payload
        if (data.notify_emails) {
          const locName = payload.location_id 
            ? locations.find(l => l.id === payload.location_id)?.name || "All Locations" 
            : "All Locations";
            
          const { error: fnError, data: fnData } = await supabase.functions.invoke('notify-event', {
            body: { event: payload, action: 'created', locationName: locName }
          });
          
          if (fnError) {
            toast({ title: "Email Error", description: fnError.message, duration: 8000, variant: "destructive" });
          } else if (fnData?.error) {
             toast({ title: "Setup Required", description: fnData.error, duration: 8000, variant: "destructive" });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      toast({ title: isEditing ? "Entertainment updated successfully!" : "Entertainment created successfully!" });
    },
    onError: (error) => {
      toast({ title: "Failed to save entertainment", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {triggerButton || <Button><Plus className="w-4 h-4 mr-2" /> Add Entertainment</Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Entertainment" : "Add Entertainment"}</SheetTitle>
          <SheetDescription>{isEditing ? "Update the entertainment details." : "Schedule entertainment for one or all locations."}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6 pb-20">
          <div className="space-y-4">
            <div>
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="e.g. Trivia Night, Vendor Pop-up" 
                value={formData.title}
                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label>Location <span className="text-destructive">*</span></Label>
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
                <Label>Date <span className="text-destructive">*</span></Label>
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
            <p className="text-xs text-muted-foreground -mt-2">
              Enter times as they are <span className="font-medium text-foreground">at the store ({tzFriendly(tzForLocation(formData.location_id === "all" ? null : formData.location_id))} time)</span>, wherever you are. Everyone sees the same time.
            </p>

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
              <Label>Details <span className="text-destructive">*</span></Label>
              <Textarea 
                placeholder="Details about the entertainment event. If there is a special host name, DJ, etc. So we can put on the website" 
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
              <p className="text-sm text-muted-foreground mb-3">Notify your team when this entertainment is created, changed, or deleted.</p>
              <Label>Email Addresses (comma separated) <span className="text-destructive">*</span></Label>
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
            disabled={!formData.title || !formData.location_id || !formData.start_date || !formData.details.trim() || !formData.notify_emails.trim() || saveEvent.isPending}
          >
            {saveEvent.isPending ? "Saving..." : (isEditing ? "Save Changes" : "Add Entertainment")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
