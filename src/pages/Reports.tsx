import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Users, Briefcase, CalendarDays, BarChart3, Target, UtensilsCrossed, PartyPopper, Calendar as CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

const isDateInRange = (dateStr: string | null | undefined, range: DateRange | undefined) => {
  if (!dateStr) return false;
  if (!range?.from && !range?.to) return true;
  const d = parseISO(dateStr);
  
  const from = range.from ? startOfDay(range.from) : undefined;
  const to = range.to ? endOfDay(range.to) : undefined;

  if (from && to) return d >= from && d <= to;
  if (from) return d >= from;
  if (to) return d <= to;
  return true;
};

export default function Reports() {
  const { selectedLocationId } = useLocationContext();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Fetch all necessary data
  const { data: rawB2bActivities = [], isLoading: isLoadingB2B } = useQuery({
    queryKey: ['b2b_activities_report', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_activities').select('*, contact:b2b_contacts(*)');
      if (selectedLocationId) {
         // Join filtering is complex here, but we can filter client side or handle carefully.
         // Let's just fetch all and filter client-side for simplicity on B2B
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: b2bContacts = [] } = useQuery({
    queryKey: ['b2b_contacts_report', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_contacts').select('*');
      if (selectedLocationId) query = query.eq('location_id', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: rawCatering = [], isLoading: isLoadingCatering } = useQuery({
    queryKey: ['catering_report', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('catering_requests').select('*');
      if (selectedLocationId) query = query.eq('location', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: rawFundraisers = [], isLoading: isLoadingFundraisers } = useQuery({
    queryKey: ['fundraisers_report', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('fundraisers').select('*');
      if (selectedLocationId) query = query.eq('location', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: rawGuestBounceBacks = [], isLoading: isLoadingGBB } = useQuery({
    queryKey: ['gbb_report', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('guest_bounce_backs').select('*');
      if (selectedLocationId) query = query.eq('location_id', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const { data: rawTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks_report', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('reminders').select('*');
      if (selectedLocationId) query = query.eq('location_id', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = isLoadingB2B || isLoadingCatering || isLoadingFundraisers || isLoadingGBB || isLoadingTasks;

  // Apply date filters
  const catering = useMemo(() => rawCatering.filter((c: any) => isDateInRange(c.event_date || c.created_at, dateRange)), [rawCatering, dateRange]);
  const fundraisers = useMemo(() => rawFundraisers.filter((f: any) => isDateInRange(f.event_date || f.created_at, dateRange)), [rawFundraisers, dateRange]);
  const guestBounceBacks = useMemo(() => rawGuestBounceBacks.filter((g: any) => isDateInRange(g.created_at, dateRange)), [rawGuestBounceBacks, dateRange]);
  const tasks = useMemo(() => rawTasks.filter((t: any) => isDateInRange(t.due_date || t.created_at, dateRange)), [rawTasks, dateRange]);

  // Filter B2B activities based on the selected location's contacts AND date
  const filteredB2BActivities = useMemo(() => {
    let activities = rawB2bActivities;
    if (selectedLocationId) {
      const allowedContactIds = new Set(b2bContacts.map(c => c.id));
      activities = activities.filter(a => allowedContactIds.has(a.contact_id));
    }
    return activities.filter(a => isDateInRange(a.activity_date, dateRange));
  }, [rawB2bActivities, b2bContacts, selectedLocationId, dateRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    // 1. Catering Revenue (Completed orders)
    const cateringRevenue = catering
      .filter(c => c.status === 'Completed')
      .reduce((sum, c) => sum + (Number(c.quote_total) || 0), 0);

    // 2. Fundraiser Revenue (Completed/Donated)
    const fundraiserRevenue = fundraisers
      .reduce((sum, f) => sum + (Number(f.total_sales) || 0), 0);

    // 3. B2B Event Revenue
    const b2bRevenue = filteredB2BActivities.reduce((sum, a) => sum + (Number(a.revenue) || 0), 0);

    const totalRevenue = cateringRevenue + fundraiserRevenue + b2bRevenue;

    // Contacts
    const totalContactsTracked = b2bContacts.length + catering.length + fundraisers.length + guestBounceBacks.length;

    // Task Completion
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.is_completed).length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalRevenue,
      cateringRevenue,
      fundraiserRevenue,
      b2bRevenue,
      totalContactsTracked,
      taskCompletionRate,
      completedTasks,
      totalTasks
    };
  }, [catering, fundraisers, filteredB2BActivities, b2bContacts, guestBounceBacks, tasks]);

  // Monthly Revenue Chart Data
  const revenueChartData = useMemo(() => {
    const monthlyMap: Record<string, { month: string; Catering: number; Fundraisers: number; B2B: number }> = {};
    
    // Helper to add revenue
    const addRevenue = (dateStr: string, source: 'Catering' | 'Fundraisers' | 'B2B', amount: number) => {
      if (!dateStr || amount === 0) return;
      const monthStr = dateStr.substring(0, 7); // YYYY-MM
      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { month: monthStr, Catering: 0, Fundraisers: 0, B2B: 0 };
      }
      monthlyMap[monthStr][source] += amount;
    };

    catering.filter(c => c.status === 'Completed').forEach(c => addRevenue(c.event_date, 'Catering', Number(c.quote_total) || 0));
    fundraisers.forEach(f => addRevenue(f.event_date, 'Fundraisers', Number(f.total_sales) || 0));
    filteredB2BActivities.forEach(a => addRevenue(a.activity_date, 'B2B', Number(a.revenue) || 0));

    return Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => ({
        ...d,
        monthName: format(parseISO(`${d.month}-01`), 'MMM yyyy')
      }));
  }, [catering, fundraisers, filteredB2BActivities]);

  // Guest Bounce Back Funnel Data
  const funnelData = useMemo(() => {
    let v1 = 0, v2 = 0, v3 = 0, v4 = 0;
    guestBounceBacks.forEach(g => {
      if (g.visit_1_date) v1++;
      if (g.visit_2_date) v2++;
      if (g.visit_3_date) v3++;
      if (g.visit_4_date) v4++;
    });
    return [
      { stage: 'Visit 1', count: v1 },
      { stage: 'Visit 2', count: v2 },
      { stage: 'Visit 3', count: v3 },
      { stage: 'Visit 4', count: v4 },
    ];
  }, [guestBounceBacks]);

  // Pipeline Status Breakdown
  const pipelineData = useMemo(() => {
    const cPending = catering.filter(c => c.status !== 'Completed').length;
    const cCompleted = catering.filter(c => c.status === 'Completed').length;
    const fPending = fundraisers.filter(f => f.status !== 'Completed').length;
    const fCompleted = fundraisers.filter(f => f.status === 'Completed').length;

    return [
      { name: 'Pending Orders', value: cPending + fPending, fill: 'hsl(var(--muted-foreground))' },
      { name: 'Completed Entertainment', value: cCompleted + fCompleted, fill: 'hsl(var(--primary))' },
    ];
  }, [catering, fundraisers]);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">System-wide performance metrics and pipeline health.</p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Top KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue Generated</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Across Catering, Fundraisers & B2B</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalContactsTracked.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Tracked across all modules</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.taskCompletionRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">{metrics.completedTasks} of {metrics.totalTasks} pending tasks closed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Pipeline</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{catering.filter(c => c.status !== 'Completed').length + fundraisers.filter(f => f.status !== 'Completed').length}</div>
                <p className="text-xs text-muted-foreground mt-1">Pending orders & fundraisers</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Revenue Trend Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Monthly generated revenue by source.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {revenueChartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      Catering: { label: "Catering", color: "hsl(var(--chart-1))" },
                      Fundraisers: { label: "Fundraisers", color: "hsl(var(--chart-2))" },
                      B2B: { label: "B2B Events", color: "hsl(var(--chart-3))" }
                    }}
                    className="h-full w-full"
                  >
                    <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="monthName" />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="Catering" stackId="a" fill="var(--color-Catering)" />
                      <Bar dataKey="Fundraisers" stackId="a" fill="var(--color-Fundraisers)" />
                      <Bar dataKey="B2B" stackId="a" fill="var(--color-B2B)" />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No revenue data available yet.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guest Bounce Back Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Guest Retention</CardTitle>
                <CardDescription>Guest Bounce Back conversion drops.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {funnelData[0].count > 0 ? (
                   <ChartContainer
                     config={{
                       Visit: { label: "Guests", color: "hsl(var(--primary))" }
                     }}
                     className="h-full w-full"
                   >
                     <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                       <XAxis type="number" />
                       <YAxis dataKey="stage" type="category" />
                       <Tooltip content={<ChartTooltipContent />} />
                       <Bar dataKey="count" fill="var(--color-Visit)" radius={[0, 4, 4, 0]} />
                     </BarChart>
                   </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-center px-4">
                    Track guests in the Guest Bounce Back tool to see retention data here.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Status Breakdown */}
             <Card>
              <CardHeader>
                <CardTitle>Pipeline Health</CardTitle>
                <CardDescription>Pending vs. Completed events.</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px] flex items-center justify-center">
                 {pipelineData[0].value > 0 || pipelineData[1].value > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pipelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                 ) : (
                    <div className="text-muted-foreground text-sm">No pipeline data.</div>
                 )}
              </CardContent>
            </Card>

            {/* Module Breakdowns */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" /> Catering Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm text-muted-foreground">Total Orders</span>
                    <span className="font-semibold">{catering.length}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-semibold">{catering.filter(c => c.status === 'Completed').length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg. Order Value</span>
                    <span className="font-semibold text-primary">
                      ${catering.filter(c => c.status === 'Completed').length > 0 
                        ? (metrics.cateringRevenue / catering.filter(c => c.status === 'Completed').length).toFixed(2)
                        : '0.00'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PartyPopper className="w-4 h-4" /> Fundraiser Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm text-muted-foreground">Total Fundraisers</span>
                    <span className="font-semibold">{fundraisers.length}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-semibold">{fundraisers.filter(c => c.status === 'Completed').length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Donated</span>
                    <span className="font-semibold text-primary">
                      ${fundraisers.reduce((sum, f) => sum + (Number(f.total_donated) || 0), 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PartyPopper className="w-4 h-4" /> Fundraisers by Organization
                  </CardTitle>
                  <CardDescription>Total sales and donations grouped by organization.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.values(fundraisers.reduce((acc, f) => {
                      if (!acc[f.organization]) {
                        acc[f.organization] = { name: f.organization, sales: 0, donated: 0, events: 0 };
                      }
                      acc[f.organization].sales += Number(f.total_sales) || 0;
                      acc[f.organization].donated += Number(f.total_donated) || 0;
                      acc[f.organization].events += 1;
                      return acc;
                    }, {} as Record<string, { name: string, sales: number, donated: number, events: number }>))
                    .sort((a: any, b: any) => b.donated - a.donated)
                    .map((org: any, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                        <div>
                          <div className="font-semibold text-sm">{org.name}</div>
                          <div className="text-xs text-muted-foreground">{org.events} {org.events === 1 ? 'Event' : 'Events'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">${org.donated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Donated</div>
                          <div className="text-xs text-muted-foreground">${org.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Sales</div>
                        </div>
                      </div>
                    ))}
                    {fundraisers.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">No fundraiser data available.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </div>
        </>
      )}
    </div>
  );
}
