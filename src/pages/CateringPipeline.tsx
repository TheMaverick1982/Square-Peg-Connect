import { useState, useEffect } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations, type CateringStatus, type CateringOrder } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Filter, Plus, Calendar as CalendarIcon, Users, MapPin, UtensilsCrossed, Link as LinkIcon, MessageSquare, Phone, Mail, FileText, ArrowDownUp, Trash2, Download, DollarSign } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { EmailLogs } from "@/components/EmailLogs";

type TabState = "all" | "upcoming" | "unopened" | "past";

export default function CateringPipeline() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabState>("all");
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  
  // Sheet states
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<CateringOrder | null>(null);
  
  // Financial tracking state
  const [salesInput, setSalesInput] = useState("");

  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(undefined);

  // Form state
  const [formData, setFormData] = useState({
    contactName: "",
    email: "",
    phone: "",
    eventName: "",
    eventDate: "",
    guestCount: "",
    locationId: "",
    orderPreference: "",
    notes: ""
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLocationChange = (val: string) => {
    setFormData({ ...formData, locationId: val });
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('catering_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast({ title: "Error", description: "Could not load catering requests.", variant: "destructive" });
    } else if (data) {
      const mappedOrders: CateringOrder[] = data.map((row: any) => ({
        id: row.id,
        contactId: `db-${row.id}`,
        contactName: row.name,
        email: row.email,
        phone: row.phone,
        notes: row.notes,
        locationId: row.location,
        eventName: row.company || 'Unknown Event',
        eventDate: row.event_date,
        guestCount: row.guest_count,
        totalAmount: row.quote_total || 0,
        status: row.status as CateringStatus,
        createdAt: row.created_at,
        quoteItems: row.quote_items || [],
        quoteTotal: row.quote_total || 0,
        paymentLink: row.payment_link,
        orderPreference: row.order_preference,
        heardAboutUs: row.heard_about_us
      }));
      setOrders(mappedOrders);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('public:catering_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catering_requests' }, payload => {
        // Auto-refresh when webhook updates the status (e.g., to Completed)
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Insert into Supabase
    const { data, error } = await supabase.from('catering_requests').insert([
      {
        name: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        company: formData.eventName,
        event_date: formData.eventDate,
        guest_count: parseInt(formData.guestCount, 10),
        location: formData.locationId,
        order_preference: formData.orderPreference,
        notes: formData.notes,
        status: 'Confirmed'
      }
    ]).select();

    if (error) {
      console.error("Error creating request:", error);
      toast({ title: "Error", description: "Could not save the request.", variant: "destructive" });
      return;
    }

    if (data && data.length > 0) {
      const row = data[0];
      const newOrder: CateringOrder = {
        id: row.id,
        contactId: `db-${row.id}`,
        contactName: row.name,
        email: row.email,
        phone: row.phone,
        notes: row.notes,
        locationId: row.location,
        eventName: row.company || 'Unknown Event',
        eventDate: row.event_date,
        guestCount: row.guest_count,
        totalAmount: 0,
        status: row.status as CateringStatus,
        createdAt: row.created_at,
        quoteItems: [],
        quoteTotal: 0,
        paymentLink: "",
        orderPreference: row.order_preference,
        heardAboutUs: row.heard_about_us
      };
      setOrders([newOrder, ...orders]);
    }
    
    setIsNewSheetOpen(false);
    
    // Reset form
    setFormData({
      contactName: "",
      email: "",
      phone: "",
      eventName: "",
      eventDate: "",
      guestCount: "",
      locationId: "",
      orderPreference: "",
      notes: ""
    });

    const locationName = locations.find(l => l.id === formData.locationId)?.name || "Location";

    toast({
      title: "Catering Request Added",
      description: `Assigned to ${locationName}. The manager has been notified.`,
    });
  };

  // Filter by location first (global + local)
  const locationOrders = orders.filter(order => {
    if (selectedLocationId && order.locationId !== selectedLocationId) return false;
    if (filterLocation !== "all" && order.locationId !== filterLocation) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!order.contactName.toLowerCase().includes(q) &&
          !order.eventName.toLowerCase().includes(q) &&
          !order.email?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Then filter by tab
  const filteredOrders = locationOrders.filter(order => {
    const isPast = new Date(order.eventDate) < new Date();
    if (activeTab === "upcoming") return !isPast;
    if (activeTab === "past") return isPast;
    if (activeTab === "unopened") return order.status === "Waiting on you";
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortOrder === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });

  const getStatusPillClass = (status: CateringStatus) => {
    switch (status) {
      case "Requested": return "status-pill waiting bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "Waiting on the customer": return "status-pill waiting";
      case "Waiting on you": return "status-pill followup";
      case "Confirmed": return "status-pill confirmed";
      case "Completed": return "status-pill complete";
      case "Cancelled": return "status-pill cancelled bg-red-100 text-red-800 border-red-200";
      default: return "status-pill followup";
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/public/catering`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Public catering form link copied to clipboard.",
    });
  };



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
        // use eventDate for the filtering logic
        const d = new Date(o.eventDate);
        return d >= start && d <= end;
      });
    }

    if (dataToExport.length === 0) {
      toast({ title: "No data", description: "There are no catering orders in the selected range to export.", variant: "destructive" });
      return;
    }

    const headers = [
      "Contact Name", 
      "Event/Company", 
      "Location", 
      "Event Date", 
      "Guest Count", 
      "Email", 
      "Phone", 
      "Notes", 
      "Quote Total",
      "Status",
      "Created At"
    ];
    
    const rows = dataToExport.map(o => [
      o.contactName,
      o.eventName || "",
      locations.find(l => l.id === o.locationId)?.name || "Unknown",
      format(new Date(o.eventDate), "yyyy-MM-dd"),
      o.guestCount,
      o.email || "",
      o.phone || "",
      o.notes || "",
      o.totalAmount || 0,
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
    link.href = url;
    link.setAttribute("download", `catering_export_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportDialogOpen(false);
  };

  const handleDeleteOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('catering_requests')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error("Error deleting order:", error);
      toast({ title: "Error", description: "Could not delete order.", variant: "destructive" });
      return;
    }

    setOrders(orders.filter(o => o.id !== orderId));
    setViewingOrder(null);
    toast({ title: "Order Deleted", description: "The catering request has been removed." });
  };

  const handleSaveFinancials = async () => {
    if (!viewingOrder) return;
    
    const sales = parseFloat(salesInput) || 0;

    const { error } = await supabase
      .from('catering_requests')
      .update({ quote_total: sales })
      .eq('id', viewingOrder.id);

    if (error) {
      toast({ title: "Error", description: "Could not save financials.", variant: "destructive" });
      return;
    }

    setOrders(orders.map(o => o.id === viewingOrder.id ? { ...o, totalAmount: sales } : o));
    setViewingOrder({ ...viewingOrder, totalAmount: sales });
    toast({ title: "Saved", description: "Financials updated successfully." });
  };

  const updateOrderStatus = async (orderId: string, newStatus: CateringStatus) => {
    const { error } = await supabase
      .from('catering_requests')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.error("Error updating status:", error);
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
      return;
    }

    const updatedOrder = orders.find(o => o.id === orderId);

    // Automatically trigger internal confirmation email to the location if moved to 'Confirmed'
    if (newStatus === "Confirmed" && updatedOrder) {
      const location = locations.find(l => l.id === updatedOrder.locationId);
      if (location && location.email) {
        supabase.functions.invoke('send-catering-internal-alert', {
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

    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    
    if (viewingOrder && viewingOrder.id === orderId) {
      setViewingOrder({ ...viewingOrder, status: newStatus });
      if (newStatus === "Completed") {
        setSalesInput(viewingOrder.totalAmount?.toString() || "0");
      }
    }
    
    toast({ title: "Status Updated", description: `Order status changed to ${newStatus}.` });
  };

  // Extract unique contacts for autofill dropdown
  const uniqueContacts = orders.reduce((acc, current) => {
    // Let's group by email, or contactName if no email
    const key = current.email || current.contactName;
    const x = acc.find(item => (item.email || item.contactName) === key);
    if (!x && key) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as CateringOrder[]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catering Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage catering leads and confirmed orders.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 shadow-sm" onClick={() => setIsExportDialogOpen(true)}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="outline" className="gap-2 shadow-sm" onClick={handleCopyLink}>
            <LinkIcon className="w-4 h-4" />
            Copy Public Link
          </Button>
          <Sheet open={isNewSheetOpen} onOpenChange={setIsNewSheetOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                New Request
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Catering Intake Form</SheetTitle>
                <SheetDescription>
                  Log a new catering request. The location manager will be notified automatically.
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                {uniqueContacts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <Label className="text-muted-foreground text-xs uppercase font-semibold">Autofill from past contact</Label>
                    <Select onValueChange={(val) => {
                      const existing = uniqueContacts.find(o => o.id === val);
                      if (existing) {
                        setFormData({
                          ...formData, 
                          contactName: existing.contactName,
                          email: existing.email || "",
                          phone: existing.phone || "",
                          eventName: existing.eventName || "",
                          notes: existing.notes || "",
                        });
                      }
                    }}>
                      <SelectTrigger className="bg-muted/30">
                        <SelectValue placeholder="Select an existing contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueContacts.map(contact => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.contactName} {contact.eventName ? `(${contact.eventName})` : ''}
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
                <div className="space-y-4">
                  <h3 className="text-sm font-medium border-b pb-2">Contact Details</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="contactName">Full Name</Label>
                    <Input id="contactName" name="contactName" value={formData.contactName} onChange={handleFormChange} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" name="email" value={formData.email} onChange={handleFormChange} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} required />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium border-b pb-2">Event Details</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="locationId">Assigned Location</Label>
                    <Select value={formData.locationId} onValueChange={handleLocationChange} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="orderPreference">Order Preference</Label>
                    <Select value={formData.orderPreference} onValueChange={(val) => setFormData({ ...formData, orderPreference: val })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select preference..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In-restaurant dining">In-restaurant dining</SelectItem>
                        <SelectItem value="Pick-up catering">Pick-up catering</SelectItem>
                        <SelectItem value="Food truck private service">Food truck private service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="eventName">Event Name / Type</Label>
                    <Input id="eventName" name="eventName" placeholder="e.g. Corporate Lunch" value={formData.eventName} onChange={handleFormChange} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="eventDate">Event Date</Label>
                      <Input id="eventDate" type="date" name="eventDate" value={formData.eventDate} onChange={handleFormChange} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="guestCount">Guest Count</Label>
                      <Input id="guestCount" type="number" name="guestCount" placeholder="e.g. 50" value={formData.guestCount} onChange={handleFormChange} required />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Order Details / Notes</Label>
                    <Textarea id="notes" name="notes" placeholder="Dietary restrictions, delivery instructions, etc." value={formData.notes} onChange={handleFormChange} rows={4} />
                  </div>
                </div>
                <SheetFooter className="mt-6">
                  <SheetClose asChild>
                    <Button variant="outline" type="button">Cancel</Button>
                  </SheetClose>
                  <Button type="submit">Save & Notify</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg border">
          <button 
            onClick={() => setActiveTab("all")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All Requests
          </button>
          <button 
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'upcoming' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Upcoming
          </button>
          <button 
            onClick={() => setActiveTab("unopened")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'unopened' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Unopened
          </button>
          <button 
            onClick={() => setActiveTab("past")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'past' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Past
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search orders..." 
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
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden flex-1">
        <div className="overflow-x-auto h-full flex flex-col">
          <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <div className="col-span-3">Contact & Event</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2">Details</div>
            <div className="col-span-3">Status</div>
          </div>

          <div className="divide-y overflow-auto flex-1 min-w-[800px]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                <p>Loading catering requests...</p>
              </div>
            ) : sortedOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
                <UtensilsCrossed className="w-8 h-8 mb-3 opacity-20" />
                <p>No catering orders found for this view.</p>
              </div>
            ) : (
              sortedOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => setViewingOrder(order)}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors cursor-pointer group"
                >
                  <div className="col-span-3">
                    <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{order.contactName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{order.eventName}</div>
                  </div>
                  
                  <div className="col-span-2 flex items-center gap-2 text-sm">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{format(new Date(order.eventDate), "MMM d, yyyy")}</span>
                  </div>

                  <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{locations.find(l => l.id === order.locationId)?.name || "Location"}</span>
                  </div>

                  <div className="col-span-2 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {order.guestCount} guests
                    </div>
                    <div className="text-sm font-medium">${order.totalAmount.toLocaleString()}</div>
                  </div>

                  <div className="col-span-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <Select 
                      value={order.status} 
                      onValueChange={(val) => updateOrderStatus(order.id, val as CateringStatus)}
                    >
                      <SelectTrigger className={`h-7 text-xs border-none focus:ring-0 ${getStatusPillClass(order.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Requested">Requested</SelectItem>
                        <SelectItem value="Waiting on you">Waiting on you</SelectItem>
                        <SelectItem value="Waiting on the customer">Waiting on the customer</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setViewingOrder(order)}>
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Details View Sheet */}
      <Sheet open={viewingOrder !== null} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewingOrder && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div className="shrink-1 min-w-0 pr-4">
                    <SheetTitle className="text-2xl break-words">{viewingOrder.eventName}</SheetTitle>
                    <SheetDescription className="mt-1">
                      Submitted on {format(new Date(viewingOrder.createdAt), "MMMM d, yyyy")}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center shrink-0">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this catering request? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteOrder(viewingOrder.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-8">
                {/* Inbox Integration */}
                <div className="bg-muted/10 rounded-xl p-5 border flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Message Lead</h4>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Continue the conversation securely through the internal Inbox.
                    </p>
                  </div>
                  <Button 
                    className="w-full sm:w-auto gap-2" 
                    onClick={() => toast({ title: "Internal Inbox", description: "This feature is being rolled out natively soon." })}
                  >
                    Open Inbox
                    <MessageSquare className="w-4 h-4 ml-1 opacity-70" />
                  </Button>
                </div>

                {/* Status & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                    <Select 
                      value={viewingOrder.status} 
                      onValueChange={(val) => updateOrderStatus(viewingOrder.id, val as CateringStatus)}
                    >
                      <SelectTrigger className={`h-8 border-none focus:ring-0 ${getStatusPillClass(viewingOrder.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Requested">Requested</SelectItem>
                        <SelectItem value="Waiting on you">Waiting on you</SelectItem>
                        <SelectItem value="Waiting on the customer">Waiting on the customer</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
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

                {/* Form Submission Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Form Submission Details
                  </h3>
                  
                  <div className="grid gap-3 bg-muted/20 p-4 rounded-lg border text-sm">
                    <div className="grid grid-cols-3 gap-2 py-1">
                      <div className="text-muted-foreground">Contact Name:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.contactName}</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Email:</div>
                      <div className="col-span-2">
                        {viewingOrder.email ? (
                          <a href={`mailto:${viewingOrder.email}`} className="text-primary hover:underline">{viewingOrder.email}</a>
                        ) : "—"}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Phone:</div>
                      <div className="col-span-2">
                        {viewingOrder.phone ? (
                          <a href={`tel:${viewingOrder.phone}`} className="text-primary hover:underline">{viewingOrder.phone}</a>
                        ) : "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Company/Event:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.eventName}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Event Date:</div>
                      <div className="col-span-2 font-medium">{format(new Date(viewingOrder.eventDate), "MMMM d, yyyy")}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Guest Count:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.guestCount} People</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Location:</div>
                      <div className="col-span-2 font-medium">{locations.find(l => l.id === viewingOrder.locationId)?.name || "Unknown"}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Order Preference:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.orderPreference || "Not specified"}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Heard About Us:</div>
                      <div className="col-span-2 font-medium">{viewingOrder.heardAboutUs || "—"}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 border-t border-border/50">
                      <div className="text-muted-foreground">Notes:</div>
                      <div className="col-span-2 whitespace-pre-wrap">{viewingOrder.notes || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Past Activity */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    Past Activity for {viewingOrder.contactName}
                  </h3>
                  <div className="space-y-3">
                    {orders
                      .filter(o => (o.email === viewingOrder.email || o.contactName === viewingOrder.contactName) && o.id !== viewingOrder.id)
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
                              <div className="font-semibold text-primary">${pastEvent.totalAmount.toLocaleString()} Sales</div>
                            ) : (
                              <div className="text-muted-foreground italic text-xs">{pastEvent.status}</div>
                            )}
                          </div>
                        </div>
                    ))}
                    {orders.filter(o => (o.email === viewingOrder.email || o.contactName === viewingOrder.contactName) && o.id !== viewingOrder.id).length === 0 && (
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
                  <EmailLogs eventId={viewingOrder.id} eventType="Catering Event" />
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

                {/* Quote Builder Hidden for now */}
                {/* 
                <QuoteBuilder 
                  key={viewingOrder.id}
                  order={viewingOrder} 
                  onUpdate={(updated) => {
                    setViewingOrder(updated);
                    setOrders(orders.map(o => o.id === updated.id ? updated : o));
                  }} 
                />
                */}

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Catering Orders</DialogTitle>
            <DialogDescription>
              Select a date range to export, or leave blank to export all matching records.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Event Date Range (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportDateRange && "text-muted-foreground"
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
                      <span>All time</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExportCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
