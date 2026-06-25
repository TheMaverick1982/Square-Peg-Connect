import { useLocationContext } from "@/lib/LocationContext";
import { mockContacts, mockCateringOrders } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CalendarDays, PartyPopper, UtensilsCrossed, ArrowUpRight, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FundraiserOrder } from "./FundraisersPipeline";

export default function Dashboard() {
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [fundraisers, setFundraisers] = useState<FundraiserOrder[]>([]);

  const { data: b2bContacts = [], isLoading: loadingB2b } = useQuery({
    queryKey: ['b2b_contacts', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_contacts').select('*').order('created_at', { ascending: false }).limit(5);
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    const fetchFundraisers = async () => {
      const { data } = await supabase.from('fundraisers').select('*').order('event_date', { ascending: true });
      if (data) {
        setFundraisers(data.map(row => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          address: row.address,
          organization: row.organization,
          locationId: row.location,
          eventDate: row.event_date,
          status: row.status,
          totalSales: parseFloat(row.total_sales || 0),
          totalDonated: parseFloat(row.total_donated || 0),
          createdAt: row.created_at,
        })));
      }
    };
    fetchFundraisers();
  }, []);

  // Filter data by selected location if one is set
  const contacts = selectedLocationId ? mockContacts.filter(c => c.locationId === selectedLocationId) : mockContacts;
  const catering = selectedLocationId ? mockCateringOrders.filter(c => c.locationId === selectedLocationId) : mockCateringOrders;
  const filteredFundraisers = selectedLocationId ? fundraisers.filter(c => c.locationId === selectedLocationId) : fundraisers;

  const totalCateringRev = catering.reduce((sum, order) => sum + order.totalAmount, 0);
  const activeFollowups = catering.filter(c => c.status === "Follow-up Needed" as any).length;
  const upcomingEvents = catering.filter(c => new Date(c.eventDate) > new Date()).length + filteredFundraisers.filter(f => new Date(f.eventDate) > new Date()).length;

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    order.status === 'Waiting on the customer' ? 'waiting' :
                    order.status === 'Waiting on you' ? 'followup' :
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
              {filteredFundraisers.map(event => (
                <div key={event.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{event.organization}</span>
                    <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-md">
                      {format(new Date(event.eventDate), "MMM d")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${event.totalSales} Sales</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${event.totalDonated} Donated</span>
                  </div>
                </div>
              ))}
              {filteredFundraisers.length === 0 && (
                <p className="text-sm text-muted-foreground">No fundraisers scheduled for this location.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Recent B2B Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingB2b ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : b2bContacts.length > 0 ? (
                b2bContacts.map((contact: any) => (
                  <div key={contact.id} className="flex flex-col gap-1 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{contact.organization_name}</span>
                      <span className="text-xs font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-md whitespace-nowrap">
                        {contact.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                      <span className="truncate">{contact.contact_name}</span>
                      <span className="whitespace-nowrap">{format(new Date(contact.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent B2B contacts found for this location.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}