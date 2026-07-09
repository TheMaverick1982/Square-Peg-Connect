import { useState, useEffect } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, LayoutList, CalendarDays, Loader2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

export default function MasterCalendar() {
  const { selectedLocationId } = useLocationContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          unified.push({
            id: `ent-${row.id}`,
            title: row.title,
            date: parseISO(row.start_date),
            locationId: row.location_id,
            type: "Entertainment",
            details: row.details,
            originalData: row
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
    if (selectedLocationId && e.locationId !== selectedLocationId) return false;
    if (filterLocation !== "all" && e.locationId !== filterLocation) return false;
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
                      className={`text-xs px-1.5 py-1 rounded border font-medium truncate cursor-pointer ${getEventStyle(e.type)}`}
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
    </div>
  );
}