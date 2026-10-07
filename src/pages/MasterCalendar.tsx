import { storeClock, tzForLocation, tzLabel } from "@/lib/tz";
import { useState, useEffect } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, LayoutList, CalendarDays, Loader2, Filter, MapPin, Users, Mail, Phone, Building, FileText, DollarSign, CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Every date an entertainment event happens (store-local), expanding weekly / monthly repeats. */
function entertainmentDates(row: any): Date[] {
  const tz = tzForLocation(row.location_id);
  const first = storeClock(row.start_date, tz);
  if (isNaN(first.getTime())) return [];
  if (!row.is_recurring || !["weekly", "monthly"].includes(row.recurrence_pattern)) return [first];
  // Open-ended repeats are drawn 18 months ahead.
  const horizon = addMonths(new Date(), 18);
  const until = row.no_end_date || !row.recurrence_end_date ? horizon : storeClock(row.recurrence_end_date, tz);
  const limit = until < horizon ? until : horizon;
  const out: Date[] = [];
  for (let i = 0; i < 400; i++) {
    const d = row.recurrence_pattern === "weekly"
      ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * i, first.getHours(), first.getMinutes())
      : addMonths(first, i);
    if (d > limit && i > 0) break;
    out.push(d);
  }
  return out;
}

type EventType = "Entertainment" | "Fundraiser" | "StoreEvent" | "LargeReservation" | "Catering";

interface UnifiedEvent {
  id: string;
  title: string;
  date: Date;
  locationId: string;
  type: EventType;
  status?: string;
  details?: string;
  originalData: any;
}

const formatTime12Hour = (time24: string | undefined | null) => {
  if (!time24) return "";
  try {
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // 0 becomes 12
    return `${h}:${minutes} ${ampm}`;
  } catch (e) {
    return time24;
  }
};

export default function MasterCalendar() {
  const { selectedLocationId } = useLocationContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingEvent, setViewingEvent] = useState<UnifiedEvent | null>(null);

  // Determine if the user is an admin based on context logic equivalent 
  // (Assuming we check if selectedLocationId is null or we can toggle to "all")
  // In the real app, we rely on the header for location restriction, but here we can filter.

  useEffect(() => {
    const fetchAllEvents = async () => {
      setIsLoading(true);
      
      const [
        { data: entertainmentData },
        { data: fundraisersData },
        { data: storeEventsData },
        { data: largeResData },
        { data: cateringData }
      ] = await Promise.all([
        supabase.from('events').select('*'),
        supabase.from('fundraisers').select('*').is('deleted_at', null),
        supabase.from('store_events').select('*').is('deleted_at', null),
        supabase.from('large_reservations').select('*').is('deleted_at', null),
        supabase.from('catering_requests').select('*')
      ]);

      const unified: UnifiedEvent[] = [];

      if (entertainmentData) {
        entertainmentData.forEach((row: any) => {
          // Repeating entertainment shows on every date it happens, not just the first.
          entertainmentDates(row).forEach((date, i) => {
            unified.push({
              id: `ent-${row.id}-${i}`,
              title: row.title,
              date,
              locationId: row.location_id,
              type: "Entertainment",
              details: row.details,
              originalData: row
            });
          });
        });
      }

      if (fundraisersData) {
        fundraisersData.forEach((row: any) => {
          unified.push({
            id: `fun-${row.id}`,
            title: row.organization,
            date: parseISO(row.event_date),
            locationId: row.location,
            type: "Fundraiser",
            status: row.status,
            originalData: row
          });
        });
      }

      if (storeEventsData) {
        storeEventsData.forEach((row: any) => {
          unified.push({
            id: `se-${row.id}`,
            title: row.organization,
            date: parseISO(row.event_date),
            locationId: row.location,
            type: "StoreEvent",
            status: row.status,
            originalData: row
          });
        });
      }

      if (largeResData) {
        largeResData.forEach((row: any) => {
          unified.push({
            id: `lr-${row.id}`,
            title: row.name,
            date: parseISO(row.event_date),
            locationId: row.location,
            type: "LargeReservation",
            status: row.status,
            originalData: row
          });
        });
      }

      if (cateringData) {
        cateringData.forEach((row: any) => {
          unified.push({
            id: `cat-${row.id}`,
            title: row.company || row.name,
            date: parseISO(row.event_date),
            locationId: row.location,
            type: "Catering",
            status: row.status,
            originalData: row
          });
        });
      }

      setEvents(unified);
      setIsLoading(false);
    };

    fetchAllEvents();
  }, []);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const filteredEvents = events.filter(e => {
    // Anything set to "All locations" (no store) shows for every store.
    if (selectedLocationId && e.locationId && e.locationId !== selectedLocationId) return false;
    if (filterLocation !== "all" && e.locationId && e.locationId !== filterLocation) return false;
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "confirmed" && e.status !== "Confirmed" && e.status !== "Completed" && e.type !== "Entertainment") return false;
      if (filterStatus === "requested" && e.status !== "Requested" && e.status !== "Waiting on you" && e.status !== "Waiting on the customer") return false;
    }
    return true;
  });

  const getEventStyle = (type: EventType) => {
    switch (type) {
      case "Entertainment": return "bg-purple-100 text-purple-800 border-purple-200";
      case "Fundraiser": return "bg-pink-100 text-pink-800 border-pink-200";
      case "StoreEvent": return "bg-orange-100 text-orange-800 border-orange-200";
      case "LargeReservation": return "bg-blue-100 text-blue-800 border-blue-200";
      case "Catering": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex flex-col h-full bg-card border rounded-lg overflow-hidden flex-1">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="py-2 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((day) => {
            const dayEvents = filteredEvents.filter(e => isSameDay(e.date, day));
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={day.toString()} 
                className={`
                  min-h-[120px] p-2 border-r border-b relative
                  ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : ""}
                  ${isToday(day) ? "bg-primary/5" : ""}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${isToday(day) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center -mt-1 -ml-1" : ""}`}>
                    {format(day, "d")}
                  </span>
                </div>

                <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[100px] no-scrollbar">
                  {dayEvents.map(e => (
                    <div 
                      key={e.id}
                      onClick={() => setViewingEvent(e)}
                      className={`text-xs px-1.5 py-1 rounded border font-medium truncate cursor-pointer hover:opacity-80 transition-opacity ${getEventStyle(e.type)}`}
                      title={`${e.title} (${e.type})`}
                    >
                      {filterLocation === "all" && <span className="font-bold mr-1">{locations.find(l => l.id === e.locationId)?.name?.substring(0,3)}</span>}
                      {e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Calendar</h1>
          <p className="text-muted-foreground mt-1">Unified view of all events across the organization.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <div className="flex items-center gap-4 mr-4">
          <h2 className="text-xl font-semibold w-40">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[180px] bg-background">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <SelectValue placeholder="All Locations" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="All Event Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            <SelectItem value="Entertainment">Entertainment</SelectItem>
            <SelectItem value="Fundraiser">Fundraisers</SelectItem>
            <SelectItem value="StoreEvent">Store Events</SelectItem>
            <SelectItem value="LargeReservation">Large Reservations</SelectItem>
            <SelectItem value="Catering">Catering</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="confirmed">Confirmed Only</SelectItem>
            <SelectItem value="requested">Requested Only</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="ml-auto flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div> Entertainment</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-pink-100 border border-pink-200"></div> Fundraisers</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div> Store Events</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div> Reservations</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div> Catering</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Loading master calendar...</p>
          </div>
        </div>
      ) : (
        renderCalendar()
      )}

      {/* View Event Sheet */}
      <Sheet open={!!viewingEvent} onOpenChange={(open) => !open && setViewingEvent(null)}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto border-l-0 shadow-2xl">
          {viewingEvent && (
            <>
              <div className="flex items-start justify-between pb-6 border-b shrink-0">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-2xl break-words">{viewingEvent.title}</SheetTitle>
                  <SheetDescription className="mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold mr-2 ${getEventStyle(viewingEvent.type)}`}>
                      {viewingEvent.type.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <strong className="text-foreground">{format(viewingEvent.date, "EEEE, MMMM do, yyyy")}</strong>
                  </SheetDescription>
                </div>
              </div>

              <div className="py-6 space-y-6">
                <div className="grid grid-cols-2 gap-6 bg-muted/10 p-5 rounded-xl border border-border/50">
                  {viewingEvent.status && (
                    <div>
                      <span className="text-xs text-muted-foreground mb-1 block">Status</span>
                      <div className="font-medium text-sm flex items-center h-8">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          viewingEvent.status === "Completed" || viewingEvent.status === "Confirmed" 
                            ? "bg-green-100 text-green-700 border-green-200" 
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        } border`}>
                          {viewingEvent.status}
                        </span>
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground mb-1 block">Location</span>
                    <div className="font-medium text-sm flex items-center h-8">
                      {locations.find(l => l.id === viewingEvent.locationId)?.name || "Unknown"}
                    </div>
                  </div>
                </div>

                {/* Common fields based on type */}
                {viewingEvent.type === "Entertainment" && (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold border-b pb-2">Timing</h3>
                      <div className="grid gap-3">
                        <div className="flex items-center text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                          <span>{format(storeClock(viewingEvent.originalData.start_date, tzForLocation(viewingEvent.originalData.location_id)), "h:mm a")} - {format(storeClock(viewingEvent.originalData.end_date, tzForLocation(viewingEvent.originalData.location_id)), "h:mm a")} {tzLabel(viewingEvent.originalData.start_date, tzForLocation(viewingEvent.originalData.location_id))}</span>
                        </div>
                      </div>
                    </div>
                    {viewingEvent.details && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Details
                        </h3>
                        <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100/50 text-sm text-foreground/80 whitespace-pre-wrap">
                          {viewingEvent.details}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {["Fundraiser", "StoreEvent", "LargeReservation", "Catering"].includes(viewingEvent.type) && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold border-b pb-2">Client Details</h3>
                    <div className="grid gap-3">
                      {viewingEvent.originalData.organization && (
                        <div className="flex items-center text-sm">
                          <Building className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                          <span>{viewingEvent.originalData.organization}</span>
                        </div>
                      )}
                      {(viewingEvent.originalData.email || viewingEvent.originalData.phone) && (
                        <>
                          <div className="flex items-center text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                            <a href={`mailto:${viewingEvent.originalData.email}`} className="hover:underline">{viewingEvent.originalData.email || "No email"}</a>
                          </div>
                          <div className="flex items-center text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                            <a href={`tel:${viewingEvent.originalData.phone}`} className="hover:underline">{viewingEvent.originalData.phone || "No phone"}</a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {["LargeReservation", "Catering"].includes(viewingEvent.type) && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold border-b pb-2">Event Timing & Guests</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewingEvent.originalData.time_start && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Time</span>
                          <div className="text-sm font-medium">
                            {formatTime12Hour(viewingEvent.originalData.time_start)} {viewingEvent.originalData.time_finish ? `- ${formatTime12Hour(viewingEvent.originalData.time_finish)}` : ''}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-xs text-muted-foreground block">Guest Count</span>
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {viewingEvent.originalData.guest_count || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {viewingEvent.originalData.notes && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Notes
                    </h3>
                    <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100/50 text-sm text-foreground/80 whitespace-pre-wrap">
                      {viewingEvent.originalData.notes}
                    </div>
                  </div>
                )}

                {(viewingEvent.originalData.total_sales > 0 || viewingEvent.originalData.quote_total > 0) && (
                  <div className="space-y-4 mt-8">
                    <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      Financials
                    </h3>
                    <div className="bg-muted/10 rounded-xl p-5 border space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-semibold text-lg">${Number(viewingEvent.originalData.total_sales || viewingEvent.originalData.quote_total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}