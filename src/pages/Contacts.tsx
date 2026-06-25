import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Mail, Phone, Users, Calendar, MapPin, Building, Activity, UtensilsCrossed, PartyPopper, Handshake, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

type SourceTag = "B2B" | "Guest Bounce Back" | "Catering" | "Fundraiser";

interface UnifiedContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  sources: SourceTag[];
  location_id: string;
  
  b2bRecord: any | null;
  guestBounceBackRecord: any | null;
  cateringRecords: any[];
  fundraiserRecords: any[];
}

export default function Contacts() {
  const { selectedLocationId } = useLocationContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<UnifiedContact | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["unified_contacts", selectedLocationId],
    queryFn: async () => {
      // Fetch all sources concurrently
      const [b2bReq, bounceReq, cateringReq, fundsReq] = await Promise.all([
        supabase.from("b2b_contacts").select("*"),
        supabase.from("guest_bounce_backs").select("*"),
        supabase.from("catering_requests").select("*"),
        supabase.from("fundraisers").select("*")
      ]);

      // Filter by location locally to avoid complex DB OR logic
      const locFilter = selectedLocationId && selectedLocationId !== "all" ? selectedLocationId : null;

      const map = new Map<string, UnifiedContact>();

      const merge = (email: string, name: string, phone: string, org: string, source: SourceTag, locId: string, record: any) => {
        if (locFilter && locId !== locFilter) return;
        
        const key = email ? email.toLowerCase().trim() : name?.toLowerCase().trim();
        if (!key) return; // skip if no ident

        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: name || "Unknown",
            email: email || "",
            phone: phone || "",
            organization: org || "",
            sources: [],
            location_id: locId,
            b2bRecord: null,
            guestBounceBackRecord: null,
            cateringRecords: [],
            fundraiserRecords: []
          });
        }

        const contact = map.get(key)!;
        if (!contact.sources.includes(source)) {
          contact.sources.push(source);
        }
        
        if (phone && !contact.phone) contact.phone = phone;
        if (org && !contact.organization) contact.organization = org;
        if (name && contact.name === "Unknown") contact.name = name;

        if (source === "B2B") contact.b2bRecord = record;
        if (source === "Guest Bounce Back") contact.guestBounceBackRecord = record;
        if (source === "Catering") contact.cateringRecords.push(record);
        if (source === "Fundraiser") contact.fundraiserRecords.push(record);
      };

      b2bReq.data?.forEach(r => merge(r.email, r.contact_name, r.phone, r.organization_name, "B2B", r.location_id, r));
      bounceReq.data?.forEach(r => merge(r.email, r.name, r.phone, "", "Guest Bounce Back", r.location_id, r));
      cateringReq.data?.forEach(r => merge(r.email, r.name, r.phone, r.company, "Catering", r.location, r));
      fundsReq.data?.forEach(r => merge(r.email, r.name, r.phone, r.organization, "Fundraiser", r.location, r));

      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.organization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceIcon = (source: SourceTag) => {
    switch (source) {
      case "B2B": return <Handshake className="w-3 h-3 mr-1" />;
      case "Guest Bounce Back": return <UserCheck className="w-3 h-3 mr-1" />;
      case "Catering": return <UtensilsCrossed className="w-3 h-3 mr-1" />;
      case "Fundraiser": return <PartyPopper className="w-3 h-3 mr-1" />;
    }
  };

  const getSourceColor = (source: SourceTag) => {
    switch (source) {
      case "B2B": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Guest Bounce Back": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "Catering": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "Fundraiser": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">Unified CRM across Catering, Fundraisers, B2B, and Guests.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b pb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, email, or organization..." 
            className="pl-9 bg-background" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-4">Contact</div>
          <div className="col-span-3">Contact Info</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-3">Connections</div>
        </div>

        <div className="divide-y overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
              <p>Loading CRM...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium">No contacts found</h3>
              <p className="text-sm">We couldn't find any contacts matching your search.</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div 
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="col-span-4">
                  <div className="font-semibold text-sm text-foreground">{contact.name}</div>
                  {contact.organization && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {contact.organization}
                    </div>
                  )}
                </div>
                
                <div className="col-span-3 text-sm text-muted-foreground space-y-1">
                  {contact.email && (
                    <div className="flex items-center gap-1.5 line-clamp-1 text-xs">
                      <Mail className="w-3 h-3 shrink-0" /> {contact.email}
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Phone className="w-3 h-3 shrink-0" /> {contact.phone}
                    </div>
                  )}
                </div>

                <div className="col-span-2 text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" />
                  <span className="line-clamp-1">{locations.find(l => l.id === contact.location_id)?.name || "Unknown"}</span>
                </div>

                <div className="col-span-3 flex flex-wrap gap-1.5">
                  {contact.sources.map(src => (
                    <Badge key={src} variant="outline" className={`font-normal ${getSourceColor(src)}`}>
                      {getSourceIcon(src)} {src}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Sheet open={selectedContact !== null} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedContact && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl">{selectedContact.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4" /> 
                  {locations.find(l => l.id === selectedContact.location_id)?.name || "Unknown Location"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
                  {selectedContact.organization && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{selectedContact.organization}</span>
                    </div>
                  )}
                  {selectedContact.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline">{selectedContact.email}</a>
                    </div>
                  )}
                  {selectedContact.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${selectedContact.phone}`} className="text-primary hover:underline">{selectedContact.phone}</a>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold border-b pb-2 mb-4">Contact History</h3>
                  
                  <Tabs defaultValue={selectedContact.sources[0] || "B2B"} className="w-full">
                    <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 gap-1 justify-start">
                      {selectedContact.sources.map(src => (
                        <TabsTrigger key={src} value={src} className="text-xs data-[state=active]:bg-background">
                          {getSourceIcon(src)} {src}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {selectedContact.sources.includes("B2B") && (
                      <TabsContent value="B2B" className="mt-4 space-y-4">
                        <Card>
                          <CardContent className="p-4 space-y-2">
                            <div className="text-sm font-medium">B2B Partnership Details</div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>Category: <span className="text-foreground">{selectedContact.b2bRecord.category}</span></div>
                              <div>Subcategory: <span className="text-foreground">{selectedContact.b2bRecord.subcategory}</span></div>
                              {selectedContact.b2bRecord.website && (
                                <div className="col-span-2 mt-2">
                                  Website: <a href={selectedContact.b2bRecord.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{selectedContact.b2bRecord.website}</a>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                              Created: {format(new Date(selectedContact.b2bRecord.created_at), "PPP")}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )}

                    {selectedContact.sources.includes("Guest Bounce Back") && (
                      <TabsContent value="Guest Bounce Back" className="mt-4 space-y-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-sm font-medium mb-3">Bounce Back Tracking</div>
                            <div className="space-y-4">
                              {[1,2,3,4].map(num => {
                                const vDate = selectedContact.guestBounceBackRecord[`visit_${num}_date`];
                                const vGiven = selectedContact.guestBounceBackRecord[`visit_${num}_given`];
                                const vNotes = selectedContact.guestBounceBackRecord[`visit_${num}_notes`];
                                
                                if (!vDate && !vGiven && !vNotes) return null;
                                
                                return (
                                  <div key={num} className="border-l-2 border-primary/30 pl-4 py-1">
                                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Visit {num}</div>
                                    <div className="text-sm font-medium">{vDate ? format(new Date(vDate), "PPP") : "No date recorded"}</div>
                                    {vGiven && <div className="text-sm mt-1"><span className="text-muted-foreground">Given:</span> {vGiven}</div>}
                                    {vNotes && <div className="text-sm mt-1 italic text-muted-foreground">"{vNotes}"</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )}

                    {selectedContact.sources.includes("Catering") && (
                      <TabsContent value="Catering" className="mt-4 space-y-3">
                        {selectedContact.cateringRecords.map((c: any, i: number) => (
                          <Card key={i}>
                            <CardContent className="p-4 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium">{c.company || "Catering Event"}</div>
                                <Badge variant="secondary">{c.status}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-y-1 text-muted-foreground text-xs mt-2">
                                <div>Date: <span className="text-foreground">{format(new Date(c.event_date), "PPP")}</span></div>
                                <div>Guests: <span className="text-foreground">{c.guest_count}</span></div>
                                <div>Quote: <span className="text-foreground">${c.quote_total || 0}</span></div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>
                    )}

                    {selectedContact.sources.includes("Fundraiser") && (
                      <TabsContent value="Fundraiser" className="mt-4 space-y-3">
                        {selectedContact.fundraiserRecords.map((f: any, i: number) => (
                          <Card key={i}>
                            <CardContent className="p-4 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium">{f.organization || "Fundraiser"}</div>
                                <Badge variant="secondary">{f.status}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-y-1 text-muted-foreground text-xs mt-2">
                                <div>Date: <span className="text-foreground">{format(new Date(f.event_date), "PPP")}</span></div>
                                <div>Sales: <span className="text-foreground">${f.total_sales || 0}</span></div>
                                <div>Donated: <span className="text-foreground">${f.total_donated || 0}</span></div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>
                    )}

                  </Tabs>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
