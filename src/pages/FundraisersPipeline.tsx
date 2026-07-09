import { useState, useEffect } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isTuesday } from "date-fns";
import { Search, Filter, Calendar as CalendarIcon, MapPin, Link as LinkIcon, DollarSign, Building, Phone, Mail, FileText, Plus, ChevronLeft, ChevronRight, LayoutList, CalendarDays, ArrowDownUp, Loader2, Edit2, Trash2, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { FundraiserCsvImporter } from "@/components/FundraiserCsvImporter";

export interface FundraiserOrder {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  organization: string;
  payableTo?: string;
  notes?: string;
  locationId: string;
  eventDate: string;
  status: "Requested" | "Confirmed" | "Completed";
  totalSales: number;
  totalDonated: number;
  checkSent: boolean;
  createdAt: string;
}

// Safely parse YYYY-MM-DD strings from the DB into local dates
const parseSafeDate = (dateString: string) => {
  if (!dateString) return new Date();
  if (dateString.includes('T')) return new Date(dateString); // Handle ISO strings
  const [year, month, day] = dateString.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

export default function FundraisersPipeline() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const [orders, setOrders] = useState<FundraiserOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  // Sheet state
  const [viewingOrder, setViewingOrder] = useState<FundraiserOrder | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "", email: "", phone: "", address: "", organization: "", payableTo: "", notes: "", locationId: "", eventDate: new Date()
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [addFormData, setAddFormData] = useState({
    name: "", email: "", phone: "", address: "", organization: "", payableTo: "", notes: "", locationId: ""
  });
  const [addFormDate, setAddFormDate] = useState<Date | undefined>(undefined);

  // Edit state for sales/donated
  const [salesInput, setSalesInput] = useState("");
  const [donatedInput, setDonatedInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('fundraisers')
      .select('*')
      .is('deleted_at', null)
      .order('event_date', { ascending: true });

    if (error) {
      console.error("Error fetching orders:", error);
      toast({ title: "Error", description: "Could not load fundraisers.", variant: "destructive" });
    } else if (data) {
      const mappedOrders: FundraiserOrder[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        organization: row.organization,
        payableTo: row.payable_to,
        notes: row.notes,
        locationId: row.location,
        eventDate: row.event_date,
        status: row.status as "Requested" | "Confirmed" | "Completed",
        totalSales: parseFloat(row.total_sales || 0),
        totalDonated: parseFloat(row.total_donated || 0),
        checkSent: Boolean(row.check_sent),
        createdAt: row.created_at,
      }));
      setOrders(mappedOrders);

      // Handle ?id= param for direct linking
      const params = new URLSearchParams(window.location.search);
      const directId = params.get('id');
      if (directId) {
        const order = mappedOrders.find(o => o.id === directId);
        if (order) {
          setViewingOrder(order);
          if (order.status === "Completed") {
            setSalesInput(order.totalSales.toString());
            setDonatedInput(order.totalDonated.toString());
          }
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCopyLink = () => {
    // Dynamically extract the base path from the current URL to ensure it works
    // correctly through the Vibe proxy sandbox without stripping the UUIDs.
    const basePath = window.location.pathname.replace(/\/tuesday-fundraisers$/, '');
    const url = `${window.location.origin}${basePath}/public/fundraisers`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Public fundraiser booking link copied to clipboard.",
    });
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('fundraisers')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.error("Error updating status:", error);
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
      return;
    }

    const updatedOrder = orders.find(o => o.id === orderId);
    
    // Automatically trigger internal confirmation email if moved to 'Confirmed'
    if (newStatus === "Confirmed" && updatedOrder) {
      const location = locations.find(l => l.id === updatedOrder.locationId);
      if (location && location.email) {
        supabase.functions.invoke('send-fundraiser-internal-alert', {
          body: { order: updatedOrder, location }
        }).then(({ error: fnError, data: fnData }) => {
          if (fnError || fnData?.error) {
            console.error("Failed to send internal alert:", fnError || fnData?.error);
            toast({ title: "Email Alert Failed", description: "Status updated, but internal notification email failed to send.", variant: "destructive" });
          } else {
             toast({ title: "Location Notified", description: "Internal confirmation email sent to the store." });
          }
        });
      }
    }

    // Automatically trigger accounting email if moved to 'Completed'
    if (newStatus === "Completed" && updatedOrder) {
      const location = locations.find(l => l.id === updatedOrder.locationId);
      if (location) {
        supabase.functions.invoke('send-fundraiser-accounting-alert', {
          body: { order: updatedOrder, location }
        }).then(({ error: fnError, data: fnData }) => {
          if (fnError || fnData?.error) {
            console.error("Failed to send accounting alert:", fnError || fnData?.error);
            toast({ title: "Email Alert Failed", description: "Status updated, but accounting notification email failed to send.", variant: "destructive" });
          } else {
             toast({ title: "Accounting Notified", description: "Email sent to accounting for check payment." });
          }
        });
      }
    }

    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
    
    if (viewingOrder && viewingOrder.id === orderId) {
      setViewingOrder({ ...viewingOrder, status: newStatus as any });
      if (newStatus === "Completed") {
        setSalesInput(viewingOrder.totalSales.toString());
        setDonatedInput(viewingOrder.totalDonated.toString());
      }
    }
    
    toast({ title: "Status Updated", description: `Order status changed to ${newStatus}.` });
  };

  const handleSaveFinancials = async () => {
    if (!viewingOrder) return;
    
    const sales = parseFloat(salesInput) || 0;
    const donated = parseFloat(donatedInput) || 0;

    const { error } = await supabase
      .from('fundraisers')
      .update({ total_sales: sales, total_donated: donated })
      .eq('id', viewingOrder.id);

    if (error) {
      toast({ title: "Error", description: "Could not save financials.", variant: "destructive" });
      return;
    }

    setOrders(orders.map(o => o.id === viewingOrder.id ? { ...o, totalSales: sales, totalDonated: donated } : o));
    setViewingOrder({ ...viewingOrder, totalSales: sales, totalDonated: donated });
    toast({ title: "Saved", description: "Financials updated successfully." });
  };

  const handleToggleCheckSent = async (checked: boolean) => {
    if (!viewingOrder) return;

    const { error } = await supabase
      .from('fundraisers')
      .update({ check_sent: checked })
      .eq('id', viewingOrder.id);

    if (error) {
      toast({ title: "Error", description: "Could not update check status.", variant: "destructive" });
      return;
    }

    setOrders(orders.map(o => o.id === viewingOrder.id ? { ...o, checkSent: checked } : o));
    setViewingOrder({ ...viewingOrder, checkSent: checked });
    toast({ title: "Saved", description: `Check marked as ${checked ? 'sent' : 'not sent'}.` });
  };

  const handleSendConfirmationEmail = async () => {
    if (!viewingOrder) return;
    setIsSendingEmail(true);

    const location = locations.find(l => l.id === viewingOrder.locationId) || locations[0];

    const { data, error } = await supabase.functions.invoke('send-fundraiser-email', {
      body: {
        order: viewingOrder,
        location
      }
    });

    setIsSendingEmail(false);

    if (error || data?.error) {
      toast({ title: "Email Failed", description: data?.error || error?.message, variant: "destructive" });
      return;
    }

    toast({ title: "Email Sent!", description: "The confirmation and tips email has been sent to the organization." });
  };

  const handleUpdateFundraiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingOrder) return;
    setIsUpdating(true);

    const formattedDate = format(editFormData.eventDate, 'yyyy-MM-dd');

    const { error } = await supabase
      .from('fundraisers')
      .update({
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        address: editFormData.address,
        organization: editFormData.organization,
        payable_to: editFormData.payableTo,
        notes: editFormData.notes,
        location: editFormData.locationId,
        event_date: formattedDate
      })
      .eq('id', viewingOrder.id);

    setIsUpdating(false);

    if (error) {
      toast({ title: "Error", description: "Failed to update fundraiser details.", variant: "destructive" });
      return;
    }

    const updatedOrder = {
      ...viewingOrder,
      name: editFormData.name,
      email: editFormData.email,
      phone: editFormData.phone,
      address: editFormData.address,
      organization: editFormData.organization,
      payableTo: editFormData.payableTo,
      notes: editFormData.notes,
      locationId: editFormData.locationId,
      eventDate: formattedDate
    };

    setOrders(orders.map(o => o.id === viewingOrder.id ? updatedOrder : o));
    setViewingOrder(updatedOrder);
    setIsEditMode(false);
    toast({ title: "Updated", description: "Fundraiser details saved successfully." });
  };

  const handleDeleteFundraiser = async (id: string) => {
    const { error } = await supabase.from('fundraisers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Could not delete the fundraiser.", variant: "destructive" });
      return;
    }
    setOrders(orders.filter(o => o.id !== id));
    setViewingOrder(null);
    toast({ title: "Deleted", description: "Fundraiser has been removed." });
  };

  const handleAddFundraiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormDate) {
      toast({ title: "Date required", description: "Please select a preferred event date." });
      return;
    }

    setIsAdding(true);
    
    const loc = addFormData.locationId || selectedLocationId || locations[0].id;
    const formattedDate = format(addFormDate, 'yyyy-MM-dd');

    const { data, error } = await supabase.from('fundraisers').insert([{
      name: addFormData.name,
      email: addFormData.email,
      phone: addFormData.phone,
      address: addFormData.address,
      organization: addFormData.organization,
      payable_to: addFormData.payableTo,
      notes: addFormData.notes,
      location: loc,
      event_date: formattedDate,
      status: 'Confirmed'
    }]).select().single();

    setIsAdding(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      toast({ title: "Success", description: "Fundraiser manually added." });
      setOrders([...orders, {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        organization: data.organization,
        payableTo: data.payable_to,
        notes: data.notes,
        locationId: data.location,
        eventDate: data.event_date,
        status: data.status,
        totalSales: 0,
        totalDonated: 0,
        checkSent: false,
        createdAt: data.created_at,
      }].sort((a, b) => parseSafeDate(a.eventDate).getTime() - parseSafeDate(b.eventDate).getTime()));
      setIsAddSheetOpen(false);
      setAddFormData({ name: "", email: "", phone: "", address: "", organization: "", payableTo: "", notes: "", locationId: "" });
      setAddFormDate(undefined);
    }
  };

  // Extract unique organizations for autofill dropdown
  const uniqueOrgs = orders.reduce((acc, current) => {
    const x = acc.find(item => item.organization === current.organization);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as FundraiserOrder[]);

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

  const getStatusPillClass = (status: string) => {
    switch (status) {
      case "Requested": return "status-pill waiting";
      case "Confirmed": return "status-pill confirmed";
      case "Completed": return "status-pill complete";
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
            const dayIsTuesday = day.getDay() === 2;
            const dayOrders = calendarFilteredOrders.filter(o => isSameDay(parseSafeDate(o.eventDate), day));
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            // If viewing a specific location, a Tuesday is either booked by 1 order or available
            const specificLocationBooked = filterLocation !== "all" && dayOrders.length > 0;
            const specificLocationAvailable = filterLocation !== "all" && dayOrders.length === 0;

            // For "All locations", we count how many are booked vs available total
            const totalLocations = locations.length;
            const bookedCount = dayOrders.length;
            const availableCount = totalLocations - bookedCount;

            // Apply "Booked Only" / "Available Only" filters at the cell level for visual clarity
            let cellOpacity = "opacity-100";
            if (dayIsTuesday) {
               if (filterStatus === "booked" && dayOrders.length === 0) cellOpacity = "opacity-30 grayscale";
               if (filterStatus === "available" && filterLocation !== "all" && specificLocationBooked) cellOpacity = "opacity-30 grayscale";
               if (filterStatus === "available" && filterLocation === "all" && availableCount === 0) cellOpacity = "opacity-30 grayscale";
            }

            return (
              <div 
                key={day.toString()} 
                className={`
                  min-h-[120px] p-2 border-r border-b relative
                  ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : ""}
                  ${isToday(day) ? "bg-primary/5" : ""}
                  ${dayIsTuesday && isCurrentMonth ? "bg-blue-50/30" : ""}
                  ${cellOpacity}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${isToday(day) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center -mt-1 -ml-1" : ""}`}>
                    {format(day, dateFormat)}
                  </span>
                </div>

                {dayIsTuesday && isCurrentMonth && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {filterLocation !== "all" ? (
                      // Single Location View
                      specificLocationBooked ? (
                        <div 
                          className="text-xs p-1.5 bg-primary/10 text-primary border border-primary/20 rounded cursor-pointer hover:bg-primary/20 transition-colors font-medium truncate"
                          onClick={() => {
                            setViewingOrder(dayOrders[0]);
                            setSalesInput(dayOrders[0].totalSales.toString());
                            setDonatedInput(dayOrders[0].totalDonated.toString());
                          }}
                          title={dayOrders[0].organization}
                        >
                          {dayOrders[0].organization}
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
                                    setDonatedInput(o.totalDonated.toString());
                                  }}
                                  title={`${locations.find(l => l.id === o.locationId)?.name}: ${o.organization}`}
                                >
                                  <span className="font-semibold">{locations.find(l => l.id === o.locationId)?.name?.substring(0, 3)}:</span> {o.organization}
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
          <h1 className="text-3xl font-bold tracking-tight">Tuesday Fundraisers</h1>
          <p className="text-muted-foreground mt-1">Manage fundraiser requests, approvals, and performance tracking.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 shadow-sm" onClick={handleCopyLink}>
            <LinkIcon className="w-4 h-4" />
            Copy Booking Link
          </Button>
          <FundraiserCsvImporter onImportSuccess={fetchOrders} />
          <Button className="gap-2 shadow-sm" onClick={() => setIsAddSheetOpen(true)}>
            <Plus className="w-4 h-4" />
            New Fundraiser
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search fundraisers..." 
              className="pl-9 w-64 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-[180px] h-10 border-input bg-background shadow-sm">
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

          {viewMode === "list" && (
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px] h-10 border-input bg-background shadow-sm">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort By" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest to Oldest</SelectItem>
                <SelectItem value="oldest">Oldest to Newest</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button 
            variant={viewMode === "list" ? "secondary" : "ghost"} 
            size="sm" 
            className="gap-2 h-8"
            onClick={() => setViewMode("list")}
          >
            <LayoutList className="w-4 h-4" />
            List
          </Button>
          <Button 
            variant={viewMode === "calendar" ? "secondary" : "ghost"} 
            size="sm" 
            className="gap-2 h-8"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
      <div className="bg-card border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto h-full flex flex-col">
          <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <div className="col-span-3">Organization</div>
            <div className="col-span-3">Preferred Event Date & Location</div>
            <div className="col-span-3">Financials</div>
            <div className="col-span-3">Status</div>
          </div>

          <div className="divide-y overflow-auto flex-1 min-w-[800px]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                <p>Loading fundraisers...</p>
              </div>
            ) : sortedOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
                <Building className="w-8 h-8 mb-3 opacity-20" />
                <p>No fundraiser requests found.</p>
              </div>
            ) : (
              sortedOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => {
                    setViewingOrder(order);
                    setSalesInput(order.totalSales.toString());
                    setDonatedInput(order.totalDonated.toString());
                  }}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors cursor-pointer group"
                >
                  <div className="col-span-3">
                    <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{order.organization}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{order.name}</div>
                  </div>
                  
                  <div className="col-span-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{format(parseSafeDate(order.eventDate), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{locations.find(l => l.id === order.locationId)?.name || "Location"}</span>
                    </div>
                  </div>

                  <div className="col-span-3 flex flex-col gap-1">
                    {order.status === "Completed" ? (
                      <>
                        <div className="text-sm font-medium">Sales: ${order.totalSales.toLocaleString()}</div>
                        <div className="flex items-center justify-between pr-4">
                          <div className="text-xs text-muted-foreground">Donated: ${order.totalDonated.toLocaleString()}</div>
                          <div className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${order.checkSent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {order.checkSent ? 'Check Sent' : 'Check Pending'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">Pending Event</div>
                    )}
                  </div>

                  <div className="col-span-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <Select 
                      value={order.status} 
                      onValueChange={(val) => updateOrderStatus(order.id, val)}
                    >
                      <SelectTrigger className={`h-7 text-xs border-none focus:ring-0 w-32 ${getStatusPillClass(order.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Requested">Requested</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                      setViewingOrder(order);
                      setSalesInput(order.totalSales.toString());
                      setDonatedInput(order.totalDonated.toString());
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
        renderCalendarView()
      )}

      {/* Details View Sheet */}
      <Sheet open={viewingOrder !== null} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewingOrder && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-2xl break-words">{viewingOrder.organization}</SheetTitle>
                    <SheetDescription className="mt-1">
                      Preferred Event Date: <strong className="text-foreground">{format(parseSafeDate(viewingOrder.eventDate), "MMMM d, yyyy")}</strong>
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setEditFormData({
                        name: viewingOrder.name,
                        email: viewingOrder.email,
                        phone: viewingOrder.phone,
                        address: viewingOrder.address,
                        organization: viewingOrder.organization,
                        payableTo: viewingOrder.payableTo || "",
                        notes: viewingOrder.notes || "",
                        locationId: viewingOrder.locationId,
                        eventDate: parseSafeDate(viewingOrder.eventDate)
                      });
                      setIsEditMode(true);
                    }}>
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Fundraiser</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this fundraiser for {viewingOrder.organization}? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteFundraiser(viewingOrder.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </SheetHeader>

              {isEditMode ? (
                <form onSubmit={handleUpdateFundraiser} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input required value={editFormData.organization} onChange={(e) => setEditFormData({...editFormData, organization: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes / Special Requests</Label>
                    <Input placeholder="Any details for this event" value={editFormData.notes} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <Label>Make Check Payable To (Optional)</Label>
                    <Input placeholder="Leave blank to use Organization Name" value={editFormData.payableTo} onChange={(e) => setEditFormData({...editFormData, payableTo: e.target.value})} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input required value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" required value={editFormData.email} onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input type="tel" required value={editFormData.phone} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mailing Address</Label>
                    <Input required value={editFormData.address} onChange={(e) => setEditFormData({...editFormData, address: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes & Special Requests</Label>
                    <Input placeholder="Any details for this event" value={editFormData.notes || ""} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} />
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Select value={editFormData.locationId} onValueChange={(val) => setEditFormData({...editFormData, locationId: val})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex flex-col">
                      <Label>Preferred Event Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(editFormData.eventDate, "PPP")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editFormData.eventDate}
                            onSelect={(d) => d && setEditFormData({...editFormData, eventDate: d})}
                            disabled={(date) => !isTuesday(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-6 border-t mt-6">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditMode(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isUpdating}>
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-8">
                {/* Status & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                    <Select 
                      value={viewingOrder.status} 
                      onValueChange={(val) => updateOrderStatus(viewingOrder.id, val)}
                    >
                      <SelectTrigger className={`h-8 border-none focus:ring-0 ${getStatusPillClass(viewingOrder.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Requested">Requested</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Location</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {locations.find(l => l.id === viewingOrder.locationId)?.name || "Unknown"}
                    </div>
                  </div>
                </div>

                {viewingOrder.status === "Requested" && (
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-4 text-sm text-primary">
                    Updating this to <strong>Confirmed</strong> will permanently lock {format(parseSafeDate(viewingOrder.eventDate), "MMMM d")} on the public booking calendar for this location.
                  </div>
                )}

                {/* Form Submission Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Organization Details
                  </h3>
                  
                  <div className="grid gap-3 bg-muted/20 p-4 rounded-lg border text-sm">
                    <div className="grid grid-cols-3 gap-2 py-1">
                      <div className="text-muted-foreground">Contact Name:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.name}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Make Check Payable To:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.payableTo || <span className="text-muted-foreground italic">Same as organization</span>}</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Email:</div>
                      <div className="col-span-2">
                        <a href={`mailto:${viewingOrder.email}`} className="text-primary hover:underline">{viewingOrder.email}</a>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Phone:</div>
                      <div className="col-span-2">
                        <a href={`tel:${viewingOrder.phone}`} className="text-primary hover:underline">{viewingOrder.phone}</a>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Mailing Addr:</div>
                      <div className="col-span-2 whitespace-pre-wrap">{viewingOrder.address}</div>
                    </div>

                    {viewingOrder.notes && (
                      <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                        <div className="text-muted-foreground">Notes:</div>
                        <div className="col-span-2 whitespace-pre-wrap">{viewingOrder.notes}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Past Activity */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    Past Activity for {viewingOrder.organization}
                  </h3>
                  <div className="space-y-3">
                    {orders
                      .filter(o => o.organization === viewingOrder.organization && o.id !== viewingOrder.id)
                      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
                      .map(pastEvent => (
                        <div key={pastEvent.id} className="bg-muted/10 p-3 rounded-lg border text-sm flex justify-between items-center">
                          <div>
                            <div className="font-medium">{format(parseSafeDate(pastEvent.eventDate), "MMM d, yyyy")}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {locations.find(l => l.id === pastEvent.locationId)?.name || 'Unknown Location'}
                            </div>
                          </div>
                          <div className="text-right">
                            {pastEvent.status === "Completed" ? (
                              <>
                                <div className="font-semibold text-primary">${pastEvent.totalDonated.toLocaleString(undefined, { minimumFractionDigits: 2 })} Donated</div>
                                <div className="text-xs text-muted-foreground">${pastEvent.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} Sales</div>
                              </>
                            ) : (
                              <div className="text-muted-foreground italic text-xs">{pastEvent.status}</div>
                            )}
                          </div>
                        </div>
                    ))}
                    {orders.filter(o => o.organization === viewingOrder.organization && o.id !== viewingOrder.id).length === 0 && (
                      <div className="text-sm text-muted-foreground italic bg-muted/10 p-4 rounded-lg border text-center">
                        No previous activity found.
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Confirmation Action */}
                <div className="bg-muted/30 p-4 rounded-lg border">
                  <div className="text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Send Confirmation & Tips</div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Email the non-profit their confirmed date, location details, and success tips from the website.
                      </p>
                    </div>
                    <Button onClick={handleSendConfirmationEmail} disabled={isSendingEmail} className="w-full">
                      {isSendingEmail ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Email...</>
                      ) : (
                        "Email Non-Profit"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Financials block when completed */}
                {viewingOrder.status === "Completed" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      Event Performance
                    </h3>
                    <div className="bg-muted/10 rounded-xl p-5 border space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Total Sales ($)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={salesInput} 
                            onChange={(e) => setSalesInput(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total Donated ($)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={donatedInput} 
                            onChange={(e) => setDonatedInput(e.target.value)} 
                          />
                        </div>
                      </div>
                      <Button className="w-full" onClick={handleSaveFinancials}>
                        Save Financials
                      </Button>
                      
                      <div className="pt-4 mt-2 border-t flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold">Check Sent?</Label>
                          <p className="text-sm text-muted-foreground">Mark if accounting has mailed the check.</p>
                        </div>
                        <Switch 
                          checked={viewingOrder.checkSent} 
                          onCheckedChange={handleToggleCheckSent} 
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add New Fundraiser Sheet */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl">New Fundraiser</SheetTitle>
            <SheetDescription>Manually add a fundraiser to the schedule.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAddFundraiser} className="space-y-4">
            {uniqueOrgs.length > 0 && (
              <div className="space-y-2 mb-4">
                <Label className="text-muted-foreground text-xs uppercase font-semibold">Autofill from past organization</Label>
                <Select onValueChange={(val) => {
                  const existing = uniqueOrgs.find(o => o.id === val);
                  if (existing) {
                    setAddFormData({
                      ...addFormData, 
                      organization: existing.organization,
                      payableTo: existing.payableTo || "",
                      name: existing.name,
                      email: existing.email,
                      phone: existing.phone,
                      address: existing.address,
                      notes: existing.notes || "",
                    });
                  }
                }}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder="Select an existing organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueOrgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.organization}</SelectItem>
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
              <Label>Organization Name</Label>
              <Input required value={addFormData.organization} onChange={(e) => setAddFormData({...addFormData, organization: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Make Check Payable To (Optional)</Label>
              <Input placeholder="Leave blank to use Organization Name" value={addFormData.payableTo} onChange={(e) => setAddFormData({...addFormData, payableTo: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input required value={addFormData.name} onChange={(e) => setAddFormData({...addFormData, name: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={addFormData.email} onChange={(e) => setAddFormData({...addFormData, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" required value={addFormData.phone} onChange={(e) => setAddFormData({...addFormData, phone: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mailing Address</Label>
              <Input required value={addFormData.address} onChange={(e) => setAddFormData({...addFormData, address: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Notes & Special Requests</Label>
              <Input placeholder="Any details for this event" value={addFormData.notes} onChange={(e) => setAddFormData({...addFormData, notes: e.target.value})} />
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={addFormData.locationId || selectedLocationId || locations[0].id} onValueChange={(val) => setAddFormData({...addFormData, locationId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Preferred Event Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !addFormDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {addFormDate ? format(addFormDate, "PPP") : <span>Pick a Tuesday</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={addFormDate}
                      onSelect={setAddFormDate}
                      disabled={(date) => !isTuesday(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="pt-6 border-t mt-6">
              <Button type="submit" className="w-full" disabled={isAdding}>
                {isAdding ? "Adding..." : "Add Fundraiser"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
