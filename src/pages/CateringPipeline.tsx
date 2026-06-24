import { useState } from "react";
import { useLocationContext } from "@/lib/LocationContext";
import { mockCateringOrders, type CateringStatus } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search, Filter, Plus, Calendar as CalendarIcon, Users, Building2, MapPin, UtensilsCrossed } from "lucide-react";

type TabState = "all" | "upcoming" | "unopened" | "past";

export default function CateringPipeline() {
  const { selectedLocationId } = useLocationContext();
  const [activeTab, setActiveTab] = useState<TabState>("all");
  
  // Filter by location first
  const locationOrders = selectedLocationId 
    ? mockCateringOrders.filter(o => o.locationId === selectedLocationId)
    : mockCateringOrders;

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

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catering Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage catering leads and confirmed orders.</p>
        </div>
        <Button className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          New Request
        </Button>
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
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <UtensilsCrossed className="w-8 h-8 mb-3 opacity-20" />
              <p>No catering orders found for this view.</p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors cursor-pointer group">
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
                  <span>{mockCateringOrders.find(o => o.id === order.id)?.locationId === "loc-1" ? "Storrs" : 
                         mockCateringOrders.find(o => o.id === order.id)?.locationId === "loc-2" ? "Vernon" : 
                         mockCateringOrders.find(o => o.id === order.id)?.locationId === "loc-3" ? "Shelton" : 
                         mockCateringOrders.find(o => o.id === order.id)?.locationId === "loc-5" ? "Glastonbury" : "Location"}</span>
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
                    {/* Status dot indicator */}
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
    </div>
  );
}