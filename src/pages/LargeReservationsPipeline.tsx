import { useState, useEffect } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import type { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { Search, Filter, Calendar as CalendarIcon, MapPin, Link as LinkIcon, DollarSign, Building, Phone, Mail, Plus, ChevronLeft, ChevronRight, LayoutList, CalendarDays, Edit2, Trash2, Users, Loader2, FileText, Download, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailLogs } from "@/components/EmailLogs";
import { ShareFormDialog } from "@/components/ShareFormDialog";

export interface LargeReservationOrder {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  locationId: string;
  eventDate: string;
  timeStart: string;
  timeFinish: string;
  guestCount: number;
  notes?: string;
  additionalStaffNeeded: boolean;
  additionalStaffCount: number;
  status: "Requested" | "Confirmed" | "Completed" | "Cancelled";
  totalSales: number;
  requiresRoom?: boolean;
  depositPaid?: boolean;
  depositAmount?: number;
  heardAboutUs?: string;
  createdAt: string;
}

// Safely parse YYYY-MM-DD strings from the DB into local dates
const parseSafeDate = (dateString: string) => {
  if (!dateString) return new Date();
  if (dateString.includes('T')) return new Date(dateString); // Handle ISO strings
  const [year, month, day] = dateString.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

// Convert 24h "14:30" to 12h "2:30 PM"
const formatTime12Hour = (time24?: string) => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

export default function LargeReservationsPipeline() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const [orders, setOrders] = useState<LargeReservationOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<"table" | "card" | "calendar">("table");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  // Sheet state
  const [viewingOrder, setViewingOrder] = useState<LargeReservationOrder | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "", email: "", phone: "", organization: "", notes: "", 
    locationId: "", eventDate: new Date(), timeStart: "", timeFinish: "", 
    guestCount: 0, additionalStaffNeeded: false, additionalStaffCount: 0,
    requiresRoom: false, depositPaid: false, depositAmount: 0
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [addFormData, setAddFormData] = useState({
    name: "", email: "", phone: "", organization: "", notes: "", locationId: "",
    timeStart: "", timeFinish: "", guestCount: 0, additionalStaffNeeded: false, additionalStaffCount: 0,
    requiresRoom: false, depositPaid: false, depositAmount: 0
  });
  const [addFormDate, setAddFormDate] = useState<Date | undefined>(undefined);

  // Edit state for sales
  const [salesInput, setSalesInput] = useState("");

  // Inline edit state for staffing
  const [isStaffEditMode, setIsStaffEditMode] = useState(false);
  const [staffEditData, setStaffEditData] = useState({ needed: false, count: 0 });

  const [isSendingDetails, setIsSendingDetails] = useState(false);

  // Export state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(undefined);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('large_reservations')
      .select('*')
      .is('deleted_at', null)
      .order('event_date', { ascending: true });

    if (error) {
      console.error("Error fetching orders:", error);
      toast({ title: "Error", description: "Could not load reservations.", variant: "destructive" });
    } else if (data) {
      const mappedOrders: LargeReservationOrder[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email || "",
        phone: row.phone || "",
        organization: row.organization || "",
        notes: row.notes,
        locationId: row.location,
        eventDate: row.event_date,
        timeStart: row.time_start || "",
        timeFinish: row.time_finish || "",
        guestCount: row.guest_count || 0,
        additionalStaffNeeded: row.additional_staff_needed || false,
        additionalStaffCount: row.additional_staff_count || 0,
        status: row.status as "Requested" | "Confirmed" | "Completed" | "Cancelled",
        totalSales: parseFloat(row.total_sales || 0),
        requiresRoom: row.requires_room || false,
        depositPaid: row.deposit_paid || false,
        depositAmount: parseFloat(row.deposit_amount || 0),
        heardAboutUs: row.heard_about_us || "",
        createdAt: row.created_at,
      }));
      setOrders(mappedOrders);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleExportCSV = () => {
    let dataToExport = sortedOrders;

    if (exportDateRange?.from) {
      const from = exportDateRange.from;
      const to = exportDateRange.to || exportDateRange.from;
      // Normalizing to start/end of day
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);

      dataToExport = dataToExport.filter(o => {
        const d = parseSafeDate(o.eventDate);
        return d >= start && d <= end;
      });
    }

    if (dataToExport.length === 0) {
      toast({ title: "No data", description: "There are no reservations in the selected range to export.", variant: "destructive" });
      return;
    }

    const headers = [
      "Client Name", 
      "Organization", 
      "Location", 
      "Event Date", 
      "Start Time", 
      "End Time", 
      "Guest Count", 
      "Additional Staff Needed", 
      "Additional Staff Count", 
      "Email", 
      "Phone", 
      "Notes", 
      "Status",
      "Created At"
    ];
    
    const rows = dataToExport.map(o => [
      o.name,
      o.organization || "",
      locations.find(l => l.id === o.locationId)?.name || "Unknown",
      format(parseSafeDate(o.eventDate), "yyyy-MM-dd"),
      formatTime12Hour(o.timeStart) || "",
      formatTime12Hour(o.timeFinish) || "",
      o.guestCount,
      o.additionalStaffNeeded ? "Yes" : "No",
      o.additionalStaffCount || 0,
      o.email || "",
      o.phone || "",
      o.notes || "",
      o.status,
      format(new Date(o.createdAt), "yyyy-MM-dd")
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `large-reservations-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDialogOpen(false);
  };

  const handleEmailDetailsToLocation = async () => {
    if (!viewingOrder) return;
    setIsSendingDetails(true);

    const location = locations.find(l => l.id === viewingOrder.locationId) || locations[0];

    const { data, error } = await supabase.functions.invoke('send-large-reservation-details', {
      body: {
        order: viewingOrder,
        location
      }
    });

    setIsSendingDetails(false);

    if (error || data?.error) {
      toast({ title: "Email Failed", description: data?.error || error?.message, variant: "destructive" });
      return;
    }

    toast({ title: "Details Sent!", description: `Reservation details have been emailed to ${location.name}.` });
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('large_reservations')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.error("Error updating status:", error);
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
      return;
    }

    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
    
    if (viewingOrder && viewingOrder.id === orderId) {
      setViewingOrder({ ...viewingOrder, status: newStatus as any });
      if (newStatus === "Completed") {
        setSalesInput(viewingOrder.totalSales.toString());
      }
    }
    
    toast({ title: "Status Updated", description: `Order status changed to ${newStatus}.` });
  };

  const handleSaveFinancials = async () => {
    if (!viewingOrder) return;
    
    const sales = parseFloat(salesInput) || 0;

    const { error } = await supabase
      .from('large_reservations')
      .update({ total_sales: sales })
      .eq('id', viewingOrder.id);

    if (error) {
      toast({ title: "Error", description: "Could not save financials.", variant: "destructive" });
      return;
    }

    setOrders(orders.map(o => o.id === viewingOrder.id ? { ...o, totalSales: sales } : o));
    setViewingOrder({ ...viewingOrder, totalSales: sales });
    toast({ title: "Saved", description: "Financials updated successfully." });
  };

  const handleSaveStaffing = async () => {
    if (!viewingOrder) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from('large_reservations')
      .update({
        additional_staff_needed: staffEditData.needed,
        additional_staff_count: staffEditData.count
      })
      .eq('id', viewingOrder.id);

    setIsUpdating(false);

    if (error) {
      toast({ title: "Error", description: "Failed to update staffing details.", variant: "destructive" });
      return;
    }

    const updatedOrder = {
      ...viewingOrder,
      additionalStaffNeeded: staffEditData.needed,
      additionalStaffCount: staffEditData.count
    };

    setOrders(orders.map(o => o.id === viewingOrder.id ? updatedOrder : o));
    setViewingOrder(updatedOrder);
    setIsStaffEditMode(false);
    toast({ title: "Updated", description: "Staffing details saved successfully." });
  };

  const handleUpdateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingOrder) return;
    setIsUpdating(true);

    const formattedDate = format(editFormData.eventDate, 'yyyy-MM-dd');

    const { error } = await supabase
      .from('large_reservations')
      .update({
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        organization: editFormData.organization,
        notes: editFormData.notes,
        location: editFormData.locationId,
        event_date: formattedDate,
        time_start: editFormData.timeStart,
        time_finish: editFormData.timeFinish,
        guest_count: editFormData.guestCount,
        additional_staff_needed: editFormData.additionalStaffNeeded,
        additional_staff_count: editFormData.additionalStaffCount,
        requires_room: editFormData.requiresRoom,
        deposit_paid: editFormData.depositPaid,
        deposit_amount: editFormData.depositAmount
      })
      .eq('id', viewingOrder.id);

    setIsUpdating(false);

    if (error) {
      toast({ title: "Error", description: "Failed to update reservation details.", variant: "destructive" });
      return;
    }

    const updatedOrder = {
      ...viewingOrder,
      name: editFormData.name,
      email: editFormData.email,
      phone: editFormData.phone,
      organization: editFormData.organization,
      notes: editFormData.notes,
      locationId: editFormData.locationId,
      eventDate: formattedDate,
      timeStart: editFormData.timeStart,
      timeFinish: editFormData.timeFinish,
      guestCount: editFormData.guestCount,
      additionalStaffNeeded: editFormData.additionalStaffNeeded,
      additionalStaffCount: editFormData.additionalStaffCount,
      requiresRoom: editFormData.requiresRoom,
      depositPaid: editFormData.depositPaid,
      depositAmount: editFormData.depositAmount
    };

    setOrders(orders.map(o => o.id === viewingOrder.id ? updatedOrder : o));
    setViewingOrder(updatedOrder);
    setIsEditMode(false);
    toast({ title: "Updated", description: "Reservation details saved successfully." });
  };

  const handleDeleteReservation = async (id: string) => {
    const { error } = await supabase.from('large_reservations').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Could not delete the reservation.", variant: "destructive" });
      return;
    }
    setOrders(orders.filter(o => o.id !== id));
    setViewingOrder(null);
    toast({ title: "Deleted", description: "Reservation has been removed." });
  };

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormDate) {
      toast({ title: "Date required", description: "Please select a preferred event date." });
      return;
    }

    setIsAdding(true);
    
    const loc = addFormData.locationId || selectedLocationId || locations[0].id;
    const formattedDate = format(addFormDate, 'yyyy-MM-dd');

    const { data, error } = await supabase.from('large_reservations').insert([{
      name: addFormData.name,
      email: addFormData.email,
      phone: addFormData.phone,
      organization: addFormData.organization,
      notes: addFormData.notes,
      location: loc,
      event_date: formattedDate,
      time_start: addFormData.timeStart,
      time_finish: addFormData.timeFinish,
      guest_count: addFormData.guestCount,
      additional_staff_needed: addFormData.additionalStaffNeeded,
      additional_staff_count: addFormData.additionalStaffCount,
      requires_room: addFormData.requiresRoom,
      deposit_paid: addFormData.depositPaid,
      deposit_amount: addFormData.depositAmount,
      status: 'Confirmed'
    }]).select().single();

    
    // Sync to CRM
    const { error: crmError } = await supabase.from('b2b_contacts').insert([{
      location_id: loc,
      organization_name: addFormData.organization || "No Org Provided",
      contact_name: addFormData.name,
      email: addFormData.email,
      phone: addFormData.phone,
      category: 'Reservation'
    }]);
    if (crmError) console.error("Error syncing to CRM:", crmError);

    setIsAdding(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      toast({ title: "Success", description: "Reservation manually added." });
      setOrders([...orders, {
        id: data.id,
        name: data.name,
        email: data.email || "",
        phone: data.phone || "",
        organization: data.organization || "",
        notes: data.notes,
        locationId: data.location,
        eventDate: data.event_date,
        timeStart: data.time_start || "",
        timeFinish: data.time_finish || "",
        guestCount: data.guest_count || 0,
        additionalStaffNeeded: data.additional_staff_needed || false,
        additionalStaffCount: data.additional_staff_count || 0,
        requiresRoom: data.requires_room || false,
        depositPaid: data.deposit_paid || false,
        depositAmount: parseFloat(data.deposit_amount || 0),
        heardAboutUs: data.heard_about_us || "",
        status: data.status,
        totalSales: 0,
        createdAt: data.created_at,
      }].sort((a, b) => parseSafeDate(a.eventDate).getTime() - parseSafeDate(b.eventDate).getTime()));
      setIsAddSheetOpen(false);
      setAddFormData({ name: "", email: "", phone: "", organization: "", notes: "", locationId: "", timeStart: "", timeFinish: "", guestCount: 0, additionalStaffNeeded: false, additionalStaffCount: 0, requiresRoom: false, depositPaid: false, depositAmount: 0 });
      setAddFormDate(undefined);
    }
  };

  // Filter by location and search
  const filteredOrders = orders.filter(order => {
    if (selectedLocationId && order.locationId !== selectedLocationId) return false;
    if (filterLocation !== "all" && order.locationId !== filterLocation) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!order.organization.toLowerCase().includes(q) &&
          !order.name.toLowerCase().includes(q) &&
          !order.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortOrder === "newest") {
      return parseSafeDate(b.eventDate).getTime() - parseSafeDate(a.eventDate).getTime();
    } else {
      return parseSafeDate(a.eventDate).getTime() - parseSafeDate(b.eventDate).getTime();
    }
  });

  // Extract unique organizations for autofill dropdown
  const uniqueOrgs = orders.reduce((acc, current) => {
    const key = current.organization || current.name;
    const x = acc.find(item => (item.organization || item.name) === key);
    if (!x && key) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as LargeReservationOrder[]);

  const getStatusPillClass = (status: string) => {
    switch (status) {
      case "Requested": return "status-pill waiting";
      case "Confirmed": return "status-pill confirmed";
      case "Completed": return "status-pill complete";
      case "Cancelled": return "status-pill cancelled bg-red-100 text-red-800 border-red-200";
      default: return "status-pill waiting";
    }
  };

  const renderCalendarView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const dateFormat = "d";
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Calendar specific filtering
    const calendarFilteredOrders = filteredOrders.filter(order => {
      if (filterLocation !== "all" && order.locationId !== filterLocation) return false;
      if (filterStatus !== "all") {
        if (filterStatus === "booked" && !order) return false;
        if (filterStatus === "available" && order) return false; 
      }
      return true;
    });

    return (
      <div className="flex flex-col h-full bg-card border rounded-lg overflow-hidden flex-1">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold w-48">{format(currentMonth, "MMMM yyyy")}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="booked">Booked Only</SelectItem>
                <SelectItem value="available">Available Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="py-2 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((day, idx) => {
            const dayOrders = calendarFilteredOrders.filter(o => isSameDay(parseSafeDate(o.eventDate), day));
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            const totalLocations = locations.length;
            const bookedCount = dayOrders.length;
            const availableCount = totalLocations - bookedCount;

            // Apply filters at the cell level for visual clarity
            let cellOpacity = "opacity-100";
            if (filterStatus === "booked" && dayOrders.length === 0) cellOpacity = "opacity-30 grayscale";
            if (filterStatus === "available" && filterLocation !== "all" && dayOrders.length > 0) cellOpacity = "opacity-30 grayscale";
            if (filterStatus === "available" && filterLocation === "all" && availableCount === 0) cellOpacity = "opacity-30 grayscale";

            return (
              <div 
                key={day.toString()} 
                className={`
                  min-h-[120px] p-2 border-r border-b relative
                  ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : ""}
                  ${isToday(day) ? "bg-primary/5" : ""}
                  ${dayOrders.length > 0 && isCurrentMonth ? "bg-blue-50/30" : ""}
                  ${cellOpacity}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${isToday(day) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center -mt-1 -ml-1" : ""}`}>
                    {format(day, dateFormat)}
                  </span>
                </div>

                {isCurrentMonth && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {filterLocation !== "all" ? (
                      // Single Location View
                      dayOrders.length > 0 ? (
                        <div 
                          className="text-xs p-1.5 bg-primary/10 text-primary border border-primary/20 rounded cursor-pointer hover:bg-primary/20 transition-colors font-medium truncate"
                          onClick={() => {
                            setViewingOrder(dayOrders[0]);
                            setSalesInput(dayOrders[0].totalSales.toString());
                          }}
                          title={dayOrders[0].name}
                        >
                          {dayOrders[0].name} ({dayOrders[0].guestCount})
                        </div>
                      ) : (
                        <div 
                          className="text-xs p-1.5 bg-green-500/10 text-green-700 border border-green-500/20 rounded cursor-pointer hover:bg-green-500/20 transition-colors font-medium text-center border-dashed"
                          onClick={() => {
                            setAddFormData({...addFormData, locationId: filterLocation});
                            setAddFormDate(day);
                            setIsAddSheetOpen(true);
                          }}
                        >
                          Available
                        </div>
                      )
                    ) : (
                      // All Locations View
                      <div className="space-y-1">
                        {bookedCount > 0 && (
                          <div className="text-xs font-medium text-primary">
                            {bookedCount} Booked
                            <div className="flex flex-col gap-1 mt-1">
                              {dayOrders.slice(0, 2).map(o => (
                                <div 
                                  key={o.id} 
                                  className="truncate bg-primary/10 px-1.5 py-1 rounded border border-primary/10 cursor-pointer hover:bg-primary/20"
                                  onClick={() => {
                                    setViewingOrder(o);
                                    setSalesInput(o.totalSales.toString());
                                  }}
                                  title={`${locations.find(l => l.id === o.locationId)?.name}: ${o.name}`}
                                >
                                  <span className="font-semibold">{locations.find(l => l.id === o.locationId)?.name?.substring(0, 3)}:</span> {o.name}
                                </div>
                              ))}
                              {dayOrders.length > 2 && (
                                <div className="text-[10px] text-muted-foreground px-1">+{dayOrders.length - 2} more</div>
                              )}
                            </div>
                          </div>
                        )}
                        {availableCount > 0 && (
                          <div 
                            className="text-xs font-medium text-green-600 bg-green-500/10 px-1.5 py-1 rounded border border-green-500/20 border-dashed cursor-pointer hover:bg-green-500/20 mt-1"
                            onClick={() => {
                              setAddFormData({...addFormData, locationId: ""});
                              setAddFormDate(day);
                              setIsAddSheetOpen(true);
                            }}
                          >
                            {availableCount} Available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
          <h1 className="text-3xl font-bold tracking-tight">Large Reservations</h1>
          <p className="text-muted-foreground mt-1">Manage incoming reservation requests and internal staffing.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 shadow-sm" onClick={() => setIsExportDialogOpen(true)}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="outline" className="gap-2 shadow-sm" onClick={() => {
            const url = `${window.location.origin}${import.meta.env.BASE_URL}public/large-reservations`.replace(/([^:]\/)\/+/g, "$1");
            navigator.clipboard.writeText(url);
            toast({ title: "Copied!", description: "Booking link copied to clipboard." });
          }}>
            <LinkIcon className="w-4 h-4" />
            Copy Link
          </Button>
          <ShareFormDialog formTitle="Large Reservations Form" formPath="/public/large-reservations" />
          <Button className="gap-2 shadow-sm" onClick={() => setIsAddSheetOpen(true)}>
            <Plus className="w-4 h-4" />
            New Reservation
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search reservations..." 
              className="pl-9 w-[250px] bg-background" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-[200px] bg-background">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Upcoming First</SelectItem>
              <SelectItem value="oldest">Past First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center bg-muted p-1 rounded-lg">
          <Button 
            variant={viewMode === "table" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => setViewMode("table")}
          >
            <LayoutList className="w-4 h-4 mr-2" />
            Columns
          </Button>
          <Button 
            variant={viewMode === "card" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => setViewMode("card")}
          >
            <LayoutList className="w-4 h-4 mr-2" />
            Cards
          </Button>
          <Button 
            variant={viewMode === "calendar" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Calendar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Loading reservations...</p>
          </div>
        </div>
      ) : viewMode === "calendar" ? (
        renderCalendarView()
      ) : viewMode === "table" ? (
        <div className="bg-card border rounded-lg overflow-hidden flex flex-col flex-1 min-w-0">
          <div className="overflow-x-auto h-full flex flex-col">
            <div className="min-w-[1000px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              <div className="col-span-2">Date & Time</div>
              <div className="col-span-2">Client / Org</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Guests & Staffing</div>
              <div className="col-span-2">Contact</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y min-w-[1000px]">
              {sortedOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p>No reservations found.</p>
                </div>
              ) : (
                sortedOrders.map(order => (
                  <div key={order.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors">
                    <div className="col-span-2 min-w-0">
                      <div className="font-semibold text-sm">{format(parseSafeDate(order.eventDate), "EEEE, MMMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatTime12Hour(order.timeStart) || 'TBD'} - {formatTime12Hour(order.timeFinish) || 'TBD'}</div>
                      {order.requiresRoom && (
                        <div className="text-[10px] bg-muted/50 border border-border mt-1 w-fit px-1.5 py-0.5 rounded">
                           {order.locationId === "loc-7" ? "Banquet Room" : "Private Dining"} Required
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="font-medium text-sm truncate">{order.name}</div>
                      {order.organization && <div className="text-xs text-muted-foreground truncate">{order.organization}</div>}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-sm truncate">{locations.find(l => l.id === order.locationId)?.name}</div>
                      {order.depositPaid && (
                        <div className="text-xs text-green-600 font-medium mt-0.5">Deposit: ${order.depositAmount}</div>
                      )}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-sm font-medium">{order.guestCount} Guests</div>
                      {order.additionalStaffNeeded && <div className="text-xs text-primary">{order.additionalStaffCount} Extra Staff</div>}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-sm truncate">{order.phone || order.email}</div>
                    </div>
                    <div className="col-span-1">
                      <span className={getStatusPillClass(order.status)}>{order.status}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setViewingOrder(order);
                        setSalesInput(order.totalSales.toString());
                        setIsEditMode(false);
                      }}>
                        View
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {sortedOrders.length === 0 ? (
            <div className="col-span-full py-12 text-center border rounded-lg bg-muted/20 border-dashed">
              <CalendarIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">No reservations found</h3>
              <p className="text-muted-foreground mt-1 text-sm">There are no matching reservations for your current filters.</p>
            </div>
          ) : (
            sortedOrders.map(order => (
              <div 
                key={order.id} 
                className="bg-card border rounded-lg p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col"
                onClick={() => {
                  setViewingOrder(order);
                  setSalesInput(order.totalSales.toString());
                  setIsEditMode(false);
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={getStatusPillClass(order.status)}>
                    {order.status}
                  </div>
                  <div className="text-xs font-medium bg-muted px-2 py-1 rounded-md flex items-center gap-1.5 text-muted-foreground">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {format(parseSafeDate(order.eventDate), "EEEE, MMMM d, yyyy")}
                  </div>
                </div>

                <h3 className="font-semibold text-lg line-clamp-1 mb-1 group-hover:text-primary transition-colors">{order.name}</h3>
                {order.organization && <p className="text-sm text-muted-foreground line-clamp-1">{order.organization}</p>}
                
                <div className="mt-4 space-y-2.5 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 shrink-0 text-foreground/40" />
                    <span className="truncate">{locations.find(l => l.id === order.locationId)?.name}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-2 shrink-0 text-foreground/40" />
                    <span className="truncate">{order.guestCount} Guests</span>
                  </div>
                  {order.additionalStaffNeeded && (
                    <div className="flex items-center text-sm text-primary font-medium">
                      <Users className="w-4 h-4 mr-2 shrink-0 opacity-70" />
                      <span className="truncate">{order.additionalStaffCount} Extra Staff Needed</span>
                    </div>
                  )}
                  {(order.timeStart || order.timeFinish) && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <CalendarDays className="w-4 h-4 mr-2 shrink-0 text-foreground/40" />
                      <span className="truncate">{formatTime12Hour(order.timeStart)} {order.timeFinish ? `- ${formatTime12Hour(order.timeFinish)}` : ''}</span>
                    </div>
                  )}
                  {order.requiresRoom && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Building className="w-4 h-4 mr-2 shrink-0 text-foreground/40" />
                      <span className="truncate">
                        {order.locationId === "loc-7" ? "Banquet Room" : "Private Dining"} Required
                      </span>
                    </div>
                  )}
                  {order.depositPaid && (
                    <div className="flex items-center text-sm text-green-600 font-medium">
                      <DollarSign className="w-4 h-4 mr-2 shrink-0 opacity-70" />
                      <span className="truncate">Deposit Paid (${order.depositAmount})</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-muted-foreground">
                  <span className="truncate pr-2">{order.email || order.phone}</span>
                  <span className="text-xs shrink-0 whitespace-nowrap bg-muted/50 px-2 py-1 rounded">
                    {format(new Date(order.createdAt), "MMM d")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* View/Edit Sheet */}
      <Sheet open={!!viewingOrder} onOpenChange={(open) => {
        if (!open) {
          setViewingOrder(null);
          setIsEditMode(false);
          setIsStaffEditMode(false);
        }
      }}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto border-l-0 shadow-2xl">
          {viewingOrder && (
            <>
              {/* Header Container */}
              <div className="flex items-start justify-between pb-6 border-b shrink-0">
                {!isEditMode ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="text-2xl break-words">{viewingOrder.name}</SheetTitle>
                      <SheetDescription className="mt-1">
                        Event Date: <strong className="text-foreground">{format(parseSafeDate(viewingOrder.eventDate), "EEEE, MMMM do, yyyy")}</strong>
                      </SheetDescription>
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
                      <Button variant="outline" size="icon" title="Email Details to Store" disabled={isSendingDetails} onClick={handleEmailDetailsToLocation}>
                        {isSendingDetails ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Send className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => {
                        setEditFormData({
                          name: viewingOrder.name,
                          email: viewingOrder.email || "",
                          phone: viewingOrder.phone || "",
                          organization: viewingOrder.organization || "",
                          notes: viewingOrder.notes || "",
                          locationId: viewingOrder.locationId,
                          eventDate: parseSafeDate(viewingOrder.eventDate),
                          timeStart: viewingOrder.timeStart,
                          timeFinish: viewingOrder.timeFinish,
                          guestCount: viewingOrder.guestCount,
                          additionalStaffNeeded: viewingOrder.additionalStaffNeeded,
                          additionalStaffCount: viewingOrder.additionalStaffCount,
                          requiresRoom: viewingOrder.requiresRoom || false,
                          depositPaid: viewingOrder.depositPaid || false,
                          depositAmount: viewingOrder.depositAmount || 0
                        });
                        setIsEditMode(true);
                        setIsStaffEditMode(false);
                      }}>
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10 border-destructive/20">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will archive the large reservation. This action can be undone by an administrator if needed, but it will be hidden from the active pipeline.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteReservation(viewingOrder.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Reservation
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0 flex-1">
                    <SheetTitle>Edit Reservation</SheetTitle>
                    <SheetDescription>Update the reservation details below.</SheetDescription>
                  </div>
                )}
              </div>

              <div className="py-6 space-y-8">
                
                {isEditMode ? (
                  // EDIT MODE FORM
                  <form id="edit-reservation-form" onSubmit={handleUpdateReservation} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Client Name</Label>
                        <Input required value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
                      </div>

                      <div className="space-y-2">
                        <Label>Organization (Optional)</Label>
                        <Input value={editFormData.organization} onChange={(e) => setEditFormData({...editFormData, organization: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={editFormData.email} onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input type="tel" value={editFormData.phone} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid gap-4 bg-muted/20 p-4 rounded-lg border text-sm">
                        <div className="space-y-2 flex flex-col">
                          <Label>Event Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal bg-background",
                                  !editFormData.eventDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editFormData.eventDate ? format(editFormData.eventDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={editFormData.eventDate}
                                onSelect={(date) => date && setEditFormData({...editFormData, eventDate: date})}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input type="time" value={editFormData.timeStart} onChange={(e) => setEditFormData({...editFormData, timeStart: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input type="time" value={editFormData.timeFinish} onChange={(e) => setEditFormData({...editFormData, timeFinish: e.target.value})} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Guest Count</Label>
                          <Input type="number" min="0" value={editFormData.guestCount} onChange={(e) => setEditFormData({...editFormData, guestCount: parseInt(e.target.value) || 0})} />
                        </div>

                        <div className="space-y-2">
                          <Label>Location</Label>
                          <Select value={editFormData.locationId} onValueChange={(val) => setEditFormData({...editFormData, locationId: val})}>
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid gap-4 bg-primary/5 p-4 rounded-lg border border-primary/10 text-sm">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-primary">Additional Staff?</Label>
                          <Switch 
                            checked={editFormData.additionalStaffNeeded} 
                            onCheckedChange={(checked) => setEditFormData({...editFormData, additionalStaffNeeded: checked, additionalStaffCount: checked && editFormData.additionalStaffCount === 0 ? 1 : editFormData.additionalStaffCount})}
                          />
                        </div>
                        {editFormData.additionalStaffNeeded && (
                          <div className="space-y-2">
                            <Label>How many additional staff?</Label>
                            <Input type="number" min="1" value={editFormData.additionalStaffCount} onChange={(e) => setEditFormData({...editFormData, additionalStaffCount: parseInt(e.target.value) || 0})} />
                          </div>
                        )}
                      </div>

                      {(editFormData.locationId === "loc-7" || editFormData.locationId === "loc-5") && (
                        <div className="grid gap-4 bg-muted/20 p-4 rounded-lg border text-sm">
                          <div className="flex items-center justify-between">
                            <Label className="font-semibold text-foreground">
                              {editFormData.locationId === "loc-7" ? "Banquet Room Required?" : "Private Dining Room Required?"}
                            </Label>
                            <Switch 
                              checked={editFormData.requiresRoom} 
                              onCheckedChange={(checked) => setEditFormData({...editFormData, requiresRoom: checked})}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <Label className="font-semibold text-foreground">Deposit Paid?</Label>
                            <Switch 
                              checked={editFormData.depositPaid} 
                              onCheckedChange={(checked) => setEditFormData({...editFormData, depositPaid: checked})}
                            />
                          </div>
                          {editFormData.depositPaid && (
                            <div className="space-y-2">
                              <Label>Deposit Amount ($)</Label>
                              <Input type="number" step="0.01" min="0" value={editFormData.depositAmount} onChange={(e) => setEditFormData({...editFormData, depositAmount: parseFloat(e.target.value) || 0})} />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes & Requests</Label>
                        <Textarea rows={4} value={editFormData.notes} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setIsEditMode(false)}>Cancel</Button>
                      <Button type="submit" disabled={isUpdating}>
                        {isUpdating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  // READ-ONLY VIEW
                  <>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6 bg-muted/10 p-5 rounded-xl border border-border/50">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                          <Select value={viewingOrder.status} onValueChange={(val) => updateOrderStatus(viewingOrder.id, val)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Requested">Requested</SelectItem>
                              <SelectItem value="Confirmed">Confirmed</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
                          <div className="font-medium text-sm flex items-center h-8">
                            {locations.find(l => l.id === viewingOrder.locationId)?.name}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold border-b pb-2">Client Details</h3>
                        <div className="grid gap-3">
                          <div className="flex items-center text-sm">
                            <Building className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                            <span>{viewingOrder.organization || <span className="text-muted-foreground italic">No organization provided</span>}</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                            <a href={`mailto:${viewingOrder.email}`} className="hover:underline">{viewingOrder.email || "No email"}</a>
                          </div>
                          <div className="flex items-center text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
                            <a href={`tel:${viewingOrder.phone}`} className="hover:underline">{viewingOrder.phone || "No phone"}</a>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold border-b pb-2">Event Timing & Guests</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                             <Label className="text-xs text-muted-foreground block">Time</Label>
                             <div className="text-sm font-medium">
                               {formatTime12Hour(viewingOrder.timeStart) || 'TBD'} - {formatTime12Hour(viewingOrder.timeFinish) || 'TBD'}
                             </div>
                           </div>
                           <div>
                             <Label className="text-xs text-muted-foreground block">Guest Count</Label>
                             <div className="text-sm font-medium flex items-center gap-1.5">
                               <Users className="w-4 h-4 text-muted-foreground" />
                               {viewingOrder.guestCount}
                             </div>
                           </div>
                        </div>
                      </div>

                      {(viewingOrder.locationId === "loc-7" || viewingOrder.locationId === "loc-5") && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold border-b pb-2">Room & Deposit</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground block">
                                {viewingOrder.locationId === "loc-7" ? "Banquet Room Required" : "Private Dining Required"}
                              </Label>
                              <div className="text-sm font-medium">
                                {viewingOrder.requiresRoom ? "Yes" : "No"}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground block">Deposit Status</Label>
                              <div className="text-sm font-medium">
                                {viewingOrder.depositPaid ? (
                                  <span className="text-green-600">Paid (${viewingOrder.depositAmount})</span>
                                ) : (
                                  <span className="text-muted-foreground">Pending / Not Paid</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {viewingOrder.heardAboutUs && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold border-b pb-2">Lead Attribution</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground block">How did you hear about us?</Label>
                              <div className="text-sm font-medium">{viewingOrder.heardAboutUs}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {viewingOrder.notes && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            Notes & Special Requests
                          </h3>
                          <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100/50 text-sm text-foreground/80 whitespace-pre-wrap">
                            {viewingOrder.notes}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-sm font-semibold">Additional Staff?</h3>
                          {!isStaffEditMode && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                              setStaffEditData({
                                needed: viewingOrder.additionalStaffNeeded,
                                count: viewingOrder.additionalStaffCount || 1
                              });
                              setIsStaffEditMode(true);
                            }}>
                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                        
                        {isStaffEditMode ? (
                          <div className="p-4 rounded-lg border bg-muted/10 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="font-semibold">Additional Staff Needed?</Label>
                              <Switch 
                                checked={staffEditData.needed} 
                                onCheckedChange={(checked) => setStaffEditData({...staffEditData, needed: checked})}
                              />
                            </div>
                            {staffEditData.needed && (
                              <div className="space-y-2">
                                <Label>How many additional staff?</Label>
                                <Input type="number" min="1" value={staffEditData.count} onChange={(e) => setStaffEditData({...staffEditData, count: parseInt(e.target.value) || 0})} />
                              </div>
                            )}
                            <div className="flex gap-2 justify-end pt-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => setIsStaffEditMode(false)}>Cancel</Button>
                              <Button type="button" size="sm" disabled={isUpdating} onClick={handleSaveStaffing}>
                                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className={`p-4 rounded-lg border text-sm ${viewingOrder.additionalStaffNeeded ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'}`}>
                            {viewingOrder.additionalStaffNeeded ? (
                              <div className="flex justify-between font-medium">
                                <span>Additional Staff Required:</span>
                                <span>{viewingOrder.additionalStaffCount} Staff Member(s)</span>
                              </div>
                            ) : (
                              <span>No additional staff required.</span>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Past Activity */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        Past Activity for {viewingOrder.organization || viewingOrder.name}
                      </h3>
                      <div className="space-y-3">
                        {orders
                          .filter(o => (o.email === viewingOrder.email || (o.organization === viewingOrder.organization && o.organization)) && o.id !== viewingOrder.id)
                          .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
                          .map(pastEvent => (
                            <div key={pastEvent.id} className="bg-muted/10 p-3 rounded-lg border text-sm flex justify-between items-center">
                              <div>
                                <div className="font-medium">{format(new Date(pastEvent.eventDate), "MMM d, yyyy")}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {locations.find(l => l.id === pastEvent.locationId)?.name || 'Unknown Location'}
                                </div>
                              </div>
                              <div className="text-right">
                                {pastEvent.status === "Completed" ? (
                                  <div className="font-semibold text-primary">${pastEvent.totalSales.toLocaleString()} Sales</div>
                                ) : (
                                  <div className="text-muted-foreground italic text-xs">{pastEvent.status}</div>
                                )}
                              </div>
                            </div>
                        ))}
                        {orders.filter(o => (o.email === viewingOrder.email || (o.organization === viewingOrder.organization && o.organization)) && o.id !== viewingOrder.id).length === 0 && (
                          <div className="text-sm text-muted-foreground italic bg-muted/10 p-4 rounded-lg border text-center">
                            No previous activity found.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Email Automations Log */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        Communication History
                      </h3>
                      <EmailLogs eventId={viewingOrder.id} eventType="Large Reservation" />
                    </div>

                    {viewingOrder.status === "Completed" && (
                      <div className="space-y-4 mt-8">
                        <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          Event Performance
                        </h3>
                        <div className="bg-muted/10 rounded-xl p-5 border space-y-4">
                          <div className="space-y-2">
                            <Label>Total Sales ($)</Label>
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={salesInput} 
                              onChange={(e) => setSalesInput(e.target.value)} 
                            />
                          </div>
                          <Button className="w-full" onClick={handleSaveFinancials}>
                            Save Financials
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add New Sheet */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto border-l-0 shadow-2xl">
          <SheetHeader className="pb-6 border-b mb-6">
            <SheetTitle>New Large Reservation</SheetTitle>
            <SheetDescription>Manually enter a reservation into the system.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAddReservation} className="space-y-6">
            {uniqueOrgs.length > 0 && (
              <div className="space-y-2 mb-4">
                <Label className="text-muted-foreground text-xs uppercase font-semibold">Autofill from past client</Label>
                <Select onValueChange={(val) => {
                  const existing = uniqueOrgs.find(o => o.id === val);
                  if (existing) {
                    setAddFormData({
                      ...addFormData, 
                      organization: existing.organization || "",
                      name: existing.name || "",
                      email: existing.email || "",
                      phone: existing.phone || "",
                      notes: existing.notes || "",
                    });
                  }
                }}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder="Select an existing client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueOrgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.organization ? `${org.organization} (${org.name})` : org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase">Or enter details</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input required value={addFormData.name} onChange={(e) => setAddFormData({...addFormData, name: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Organization (Optional)</Label>
              <Input value={addFormData.organization} onChange={(e) => setAddFormData({...addFormData, organization: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={addFormData.email} onChange={(e) => setAddFormData({...addFormData, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={addFormData.phone} onChange={(e) => setAddFormData({...addFormData, phone: e.target.value})} />
              </div>
            </div>

            <div className="grid gap-4 bg-muted/20 p-4 rounded-lg border text-sm">
              <div className="space-y-2 flex flex-col">
                <Label>Event Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !addFormDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {addFormDate ? format(addFormDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={addFormDate}
                      onSelect={setAddFormDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={addFormData.timeStart} onChange={(e) => setAddFormData({...addFormData, timeStart: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={addFormData.timeFinish} onChange={(e) => setAddFormData({...addFormData, timeFinish: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Guest Count</Label>
                <Input type="number" min="0" value={addFormData.guestCount} onChange={(e) => setAddFormData({...addFormData, guestCount: parseInt(e.target.value) || 0})} />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={addFormData.locationId || selectedLocationId || locations[0].id} onValueChange={(val) => setAddFormData({...addFormData, locationId: val})}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 bg-primary/5 p-4 rounded-lg border border-primary/10 text-sm">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-primary">Additional Staff?</Label>
                <Switch 
                  checked={addFormData.additionalStaffNeeded} 
                  onCheckedChange={(checked) => setAddFormData({...addFormData, additionalStaffNeeded: checked, additionalStaffCount: checked && addFormData.additionalStaffCount === 0 ? 1 : addFormData.additionalStaffCount})}
                />
              </div>
              {addFormData.additionalStaffNeeded && (
                <div className="space-y-2">
                  <Label>How many additional staff?</Label>
                  <Input type="number" min="1" value={addFormData.additionalStaffCount} onChange={(e) => setAddFormData({...addFormData, additionalStaffCount: parseInt(e.target.value) || 0})} />
                </div>
              )}
            </div>

            {(addFormData.locationId === "loc-7" || addFormData.locationId === "loc-5") && (
              <div className="grid gap-4 bg-muted/20 p-4 rounded-lg border text-sm">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-foreground">
                    {addFormData.locationId === "loc-7" ? "Banquet Room Required?" : "Private Dining Room Required?"}
                  </Label>
                  <Switch 
                    checked={addFormData.requiresRoom} 
                    onCheckedChange={(checked) => setAddFormData({...addFormData, requiresRoom: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Label className="font-semibold text-foreground">Deposit Paid?</Label>
                  <Switch 
                    checked={addFormData.depositPaid} 
                    onCheckedChange={(checked) => setAddFormData({...addFormData, depositPaid: checked})}
                  />
                </div>
                {addFormData.depositPaid && (
                  <div className="space-y-2">
                    <Label>Deposit Amount ($)</Label>
                    <Input type="number" step="0.01" min="0" value={addFormData.depositAmount} onChange={(e) => setAddFormData({...addFormData, depositAmount: parseFloat(e.target.value) || 0})} />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes & Requests</Label>
              <Textarea rows={4} value={addFormData.notes} onChange={(e) => setAddFormData({...addFormData, notes: e.target.value})} />
            </div>

            <Button type="submit" className="w-full" disabled={isAdding}>
              {isAdding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Add Reservation"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Large Reservations</DialogTitle>
            <DialogDescription>
              Select a date range to export, or leave blank to export all matching your current location filters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date Range (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportDateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportDateRange?.from ? (
                      exportDateRange.to ? (
                        <>
                          {format(exportDateRange.from, "LLL dd, y")} -{" "}
                          {format(exportDateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(exportDateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>All time (No range selected)</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={exportDateRange?.from}
                    selected={exportDateRange}
                    onSelect={setExportDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {exportDateRange?.from && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setExportDateRange({ from: undefined, to: undefined })} className="text-muted-foreground h-8 text-xs">
                  Clear range selection
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExportCSV}>Download CSV</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
