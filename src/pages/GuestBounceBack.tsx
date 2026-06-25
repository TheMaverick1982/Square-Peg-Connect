import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Search, MapPin, Phone, Mail, User, Edit2, History, Gift, CheckCircle2 } from "lucide-react";

// --- Types ---
type GuestBounceBack = {
  id: string;
  location_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  
  visit_1_date: string | null;
  visit_1_given: string | null;
  visit_1_notes: string | null;
  
  visit_2_date: string | null;
  visit_2_given: string | null;
  visit_2_notes: string | null;
  
  visit_3_date: string | null;
  visit_3_given: string | null;
  visit_3_notes: string | null;
  
  visit_4_date: string | null;
  visit_4_given: string | null;
  visit_4_notes: string | null;
  
  created_at: string;
};

export default function GuestBounceBack() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);

  const defaultFormState = {
    name: "",
    email: "",
    phone: "",
    visit_1_date: format(new Date(), "yyyy-MM-dd"),
    visit_1_given: "",
    visit_1_notes: "",
    visit_2_date: "",
    visit_2_given: "",
    visit_2_notes: "",
    visit_3_date: "",
    visit_3_given: "",
    visit_3_notes: "",
    visit_4_date: "",
    visit_4_given: "",
    visit_4_notes: "",
  };

  const [form, setForm] = useState(defaultFormState);

  // Fetch Data
  const { data: guests = [], isLoading } = useQuery({
    queryKey: ['guest_bounce_backs', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('guest_bounce_backs').select('*').order('created_at', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as GuestBounceBack[];
    }
  });

  // Mutations
  const saveGuest = useMutation({
    mutationFn: async (payload: any) => {
      if (editingGuestId) {
        const { id, ...updateData } = payload;
        const { data, error } = await supabase.from('guest_bounce_backs').update(updateData).eq('id', editingGuestId).select();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('guest_bounce_backs').insert([payload]).select();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest_bounce_backs'] });
      setIsSheetOpen(false);
      setEditingGuestId(null);
      setForm(defaultFormState);
      toast({ title: "Success", description: "Guest tracker updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save guest.", variant: "destructive" })
  });

  // KPI Calculations
  const metrics = useMemo(() => {
    const total = guests.length;
    if (total === 0) return { v1: 0, v2: 0, v3: 0, v4: 0, total: 0 };

    let v1Count = 0;
    let v2Count = 0;
    let v3Count = 0;
    let v4Count = 0;

    guests.forEach(g => {
      if (g.visit_1_date) v1Count++;
      if (g.visit_2_date) v2Count++;
      if (g.visit_3_date) v3Count++;
      if (g.visit_4_date) v4Count++;
    });

    return {
      total,
      v1: Math.round((v1Count / total) * 100),
      v2: Math.round((v2Count / total) * 100),
      v3: Math.round((v3Count / total) * 100),
      v4: Math.round((v4Count / total) * 100),
      v1Count, v2Count, v3Count, v4Count
    };
  }, [guests]);

  // Filtering
  const filteredGuests = useMemo(() => {
    if (!searchQuery) return guests;
    const q = searchQuery.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(q) || 
      (g.email && g.email.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q))
    );
  }, [guests, searchQuery]);

  const openNewGuestSheet = () => {
    setEditingGuestId(null);
    setForm(defaultFormState);
    setIsSheetOpen(true);
  };

  const openEditGuestSheet = (guest: GuestBounceBack) => {
    setEditingGuestId(guest.id);
    setForm({
      name: guest.name,
      email: guest.email || "",
      phone: guest.phone || "",
      visit_1_date: guest.visit_1_date ? format(new Date(guest.visit_1_date), "yyyy-MM-dd") : "",
      visit_1_given: guest.visit_1_given || "",
      visit_1_notes: guest.visit_1_notes || "",
      visit_2_date: guest.visit_2_date ? format(new Date(guest.visit_2_date), "yyyy-MM-dd") : "",
      visit_2_given: guest.visit_2_given || "",
      visit_2_notes: guest.visit_2_notes || "",
      visit_3_date: guest.visit_3_date ? format(new Date(guest.visit_3_date), "yyyy-MM-dd") : "",
      visit_3_given: guest.visit_3_given || "",
      visit_3_notes: guest.visit_3_notes || "",
      visit_4_date: guest.visit_4_date ? format(new Date(guest.visit_4_date), "yyyy-MM-dd") : "",
      visit_4_given: guest.visit_4_given || "",
      visit_4_notes: guest.visit_4_notes || "",
    });
    setIsSheetOpen(true);
  };

  const getCurrentStage = (g: GuestBounceBack) => {
    if (g.visit_4_date) return 4;
    if (g.visit_3_date) return 3;
    if (g.visit_2_date) return 2;
    if (g.visit_1_date) return 1;
    return 0;
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guest Bounce Back</h1>
          <p className="text-muted-foreground mt-1">Track return visits and measure the success of comeback incentives.</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={openNewGuestSheet}>
          <Plus className="w-4 h-4" />
          Log New Guest
        </Button>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Visit 1 (Initial)
              <History className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">{metrics.v1}%</span>
              <span className="text-sm text-muted-foreground">conversion</span>
            </div>
            <Progress value={metrics.v1} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              {metrics.v1Count} / {metrics.total} guests tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Visit 2
              <History className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-primary">{metrics.v2}%</span>
              <span className="text-sm text-muted-foreground">conversion</span>
            </div>
            <Progress value={metrics.v2} className="h-2 bg-primary/10" />
            <p className="text-xs text-muted-foreground mt-3">
              {metrics.v2Count} / {metrics.total} reached stage 2
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Visit 3
              <History className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-primary">{metrics.v3}%</span>
              <span className="text-sm text-muted-foreground">conversion</span>
            </div>
            <Progress value={metrics.v3} className="h-2 bg-primary/10" />
            <p className="text-xs text-muted-foreground mt-3">
              {metrics.v3Count} / {metrics.total} reached stage 3
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between text-primary">
              Visit 4 (Loyal)
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-primary">{metrics.v4}%</span>
              <span className="text-sm text-primary/80">conversion</span>
            </div>
            <Progress value={metrics.v4} className="h-2 bg-primary/20" />
            <p className="text-xs text-primary/70 mt-3">
              {metrics.v4Count} / {metrics.total} reached stage 4
            </p>
          </CardContent>
        </Card>
      </div>

      {/* List Area */}
      <div className="flex-1 flex flex-col mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search guests by name, email, or phone..." 
              className="pl-9 w-80 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden h-[500px] flex flex-col">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <div className="col-span-3">Guest</div>
            <div className="col-span-3">Contact Info</div>
            <div className="col-span-2">Current Stage</div>
            <div className="col-span-3">Latest Incentive</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y overflow-auto flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                <p>Loading guests...</p>
              </div>
            ) : filteredGuests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <User className="w-8 h-8 mb-3 opacity-20" />
                <p>No tracked guests found.</p>
                <Button variant="link" onClick={openNewGuestSheet} className="mt-2">
                  Track your first guest
                </Button>
              </div>
            ) : (
              filteredGuests.map(guest => {
                const stage = getCurrentStage(guest);
                let latestIncentive = "";
                if (stage === 4) latestIncentive = guest.visit_4_given || "";
                else if (stage === 3) latestIncentive = guest.visit_3_given || "";
                else if (stage === 2) latestIncentive = guest.visit_2_given || "";
                else if (stage === 1) latestIncentive = guest.visit_1_given || "";

                return (
                  <div key={guest.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors">
                    <div className="col-span-3">
                      <div className="font-semibold text-sm text-foreground">{guest.name}</div>
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      {guest.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {guest.phone}
                        </div>
                      )}
                      {guest.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{guest.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-2">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        stage === 4 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        Visit {stage} of 4
                      </div>
                    </div>

                    <div className="col-span-3 text-sm text-muted-foreground truncate" title={latestIncentive}>
                      {latestIncentive ? (
                        <div className="flex items-center gap-1.5">
                          <Gift className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="truncate">{latestIncentive}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic opacity-60">None recorded</span>
                      )}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEditGuestSheet(guest)}>
                        <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Form */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingGuestId ? "Update Tracker" : "Track New Guest"}</SheetTitle>
            <SheetDescription>Record visits, incentives, and notes across a 4-visit lifecycle.</SheetDescription>
          </SheetHeader>
          <div className="space-y-8 mt-6 pb-6">
            
            {/* Contact Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Full Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="555-0101" />
                  </div>
                </div>
              </div>
            </div>

            {/* Visit 1 */}
            <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">1</div>
                Visit 1 (Initial)
              </h4>
              <div className="grid gap-4 mt-2">
                <div className="grid gap-2">
                  <Label>Date Visited</Label>
                  <Input type="date" value={form.visit_1_date} onChange={(e) => setForm({ ...form, visit_1_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>What was given to bring them back?</Label>
                  <Input placeholder="e.g. Free App Card" value={form.visit_1_given} onChange={(e) => setForm({ ...form, visit_1_given: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Experience feedback, what they ordered, etc." value={form.visit_1_notes} onChange={(e) => setForm({ ...form, visit_1_notes: e.target.value })} rows={2} />
                </div>
              </div>
            </div>

            {/* Visit 2 */}
            <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">2</div>
                Visit 2
              </h4>
              <div className="grid gap-4 mt-2">
                <div className="grid gap-2">
                  <Label>Date Visited</Label>
                  <Input type="date" value={form.visit_2_date} onChange={(e) => setForm({ ...form, visit_2_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>What was given to bring them back?</Label>
                  <Input placeholder="e.g. 20% off next visit" value={form.visit_2_given} onChange={(e) => setForm({ ...form, visit_2_given: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Did they use the previous incentive?" value={form.visit_2_notes} onChange={(e) => setForm({ ...form, visit_2_notes: e.target.value })} rows={2} />
                </div>
              </div>
            </div>

            {/* Visit 3 */}
            <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">3</div>
                Visit 3
              </h4>
              <div className="grid gap-4 mt-2">
                <div className="grid gap-2">
                  <Label>Date Visited</Label>
                  <Input type="date" value={form.visit_3_date} onChange={(e) => setForm({ ...form, visit_3_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>What was given to bring them back?</Label>
                  <Input placeholder="e.g. Free Dessert" value={form.visit_3_given} onChange={(e) => setForm({ ...form, visit_3_given: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Experience notes" value={form.visit_3_notes} onChange={(e) => setForm({ ...form, visit_3_notes: e.target.value })} rows={2} />
                </div>
              </div>
            </div>

            {/* Visit 4 */}
            <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">4</div>
                Visit 4 (Loyal)
              </h4>
              <div className="grid gap-4 mt-2">
                <div className="grid gap-2">
                  <Label>Date Visited</Label>
                  <Input type="date" value={form.visit_4_date} onChange={(e) => setForm({ ...form, visit_4_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>What was given to bring them back?</Label>
                  <Input placeholder="e.g. VIP Invite" value={form.visit_4_given} onChange={(e) => setForm({ ...form, visit_4_given: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Final loyalty notes" value={form.visit_4_notes} onChange={(e) => setForm({ ...form, visit_4_notes: e.target.value })} rows={2} />
                </div>
              </div>
            </div>

          </div>
          <SheetFooter className="mt-2 border-t pt-4 bg-background sticky bottom-0">
            <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
            <Button 
              onClick={() => {
                const payload = {
                  ...form,
                  // Ensure empty dates are null for db constraint
                  visit_1_date: form.visit_1_date || null,
                  visit_2_date: form.visit_2_date || null,
                  visit_3_date: form.visit_3_date || null,
                  visit_4_date: form.visit_4_date || null,
                };
                if (!editingGuestId) {
                  (payload as any).location_id = selectedLocationId || locations[0].id;
                }
                saveGuest.mutate(payload);
              }}
              disabled={!form.name}
            >
              Save Tracker
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
