import { useLocationContext } from "@/lib/LocationContext";
import { mockContacts, mockCateringOrders, mockFundraisers } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CalendarDays, PartyPopper, UtensilsCrossed, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { selectedLocationId, selectedLocation } = useLocationContext();

  // Filter mock data by selected location if one is set
  const contacts = selectedLocationId ? mockContacts.filter(c => c.locationId === selectedLocationId) : mockContacts;
  const catering = selectedLocationId ? mockCateringOrders.filter(c => c.locationId === selectedLocationId) : mockCateringOrders;
  const fundraisers = selectedLocationId ? mockFundraisers.filter(c => c.locationId === selectedLocationId) : mockFundraisers;

  const totalCateringRev = catering.reduce((sum, order) => sum + order.totalAmount, 0);
  const activeFollowups = catering.filter(c => c.status === "Follow-up Needed").length;
  const upcomingEvents = catering.filter(c => new Date(c.eventDate) > new Date()).length + fundraisers.filter(f => new Date(f.eventDate) > new Date()).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview for {selectedLocation ? selectedLocation.name : "All Locations"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +2 from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCateringRev.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active catering orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled in next 30 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Action Required</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{activeFollowups}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Catering follow-ups due
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              Recent Catering Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {catering.slice(0, 4).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm">{order.contactName} - {order.eventName}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(order.eventDate), "MMM d, yyyy")} • ${order.totalAmount}</span>
                  </div>
                  <div className={`status-pill ${
                    order.status === 'Waiting on Customer' ? 'waiting' :
                    order.status === 'Follow-up Needed' ? 'followup' :
                    order.status === 'Confirmed' ? 'confirmed' : 'complete'
                  }`}>
                    {order.status}
                  </div>
                </div>
              ))}
              {catering.length === 0 && (
                <p className="text-sm text-muted-foreground">No catering orders found for this location.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-primary" />
              Next Tuesday Fundraisers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fundraisers.map(event => (
                <div key={event.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{event.eventName}</span>
                    <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-md">
                      {format(new Date(event.eventDate), "MMM d")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.customersAttended} Attended</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${event.revenueGenerated} Raised</span>
                  </div>
                </div>
              ))}
              {fundraisers.length === 0 && (
                <p className="text-sm text-muted-foreground">No fundraisers scheduled for this location.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}