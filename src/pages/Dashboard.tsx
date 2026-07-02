import { useLocationContext } from "@/lib/LocationContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CalendarDays, PartyPopper, UtensilsCrossed, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { selectedLocationId, selectedLocation } = useLocationContext();

  const { data: b2bContacts = [], isLoading: loadingB2b } = useQuery({
    queryKey: ['b2b_contacts', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_contacts').select('*').order('created_at', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: cateringOrders = [], isLoading: loadingCatering } = useQuery({
    queryKey: ['catering_orders_dashboard', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('catering_requests').select('*').order('created_at', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('location', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: fundraisers = [], isLoading: loadingFundraisers } = useQuery({
    queryKey: ['fundraisers_dashboard', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('fundraisers').select('*').is('deleted_at', null).order('event_date', { ascending: true });
      if (selectedLocationId) {
        query = query.eq('location', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: guestBounceBacks = [] } = useQuery({
    queryKey: ['gbb_dashboard', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('guest_bounce_backs').select('id');
      if (selectedLocationId) query = query.eq('location_id', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: storeEvents = [] } = useQuery({
    queryKey: ['store_events_dashboard', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('store_events').select('*').is('deleted_at', null);
      if (selectedLocationId) query = query.eq('location', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate actual total contacts
  const totalContacts = b2bContacts.length + cateringOrders.length + fundraisers.length + guestBounceBacks.length + storeEvents.length;

  // Calculate actual catering pipeline value (excluding Completed)
  const activeCateringOrders = cateringOrders.filter(c => c.status !== 'Completed');
  const totalCateringRev = activeCateringOrders.reduce((sum, order) => sum + (Number(order.quote_total) || 0), 0);
  const activeFollowups = cateringOrders.filter(c => c.status === 'Needs Quote' || c.status === 'Sent/Follow-up').length;

  const upcomingEvents = cateringOrders.filter(c => c.event_date && new Date(c.event_date) > new Date()).length 
    + fundraisers.filter(f => f.event_date && new Date(f.event_date) > new Date()).length
    + storeEvents.filter(e => e.event_date && new Date(e.event_date) > new Date()).length;

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
            <div className="text-2xl font-bold">{totalContacts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tracked across all modules
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCateringRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active catering orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Entertainment</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled events
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
              {loadingCatering ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : cateringOrders.length > 0 ? (
                cateringOrders.slice(0, 4).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm">{order.name} - {order.event_name || 'Catering Order'}</span>
                      <span className="text-xs text-muted-foreground">{order.event_date ? format(new Date(order.event_date), "MMM d, yyyy") : 'No Date'} • ${Number(order.quote_total || 0).toFixed(2)}</span>
                    </div>
                    <div className={`status-pill ${
                      order.status === 'New Request' ? 'waiting' :
                      order.status === 'Needs Quote' || order.status === 'Sent/Follow-up' ? 'followup' :
                      order.status === 'Confirmed' ? 'confirmed' : 'complete'
                    }`}>
                      {order.status || 'Requested'}
                    </div>
                  </div>
                ))
              ) : (
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
              {loadingFundraisers ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : fundraisers.length > 0 ? (
                fundraisers.slice(0, 4).map((event: any) => (
                  <div key={event.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{event.organization}</span>
                      <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-md">
                        {event.event_date ? format(new Date(event.event_date), "MMM d") : 'No Date'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${Number(event.total_sales || 0).toLocaleString()} Sales</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${Number(event.total_donated || 0).toLocaleString()} Donated</span>
                    </div>
                  </div>
                ))
              ) : (
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
                b2bContacts.slice(0, 4).map((contact: any) => (
                  <div key={contact.id} className="flex flex-col gap-1 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{contact.organization_name}</span>
                      <span className="text-xs font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-md whitespace-nowrap">
                        {contact.category || 'General'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                      <span className="truncate">{contact.contact_name}</span>
                      <span className="whitespace-nowrap">{contact.created_at ? format(new Date(contact.created_at), "MMM d, yyyy") : ''}</span>
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