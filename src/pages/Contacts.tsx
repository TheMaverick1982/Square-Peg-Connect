import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Mail, Phone, Users, Calendar as CalendarIcon, MapPin, Building, UtensilsCrossed, PartyPopper, Handshake, UserCheck, Plus, CheckCircle2, Circle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUnifiedContacts } from "@/hooks/useUnifiedContacts";
import type { UnifiedContact, SourceTag } from "@/hooks/useUnifiedContacts";

export default function Contacts() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  const [selectedContact, setSelectedContact] = useState<UnifiedContact | null>(null);

  const { data: contacts = [], isLoading } = useUnifiedContacts(selectedLocationId);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reminders for selected contact
  const { data: contactReminders = [] } = useQuery({
    queryKey: ["reminders", selectedContact?.id],
    enabled: !!selectedContact,
    queryFn: async () => {
      if (!selectedContact) return [];
      
      const orConditions = [];
      if (selectedContact.b2bRecord?.id) orConditions.push(`b2b_contact_id.eq.${selectedContact.b2bRecord.id}`);
      if (selectedContact.guestBounceBackRecord?.id) orConditions.push(`guest_bounce_back_id.eq.${selectedContact.guestBounceBackRecord.id}`);
      if (selectedContact.cateringRecords?.length > 0) {
        selectedContact.cateringRecords.forEach(c => orConditions.push(`catering_request_id.eq.${c.id}`));
      }
      if (selectedContact.fundraiserRecords?.length > 0) {
        selectedContact.fundraiserRecords.forEach(f => orConditions.push(`fundraiser_id.eq.${f.id}`));
      }
      
      if (orConditions.length === 0) return [];

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .or(orConditions.join(","));

      if (error) throw error;
      return data;
    }
  });

  // Reminder form state
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDesc, setReminderDesc] = useState("");
  const [reminderDueDate, setReminderDueDate] = useState<Date | undefined>(new Date());

  const saveReminderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContact) throw new Error("No contact selected");
      
      const payload = {
        title: reminderTitle,
        description: reminderDesc,
        due_date: reminderDueDate ? format(reminderDueDate, 'yyyy-MM-dd') : null,
        location_id: selectedContact.location_id,
        b2b_contact_id: selectedContact.b2bRecord?.id || null,
        guest_bounce_back_id: selectedContact.guestBounceBackRecord?.id || null,
        catering_request_id: selectedContact.cateringRecords?.[0]?.id || null,
        fundraiser_id: selectedContact.fundraiserRecords?.[0]?.id || null,
      };

      const { error } = await supabase.from("reminders").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reminder created" });
      queryClient.invalidateQueries({ queryKey: ["reminders", selectedContact?.id] });
      setIsCreatingReminder(false);
      setReminderTitle("");
      setReminderDesc("");
      setReminderDueDate(new Date());
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" })
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string, is_completed: boolean }) => {
      const { error } = await supabase.from("reminders").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders", selectedContact?.id] })
  });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.organization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

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

      <div className="bg-card border rounded-lg overflow-hidden flex-1 flex flex-col min-w-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">Contact</div>
            <div className="col-span-3">Contact Info</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-3">Connections</div>
          </div>

          <div className="divide-y overflow-y-auto min-w-[800px] h-[calc(100vh-300px)]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                <p>Loading CRM...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <Users className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No contacts found</h3>
                <p className="text-sm">We couldn't find any contacts matching your search.</p>
              </div>
            ) : (
              <>
                {paginatedContacts.map(contact => (
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
                ))}
                
                {totalPages > 1 && (
                  <div className="p-4 border-t flex items-center justify-between bg-muted/10 sticky bottom-0">
                    <div className="text-xs text-muted-foreground">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredContacts.length)} of {filteredContacts.length} contacts
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      {getPageNumbers().map((pageNum, idx) => (
                        <Button
                          key={idx}
                          variant={pageNum === currentPage ? "default" : "outline"}
                          size="icon"
                          className={`h-8 w-8 ${pageNum === '...' ? 'cursor-default hover:bg-transparent border-transparent' : ''}`}
                          onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                          disabled={pageNum === '...'}
                        >
                          {pageNum}
                        </Button>
                      ))}

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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
                      <TabsTrigger value="Tasks" className="text-xs data-[state=active]:bg-background">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Tasks
                      </TabsTrigger>
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

                    <TabsContent value="Tasks" className="mt-4 space-y-4">
                      {isCreatingReminder ? (
                        <Card className="border-primary/50 shadow-sm">
                          <CardContent className="p-4 space-y-4">
                            <h4 className="font-medium text-sm">New Task for {selectedContact.name}</h4>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Task Title</Label>
                                <Input value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder="e.g., Follow up about event" className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Due Date</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full h-8 justify-start text-left font-normal text-sm", !reminderDueDate && "text-muted-foreground")}>
                                      <CalendarIcon className="mr-2 h-3 w-3" />
                                      {reminderDueDate ? format(reminderDueDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={reminderDueDate} onSelect={setReminderDueDate} initialFocus />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Notes (Optional)</Label>
                                <Textarea value={reminderDesc} onChange={e => setReminderDesc(e.target.value)} className="min-h-[60px] text-sm" />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsCreatingReminder(false)}>Cancel</Button>
                                <Button size="sm" disabled={!reminderTitle || saveReminderMutation.isPending} onClick={() => saveReminderMutation.mutate()}>
                                  Save Task
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Button variant="outline" className="w-full border-dashed" onClick={() => setIsCreatingReminder(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Add Task
                        </Button>
                      )}

                      <div className="space-y-2 mt-4">
                        {contactReminders.length === 0 && !isCreatingReminder ? (
                          <div className="text-center py-6 text-muted-foreground text-sm">No tasks found for this contact.</div>
                        ) : (
                          contactReminders.map((reminder: any) => (
                            <Card key={reminder.id} className={cn("transition-colors", reminder.is_completed && "opacity-60 bg-muted/50")}>
                              <CardContent className="p-3 flex gap-3">
                                <button onClick={() => toggleStatusMutation.mutate({ id: reminder.id, is_completed: !reminder.is_completed })} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                                  {reminder.is_completed ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className={cn("font-medium text-sm truncate", reminder.is_completed && "line-through text-muted-foreground")}>{reminder.title}</h4>
                                    {reminder.due_date && (
                                      <Badge variant="secondary" className="font-normal text-[10px] px-1.5 py-0">
                                        {format(new Date(reminder.due_date), "MMM d")}
                                      </Badge>
                                    )}
                                  </div>
                                  {reminder.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reminder.description}</p>}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </TabsContent>

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
