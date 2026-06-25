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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Handshake, Plus, Activity, Search, MapPin, Building2, Phone, Mail, Calendar, Target, CheckCircle2, Eye, User } from "lucide-react";

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
  created_at: string;
};

type B2BActivity = {
  id: string;
  contact_id: string;
  activity_type: string;
  activity_date: string;
  notes: string | null;
  created_at: string;
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

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    organization_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    subcategory: "",
  });

  // Activity Form State
  const [activityForm, setActivityForm] = useState({
    activity_type: "",
    activity_date: format(new Date(), "yyyy-MM-dd"),
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
      let query = supabase.from('b2b_activities').select('*, b2b_contacts!inner(location_id)').order('activity_date', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('b2b_contacts.location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as B2BActivity[];
    }
  });

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
        organization_name: "", contact_name: "", email: "", phone: "", address: "", category: "", subcategory: ""
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
      setActivityForm({ activity_type: "", activity_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
      setSelectedContactForActivity("");
      toast({ title: "Activity Logged", description: "The activity has been successfully recorded." });
    },
    onError: () => toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" })
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

    // A contact counts as "Active" if it has complete details AND at least 1 activity
    const activeContacts = contacts.filter(contact => {
      const hasDetails = contact.organization_name && contact.contact_name && (contact.email || contact.phone);
      const hasActivity = activities.some(act => act.contact_id === contact.id);
      return hasDetails && hasActivity;
    });

    // Monthly activities
    const currentMonthActivities = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      return actDate.getMonth() === currentMonth && actDate.getFullYear() === currentYear;
    });

    const monthlyFundraisers = currentMonthActivities.filter(act => act.activity_type === "Fundraiser").length;
    const monthlyEvents = currentMonthActivities.filter(act => act.activity_type !== "Fundraiser").length;

    return {
      currentQuarter,
      quarterlyTarget,
      activeConnectionsCount: activeContacts.length,
      monthlyEvents,
      monthlyFundraisers
    };
  }, [contacts, activities]);

  const viewingContact = contacts.find(c => c.id === viewingContactId) || null;
  const viewingContactActivities = activities.filter(a => a.contact_id === viewingContactId);

  // Filtering Contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.organization_name.toLowerCase().includes(q) || 
      c.contact_name.toLowerCase().includes(q) || 
      c.category.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">B2B Partnerships</h1>
        <p className="text-muted-foreground mt-1">Manage local community contacts and track quarterly outreach goals.</p>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search contacts..." 
            className="pl-9 w-72 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

          {/* Log Activity Form */}
          <Sheet open={isActivitySheetOpen} onOpenChange={setIsActivitySheetOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2 shadow-sm">
                <Activity className="w-4 h-4" />
                Log Activity
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Log an Activity</SheetTitle>
                <SheetDescription>Record a meeting, event, or interaction with a contact.</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-6">
                <div className="grid gap-2">
                  <Label>Select Contact</Label>
                  <Select value={selectedContactForActivity} onValueChange={setSelectedContactForActivity}>
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
                  onClick={() => createActivity.mutate({
                    ...activityForm,
                    contact_id: selectedContactForActivity
                  })}
                  disabled={!selectedContactForActivity || !activityForm.activity_type}
                >
                  Save Activity
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Contacts List */}
      <div className="bg-card border rounded-lg overflow-hidden flex-1">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-3">Organization & Contact</div>
          <div className="col-span-3">Category</div>
          <div className="col-span-3">Contact Info</div>
          <div className="col-span-2">Last Activity</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div className="divide-y overflow-auto h-[calc(100%-49px)]">
          {loadingContacts || loadingActivities ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
              <p>Loading network data...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
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

                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setViewingContactId(contact.id)}>
                      <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
                      setSelectedContactForActivity(viewingContact.id);
                      setIsActivitySheetOpen(true);
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
                      viewingContactActivities.map((act, index) => (
                        <div key={act.id} className="relative pl-6 pb-6 last:pb-0 border-l border-muted-foreground/20 last:border-transparent">
                          <div className="absolute w-2.5 h-2.5 bg-primary rounded-full left-[-5.5px] top-1.5 ring-4 ring-background" />
                          <div className="text-sm font-medium text-foreground">{act.activity_type}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(act.activity_date), "MMM d, yyyy")}
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
