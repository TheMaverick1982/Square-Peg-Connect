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
import { Search, Filter, Plus, Calendar as CalendarIcon, Users, MapPin, UtensilsCrossed, Link as LinkIcon, MessageSquare, Phone, Mail, FileText } from "lucide-react";

type TabState = "all" | "upcoming" | "unopened" | "past";

export default function CateringPipeline() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabState>("all");
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sheet states
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<CateringOrder | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    contactName: "",
    email: "",
    phone: "",
    eventName: "",
    eventDate: "",
    guestCount: "",
    locationId: "",
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
        totalAmount: 0,
        status: row.status as CateringStatus,
        createdAt: row.created_at
      }));
      setOrders(mappedOrders);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
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
        notes: formData.notes,
        status: 'Waiting on Customer'
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
        createdAt: row.created_at
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
      notes: ""
    });

    const locationName = locations.find(l => l.id === formData.locationId)?.name || "Location";

    toast({
      title: "Catering Request Added",
      description: `Assigned to ${locationName}. The manager has been notified.`,
    });
  };

  // Filter by location first
  const locationOrders = selectedLocationId 
    ? orders.filter(o => o.locationId === selectedLocationId)
    : orders;

  // Then filter by tab
  const filteredOrders = locationOrders.filter(order => {
    const isPast = new Date(order.eventDate) < new Date();
    if (activeTab === "upcoming") return !isPast;
    if (activeTab === "past") return isPast;
    if (activeTab === "unopened") return order.status === "Waiting on Customer";
    return true;
  });

  const getStatusPillClass = (status: CateringStatus) => {
    switch (status) {
      case "Waiting on Customer": return "status-pill waiting";
      case "Follow-up Needed": return "status-pill followup";
      case "Confirmed": return "status-pill confirmed";
      case "Order Complete": return "status-pill complete";
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



  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catering Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage catering leads and confirmed orders.</p>
        </div>
        
        <div className="flex items-center gap-2">
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
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden flex-1">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-3">Contact & Event</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-2">Details</div>
          <div className="col-span-3">Status</div>
        </div>

        <div className="divide-y overflow-auto h-[calc(100%-49px)]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
              <p>Loading catering requests...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <UtensilsCrossed className="w-8 h-8 mb-3 opacity-20" />
              <p>No catering orders found for this view.</p>
            </div>
          ) : (
            filteredOrders.map(order => (
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

                <div className="col-span-3 flex items-center justify-between">
                  <div className={getStatusPillClass(order.status)}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      order.status === 'Waiting on Customer' ? 'bg-[hsl(var(--status-waiting))]' :
                      order.status === 'Follow-up Needed' ? 'bg-[hsl(var(--status-followup))]' :
                      order.status === 'Confirmed' ? 'bg-[hsl(var(--status-confirmed))]' : 'bg-[hsl(var(--status-complete))]'
                    }`} />
                    {order.status}
                  </div>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    View
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Details View Sheet */}
      <Sheet open={viewingOrder !== null} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewingOrder && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-2xl">{viewingOrder.eventName}</SheetTitle>
                    <SheetDescription className="mt-1">
                      Submitted on {format(new Date(viewingOrder.createdAt), "MMMM d, yyyy")}
                    </SheetDescription>
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
                      Continue the conversation securely through the Vendasta Business App Inbox.
                    </p>
                  </div>
                  <Button 
                    className="w-full sm:w-auto gap-2" 
                    onClick={() => window.open('https://the-maverick-ai.smblogin.com/account/location/AG-D5HZKZ2TNH/inbox', '_blank', 'noopener,noreferrer')}
                  >
                    Open in Vendasta Inbox
                    <LinkIcon className="w-4 h-4 ml-1 opacity-70" />
                  </Button>
                </div>

                {/* Status & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                    <div className="flex">
                      <div className={getStatusPillClass(viewingOrder.status)}>
                        {viewingOrder.status}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Location</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {locations.find(l => l.id === viewingOrder.locationId)?.name || "Unknown"}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Contact Information
                  </h3>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold">{viewingOrder.contactName.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium">{viewingOrder.contactName}</div>
                        <div className="flex flex-col gap-1 mt-1">
                          {viewingOrder.email && (
                            <a href={`mailto:${viewingOrder.email}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                              <Mail className="w-3.5 h-3.5" /> {viewingOrder.email}
                            </a>
                          )}
                          {viewingOrder.phone && (
                            <a href={`tel:${viewingOrder.phone}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {viewingOrder.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    Event Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-3 rounded-lg border text-center">
                      <div className="text-xs text-muted-foreground mb-1">Event Date</div>
                      <div className="font-semibold">{format(new Date(viewingOrder.eventDate), "MMM d, yyyy")}</div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border text-center">
                      <div className="text-xs text-muted-foreground mb-1">Guest Count</div>
                      <div className="font-semibold">{viewingOrder.guestCount} People</div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Order Notes / Details
                  </h3>
                  <div className="bg-muted/30 p-4 rounded-lg border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {viewingOrder.notes ? viewingOrder.notes : <span className="text-muted-foreground italic">No additional notes provided.</span>}
                  </div>
                </div>

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
