import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertCircle, Handshake, Plus, Activity, Search, MapPin, Building2, Phone, Mail, Calendar, Target, CheckCircle2, Eye, User, Edit2, DollarSign, Trash2 } from "lucide-react";

// --- Constants ---
const CATEGORIES: Record<string, string[]> = {
  "Local Businesses": [
    "Real Estate Offices", "Insurance Agencies", "Banks", "Mortgage Brokers", 
    "Law Firms", "Accounting Firms", "Auto Dealers", "Healthcare Providers"
  ],
  "Community Organizations": [
    "Chamber of Commerce", "Rotary Club", "Lions Club", "Local Non-Profits", 
    "Churches", "Community Centers"
  ],
  "Schools & Youth Programs": [
    "High Schools", "Colleges", "PTO/PTA Groups", "Sports Leagues", "Youth Organizations"
  ],
  "Health & Wellness": [
    "Gyms", "Fitness Studios", "Physical Therapy Offices", "Wellness Centers"
  ]
};

const ACTIVITY_TYPES = [
  "Happy Hour", "Fundraiser", "Employee Appreciation Event", 
  "Team Celebration", "Catering Tasting", "Business Lunch", 
  "Community Event", "Networking Event"
];

// --- Types ---
type B2BContact = {
  id: string;
  location_id: string;
  organization_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string;
  subcategory: string;
  website: string | null;
  created_at: string;
};

type B2BActivity = {
  id: string;
  contact_id: string;
  activity_type: string;
  activity_date: string;
  notes: string | null;
  revenue: number | null;
  created_at: string;
  b2b_contacts?: {
    organization_name: string;
    location_id: string;
  };
};

export default function B2BPartnerships() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [isActivitySheetOpen, setIsActivitySheetOpen] = useState(false);
  const [selectedContactForActivity, setSelectedContactForActivity] = useState<string>("");
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"contacts" | "activities">("contacts");

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    organization_name: "",
    contact_name: "",
    email: "",
    website: "",
    phone: "",
    address: "",
    category: "",
    subcategory: "",
  });

  // Activity Form State
  const [activityForm, setActivityForm] = useState({
    activity_type: "",
    activity_date: format(new Date(), "yyyy-MM-dd"),
    revenue: "",
    notes: ""
  });

  // Fetch Data
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['b2b_contacts', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_contacts').select('*').order('created_at', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as B2BContact[];
    }
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['b2b_activities', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_activities').select('*, b2b_contacts!inner(location_id, organization_name)').order('activity_date', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('b2b_contacts.location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as B2BActivity[];
    }
  });

  const { data: actualFundraisers = [], isLoading: loadingFundraisers } = useQuery({
    queryKey: ['b2b_actual_fundraisers', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('fundraisers').select('id, event_date, location').is('deleted_at', null);
      if (selectedLocationId) {
        query = query.eq('location', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: actualStoreEvents = [], isLoading: loadingStoreEvents } = useQuery({
    queryKey: ['b2b_actual_store_events', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('store_events').select('id, event_date, location').is('deleted_at', null);
      if (selectedLocationId) {
        query = query.eq('location', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const isLoading = loadingContacts || loadingActivities || loadingFundraisers || loadingStoreEvents;

  // Mutations
  const createContact = useMutation({
    mutationFn: async (newContact: any) => {
      const { data, error } = await supabase.from('b2b_contacts').insert([newContact]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_contacts'] });
      setIsContactSheetOpen(false);
      setContactForm({
        organization_name: "", contact_name: "", email: "", website: "", phone: "", address: "", category: "", subcategory: ""
      });
      toast({ title: "Contact Added", description: "The B2B contact has been saved." });
    },
    onError: () => toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" })
  });

  const createActivity = useMutation({
    mutationFn: async (newActivity: any) => {
      const { data, error } = await supabase.from('b2b_activities').insert([newActivity]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_activities'] });
      setIsActivitySheetOpen(false);
      setActivityForm({ activity_type: "", activity_date: format(new Date(), "yyyy-MM-dd"), revenue: "", notes: "" });
      setSelectedContactForActivity("");
      toast({ title: "Activity Logged", description: "The activity has been successfully recorded." });
    },
    onError: () => toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" })
  });

  const updateActivity = useMutation({
    mutationFn: async (updatedActivity: any) => {
      const { id, ...updateData } = updatedActivity;
      const { data, error } = await supabase.from('b2b_activities').update(updateData).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_activities'] });
      setIsActivitySheetOpen(false);
      setEditingActivityId(null);
      setActivityForm({ activity_type: "", activity_date: format(new Date(), "yyyy-MM-dd"), revenue: "", notes: "" });
      setSelectedContactForActivity("");
      toast({ title: "Activity Updated", description: "The activity details have been updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to update activity.", variant: "destructive" })
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('b2b_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_contacts'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_activities'] });
      toast({ title: "Contact Deleted", description: "The contact has been removed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" })
  });

  // Derived KPI Calculations
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1 to 4

    // Target Connections for the quarter
    const quarterTargets: Record<number, number> = { 1: 10, 2: 15, 3: 20, 4: 25 };
    const quarterlyTarget = quarterTargets[currentQuarter] || 25;

    // Calculate days left in quarter
    const quarterEndMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)
    const quarterEndMonth = quarterEndMonths[currentQuarter - 1];
    const quarterEndDate = new Date(currentYear, quarterEndMonth + 1, 0); // Last day of that month
    
    // Set time to end of the day for accurate days left
    quarterEndDate.setHours(23, 59, 59, 999);
    const daysLeftInQuarter = Math.ceil((quarterEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // A contact counts as "Active" if it has complete details AND at least 1 activity THIS YEAR
    const activeContacts = contacts.filter(contact => {
      const hasDetails = contact.organization_name && contact.contact_name && (contact.email || contact.phone);
      const hasActivityThisYear = activities.some(act => {
        const actDate = new Date(act.activity_date);
        return act.contact_id === contact.id && actDate.getFullYear() === currentYear;
      });
      return hasDetails && hasActivityThisYear;
    });

    // Monthly activities
    const currentMonthActivities = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      return actDate.getMonth() === currentMonth && actDate.getFullYear() === currentYear;
    });
    
    // Yearly activities
    const currentYearActivities = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      return actDate.getFullYear() === currentYear;
    });

    const yearlyRevenue = currentYearActivities.reduce((sum, act) => sum + (act.revenue || 0), 0);

    const actualMonthlyStoreEvents = actualStoreEvents.filter(e => {
      if (!e.event_date) return false;
      const dateParts = e.event_date.split('-');
      if (dateParts.length !== 3) return false;
      const eMonth = parseInt(dateParts[1], 10) - 1;
      const eYear = parseInt(dateParts[0], 10);
      return eMonth === currentMonth && eYear === currentYear;
    }).length;

    const monthlyEvents = currentMonthActivities.filter(act => act.activity_type !== "Fundraiser").length + actualMonthlyStoreEvents;

    // Actual fundraisers from the Tuesday Fundraisers pipeline (filtered by location already)
    const actualMonthlyFundraisers = actualFundraisers.filter(f => {
      if (!f.event_date) return false;
      // Handle the yyyy-MM-dd cleanly
      const dateParts = f.event_date.split('-');
      if (dateParts.length !== 3) return false;
      const fMonth = parseInt(dateParts[1], 10) - 1; // 0-indexed
      const fYear = parseInt(dateParts[0], 10);
      return fMonth === currentMonth && fYear === currentYear;
    }).length;

    const connectionsRemaining = Math.max(0, quarterlyTarget - activeContacts.length);

    return {
      currentQuarter,
      quarterlyTarget,
      daysLeftInQuarter,
      connectionsRemaining,
      activeConnectionsCount: activeContacts.length,
      monthlyEvents,
      monthlyFundraisers: actualMonthlyFundraisers,
      yearlyRevenue
    };
  }, [contacts, activities, actualFundraisers, actualStoreEvents]);

  const viewingContact = contacts.find(c => c.id === viewingContactId) || null;
  const viewingContactActivities = activities.filter(a => a.contact_id === viewingContactId);

  // Filtering
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.organization_name.toLowerCase().includes(q) || 
      c.contact_name.toLowerCase().includes(q) || 
      c.category.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const filteredActivities = useMemo(() => {
    if (!searchQuery) return activities;
    const q = searchQuery.toLowerCase();
    return activities.filter(a => 
      a.activity_type.toLowerCase().includes(q) || 
      (a.notes && a.notes.toLowerCase().includes(q)) ||
      (a.b2b_contacts?.organization_name && a.b2b_contacts.organization_name.toLowerCase().includes(q))
    );
  }, [activities, searchQuery]);

  const openNewActivitySheet = (contactId?: string) => {
    setEditingActivityId(null);
    setActivityForm({ activity_type: "", activity_date: format(new Date(), "yyyy-MM-dd"), revenue: "", notes: "" });
    setSelectedContactForActivity(contactId || "");
    setIsActivitySheetOpen(true);
  };

  const openEditActivitySheet = (act: B2BActivity) => {
    setEditingActivityId(act.id);
    setSelectedContactForActivity(act.contact_id);
    setActivityForm({
      activity_type: act.activity_type,
      activity_date: format(new Date(act.activity_date), "yyyy-MM-dd"),
      revenue: act.revenue !== null ? act.revenue.toString() : "",
      notes: act.notes || ""
    });
    setIsActivitySheetOpen(true);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">B2B Partnerships</h1>
        <p className="text-muted-foreground mt-1">Manage local community contacts and track quarterly outreach goals.</p>
      </div>

      {/* Deadline Banner */}
      {dashboardStats.daysLeftInQuarter <= 30 && dashboardStats.connectionsRemaining > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-4 py-3 rounded-lg flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-sm">Action Required: Quarter {dashboardStats.currentQuarter} Ends Soon</h3>
            <p className="text-sm mt-1 opacity-90">
              Quarter {dashboardStats.currentQuarter} ends in <strong>{dashboardStats.daysLeftInQuarter} days</strong>. 
              You need <strong>{dashboardStats.connectionsRemaining} more {dashboardStats.connectionsRemaining === 1 ? 'connection' : 'connections'}</strong> to hit your quarterly growth requirement.
            </p>
          </div>
        </div>
      )}
      {dashboardStats.daysLeftInQuarter <= 30 && dashboardStats.connectionsRemaining === 0 && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-900 dark:text-green-200 px-4 py-3 rounded-lg flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-sm">Goal Achieved!</h3>
            <p className="text-sm mt-1 opacity-90">
              You've successfully hit your target of {dashboardStats.quarterlyTarget} connections for Quarter {dashboardStats.currentQuarter}. Excellent work!
            </p>
          </div>
        </div>
      )}

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Q{dashboardStats.currentQuarter} Growth Progress
              <Target className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">{dashboardStats.activeConnectionsCount}</span>
              <span className="text-sm text-muted-foreground">/ {dashboardStats.quarterlyTarget} Connections</span>
            </div>
            <Progress value={(dashboardStats.activeConnectionsCount / dashboardStats.quarterlyTarget) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              Requires full contact details + 1 logged activity to count.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Community Events (This Month)
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">{dashboardStats.monthlyEvents}</span>
              <span className="text-sm text-muted-foreground">/ 2 Min. Required</span>
            </div>
            <Progress value={Math.min((dashboardStats.monthlyEvents / 2) * 100, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              Happy Hours, Tastings, Business Lunches, etc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Fundraisers (This Month)
              <Handshake className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">{dashboardStats.monthlyFundraisers}</span>
              <span className="text-sm text-muted-foreground">/ 1 Min. Required</span>
            </div>
            <Progress value={Math.min((dashboardStats.monthlyFundraisers / 1) * 100, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              School, youth sports, or non-profit fundraisers.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between text-green-800 dark:text-green-400">
              Total Revenue (This Year)
              <span className="text-lg font-bold">💰</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-green-900 dark:text-green-300">
                ${dashboardStats.yearlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-5">
              Total revenue generated from all logged B2B events this calendar year.
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as any)} className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-6">
            <TabsList>
              <TabsTrigger value="contacts" className="gap-2">
                <Building2 className="w-4 h-4" /> Contacts
              </TabsTrigger>
              <TabsTrigger value="activities" className="gap-2">
                <Activity className="w-4 h-4" /> Activity Feed
              </TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder={viewMode === "contacts" ? "Search contacts..." : "Search activities..."} 
                className="pl-9 w-72 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* Add Contact Form */}
            <Sheet open={isContactSheetOpen} onOpenChange={setIsContactSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  Add Contact
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>New Community Contact</SheetTitle>
                  <SheetDescription>Add a new local business or organization to your network.</SheetDescription>
                </SheetHeader>
                <div className="space-y-5 mt-6">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={contactForm.category} onValueChange={(v) => setContactForm({ ...contactForm, category: v, subcategory: "" })}>
                      <SelectTrigger><SelectValue placeholder="Select a category..." /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(CATEGORIES).map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {contactForm.category && (
                    <div className="grid gap-2">
                      <Label>Subcategory</Label>
                      <Select value={contactForm.subcategory} onValueChange={(v) => setContactForm({ ...contactForm, subcategory: v })}>
                        <SelectTrigger><SelectValue placeholder="Select a subcategory..." /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES[contactForm.category].map(sub => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>Organization Name</Label>
                    <Input value={contactForm.organization_name} onChange={(e) => setContactForm({ ...contactForm, organization_name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Main Contact Person</Label>
                    <Input value={contactForm.contact_name} onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Website</Label>
                    <Input type="url" placeholder="https://" value={contactForm.website} onChange={(e) => setContactForm({ ...contactForm, website: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Address</Label>
                    <Input value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} />
                  </div>
                </div>
                <SheetFooter className="mt-8">
                  <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
                  <Button 
                    onClick={() => createContact.mutate({
                      ...contactForm, 
                      location_id: selectedLocationId || locations[0].id
                    })}
                    disabled={!contactForm.organization_name || !contactForm.category}
                  >
                    Save Contact
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {/* Log / Edit Activity Form */}
            <Sheet open={isActivitySheetOpen} onOpenChange={(open) => {
              setIsActivitySheetOpen(open);
              if (!open) setEditingActivityId(null);
            }}>
              <Button className="gap-2 shadow-sm" onClick={() => openNewActivitySheet()}>
                <Activity className="w-4 h-4" />
                Log Activity
              </Button>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{editingActivityId ? "Edit Activity" : "Log an Activity"}</SheetTitle>
                  <SheetDescription>
                    {editingActivityId 
                      ? "Update notes or record finalized revenue for this event." 
                      : "Record a meeting, event, or interaction with a contact."}
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-5 mt-6">
                  <div className="grid gap-2">
                    <Label>Select Contact</Label>
                    <Select 
                      value={selectedContactForActivity} 
                      onValueChange={setSelectedContactForActivity}
                      disabled={!!editingActivityId}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a contact..." /></SelectTrigger>
                      <SelectContent>
                        {contacts.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.organization_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Activity Type</Label>
                    <Select value={activityForm.activity_type} onValueChange={(v) => setActivityForm({ ...activityForm, activity_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select activity..." /></SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Input type="date" value={activityForm.activity_date} onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Revenue Generated ($) <span className="text-muted-foreground font-normal text-xs ml-1">(Optional)</span></Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00"
                      value={activityForm.revenue} 
                      onChange={(e) => setActivityForm({ ...activityForm, revenue: e.target.value })} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes / Details</Label>
                    <Textarea 
                      rows={4} 
                      placeholder="Who attended? What was the outcome?"
                      value={activityForm.notes} 
                      onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })} 
                    />
                  </div>
                </div>
                <SheetFooter className="mt-8">
                  <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
                  <Button 
                    onClick={() => {
                      const payload = {
                        ...activityForm,
                        revenue: activityForm.revenue ? parseFloat(activityForm.revenue) : null,
                        contact_id: selectedContactForActivity
                      };
                      if (editingActivityId) {
                        updateActivity.mutate({ ...payload, id: editingActivityId });
                      } else {
                        createActivity.mutate(payload);
                      }
                    }}
                    disabled={!selectedContactForActivity || !activityForm.activity_type}
                  >
                    {editingActivityId ? "Save Changes" : "Save Activity"}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex-1 mt-6">
          <TabsContent value="contacts" className="h-full m-0 p-0">
            {/* Contacts List */}
            <div className="bg-card border rounded-lg overflow-hidden h-[600px] flex flex-col">
              <div className="overflow-x-auto h-full flex flex-col">
                <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                  <div className="col-span-3">Organization & Contact</div>
                  <div className="col-span-3">Category</div>
                  <div className="col-span-3">Contact Info</div>
                  <div className="col-span-2">Last Activity</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="divide-y overflow-auto flex-1 min-w-[800px]">
                  {loadingContacts || loadingActivities ? (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                      <p>Loading network data...</p>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                      <Building2 className="w-8 h-8 mb-3 opacity-20" />
                      <p>No community contacts found.</p>
                      <Button 
                        variant="link" 
                        onClick={() => setIsContactSheetOpen(true)}
                        className="mt-2"
                      >
                        Add your first contact
                      </Button>
                    </div>
                  ) : (
                    filteredContacts.map(contact => {
                      const contactActs = activities.filter(a => a.contact_id === contact.id);
                      const lastAct = contactActs.length > 0 ? contactActs[0] : null;

                      return (
                        <div key={contact.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors">
                          <div className="col-span-3">
                            <div className="font-semibold text-sm text-foreground">{contact.organization_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{contact.contact_name}</div>
                          </div>
                          
                          <div className="col-span-3">
                            <div className="text-sm font-medium">{contact.category}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{contact.subcategory}</div>
                          </div>

                          <div className="col-span-3 space-y-1">
                            {contact.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                {contact.phone}
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">{contact.email}</span>
                              </div>
                            )}
                          </div>

                          <div className="col-span-2 text-sm text-muted-foreground flex flex-col gap-1">
                            {lastAct ? (
                              <>
                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  {format(new Date(lastAct.activity_date), "MMM d, yyyy")}
                                </div>
                                <div className="text-xs truncate">{lastAct.activity_type}</div>
                              </>
                            ) : (
                              <span className="text-xs italic opacity-60">No activity logged</span>
                            )}
                          </div>

                          <div className="col-span-1 flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setViewingContactId(contact.id)}>
                              <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete {contact.organization_name} and all of their logged activities. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteContact.mutate(contact.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Contact
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activities" className="h-full m-0 p-0">
            {/* Activity Feed List */}
            <div className="bg-card border rounded-lg overflow-hidden h-[600px] flex flex-col">
              <div className="overflow-x-auto h-full flex flex-col">
                <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-3">Organization</div>
                  <div className="col-span-3">Activity & Notes</div>
                  <div className="col-span-3">Revenue Generated</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="divide-y overflow-auto flex-1 min-w-[800px]">
                  {loadingActivities ? (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                      <p>Loading activities...</p>
                    </div>
                  ) : filteredActivities.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                      <Activity className="w-8 h-8 mb-3 opacity-20" />
                      <p>No activities logged yet.</p>
                    </div>
                  ) : (
                    filteredActivities.map(act => (
                      <div key={act.id} className="grid grid-cols-12 gap-4 p-4 items-start hover:bg-muted/10 transition-colors">
                        <div className="col-span-2">
                          <div className="text-sm font-medium text-foreground">
                            {format(new Date(act.activity_date), "MMM d, yyyy")}
                          </div>
                        </div>
                        
                        <div className="col-span-3">
                          <div className="font-semibold text-sm text-foreground">
                            {act.b2b_contacts?.organization_name || "Unknown Organization"}
                          </div>
                        </div>

                        <div className="col-span-3">
                          <div className="text-sm font-medium">{act.activity_type}</div>
                          {act.notes && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2" title={act.notes}>
                              {act.notes}
                            </div>
                          )}
                        </div>

                        <div className="col-span-3">
                          {act.revenue != null && act.revenue > 0 ? (
                            <div className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/50">
                              <DollarSign className="w-3 h-3" />
                              {act.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No revenue recorded</span>
                          )}
                        </div>

                        <div className="col-span-1 flex justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEditActivitySheet(act)}>
                            <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* View Contact Sheet */}
      <Sheet open={!!viewingContactId} onOpenChange={(open) => !open && setViewingContactId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewingContact && (
            <>
              <SheetHeader>
                <SheetTitle>{viewingContact.organization_name}</SheetTitle>
                <SheetDescription>{viewingContact.category} • {viewingContact.subcategory}</SheetDescription>
              </SheetHeader>
              
              <div className="mt-8 space-y-8">
                {/* Contact Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-4 text-foreground">Contact Details</h4>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium text-foreground">{viewingContact.contact_name}</div>
                        <div className="text-xs text-muted-foreground">Main Contact</div>
                      </div>
                    </div>
                    {viewingContact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${viewingContact.phone}`} className="text-primary hover:underline">{viewingContact.phone}</a>
                      </div>
                    )}
                    {viewingContact.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${viewingContact.email}`} className="text-primary hover:underline">{viewingContact.email}</a>
                      </div>
                    )}
                    {viewingContact.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">{viewingContact.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Activity History */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-semibold text-foreground">Activity History</h4>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => {
                      setViewingContactId(null);
                      openNewActivitySheet(viewingContact.id);
                    }}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Log Activity
                    </Button>
                  </div>
                  
                  <div className="space-y-0">
                    {viewingContactActivities.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-6 italic border border-dashed rounded-lg bg-muted/10">
                        No activities logged yet.
                      </div>
                    ) : (
                      viewingContactActivities.map((act) => (
                        <div key={act.id} className="relative pl-6 pb-6 last:pb-0 border-l border-muted-foreground/20 last:border-transparent group">
                          <div className="absolute w-2.5 h-2.5 bg-primary rounded-full left-[-5.5px] top-1.5 ring-4 ring-background" />
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                {act.activity_type}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    setViewingContactId(null);
                                    openEditActivitySheet(act);
                                  }}
                                >
                                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(act.activity_date), "MMM d, yyyy")}
                              </div>
                            </div>
                            {act.revenue != null && act.revenue > 0 && (
                              <div className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/50 flex items-center gap-1">
                                <span>+${act.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </div>
                          {act.notes && (
                            <div className="text-sm mt-2.5 bg-muted/30 p-3 rounded-md border border-border/50 text-muted-foreground leading-relaxed">
                              {act.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
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
