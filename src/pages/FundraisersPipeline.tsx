import { useState, useEffect } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Filter, Calendar as CalendarIcon, MapPin, Link as LinkIcon, DollarSign, Building, Phone, Mail, FileText } from "lucide-react";

export interface FundraiserOrder {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  organization: string;
  locationId: string;
  eventDate: string;
  status: "Requested" | "Confirmed" | "Completed";
  totalSales: number;
  totalDonated: number;
  createdAt: string;
}

export default function FundraisersPipeline() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const [orders, setOrders] = useState<FundraiserOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sheet state
  const [viewingOrder, setViewingOrder] = useState<FundraiserOrder | null>(null);

  // Edit state for sales/donated
  const [salesInput, setSalesInput] = useState("");
  const [donatedInput, setDonatedInput] = useState("");

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('fundraisers')
      .select('*')
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
        locationId: row.location,
        eventDate: row.event_date,
        status: row.status as "Requested" | "Confirmed" | "Completed",
        totalSales: parseFloat(row.total_sales || 0),
        totalDonated: parseFloat(row.total_donated || 0),
        createdAt: row.created_at,
      }));
      setOrders(mappedOrders);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/public/fundraisers`;
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

  // Filter by location 
  const filteredOrders = selectedLocationId 
    ? orders.filter(o => o.locationId === selectedLocationId)
    : orders;

  const getStatusPillClass = (status: string) => {
    switch (status) {
      case "Requested": return "status-pill followup";
      case "Confirmed": return "status-pill confirmed";
      case "Completed": return "status-pill confirmed ring-1 ring-green-600 bg-green-500/10 text-green-700";
      default: return "status-pill followup";
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tuesday Fundraisers</h1>
          <p className="text-muted-foreground mt-1">Manage fundraiser requests, approvals, and performance tracking.</p>
        </div>
        
        <Button variant="outline" className="gap-2 shadow-sm" onClick={handleCopyLink}>
          <LinkIcon className="w-4 h-4" />
          Copy Booking Link
        </Button>
      </div>

      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search fundraisers..." 
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
          <div className="col-span-3">Organization</div>
          <div className="col-span-3">Date & Location</div>
          <div className="col-span-3">Financials</div>
          <div className="col-span-3">Status</div>
        </div>

        <div className="divide-y overflow-auto h-[calc(100%-49px)]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
              <p>Loading fundraisers...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <Building className="w-8 h-8 mb-3 opacity-20" />
              <p>No fundraiser requests found.</p>
            </div>
          ) : (
            filteredOrders.map(order => (
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
                    <span>{format(new Date(order.eventDate), "MMM d, yyyy")}</span>
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
                      <div className="text-xs text-muted-foreground">Donated: ${order.totalDonated.toLocaleString()}</div>
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

      {/* Details View Sheet */}
      <Sheet open={viewingOrder !== null} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewingOrder && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-2xl">{viewingOrder.organization}</SheetTitle>
                    <SheetDescription className="mt-1">
                      Event Date: <strong className="text-foreground">{format(new Date(viewingOrder.eventDate), "MMMM d, yyyy")}</strong>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

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
                    Updating this to <strong>Confirmed</strong> will permanently lock {format(new Date(viewingOrder.eventDate), "MMMM d")} on the public booking calendar for this location.
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
