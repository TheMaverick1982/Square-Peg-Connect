import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Globe, Link as LinkIcon, Send } from "lucide-react";

export default function AIPersonalize() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();

  const [selectedContactId, setSelectedContactId] = useState("");
  const [goal, setGoal] = useState("Introductory Email");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['b2b_contacts', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('b2b_contacts').select('*').order('organization_name');
      if (selectedLocationId) query = query.eq('location_id', selectedLocationId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  // Sync website input when contact changes
  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = contacts.find(c => c.id === contactId);
    setWebsiteUrl(contact?.website || "");
    setGeneratedMessage("");
  };

  const generateMessage = useMutation({
    mutationFn: async () => {
      const payload = {
        url: websiteUrl,
        contactName: selectedContact?.contact_name,
        organizationName: selectedContact?.organization_name,
        goal
      };

      const { data, error } = await supabase.functions.invoke('ai-personalize', {
        body: payload
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data.message;
    },
    onSuccess: (message) => {
      setGeneratedMessage(message);
      toast({ title: "Draft ready", description: "Message generated successfully." });
    },
    onError: (err: any) => {
      toast({ 
        title: "Generation failed", 
        description: err.message || "Failed to generate message.", 
        variant: "destructive" 
      });
    }
  });

  const saveWebsite = useMutation({
    mutationFn: async () => {
      if (!selectedContactId || !websiteUrl) return;
      const { error } = await supabase.from('b2b_contacts').update({ website: websiteUrl }).eq('id', selectedContactId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Website saved", description: "Updated contact record." });
    }
  });

  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Personalize</h1>
        <p className="text-muted-foreground mt-1">Generate highly tailored outreach messages by analyzing a contact's website.</p>
      </div>

      <div className="grid md:grid-cols-[400px_1fr] gap-6 items-start">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outreach Details</CardTitle>
            <CardDescription>Select a contact to generate a tailored pitch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Target Contact</Label>
              <Select value={selectedContactId} onValueChange={handleContactSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Loading contacts..." : "Select a local business..."} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.organization_name} {c.contact_name ? `(${c.contact_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContact && (
              <div className="space-y-2">
                <Label className="flex justify-between items-center">
                  Company Website
                  {selectedContact.website !== websiteUrl && websiteUrl && (
                    <Button variant="link" className="h-auto p-0 text-xs" onClick={() => saveWebsite.mutate()}>
                      Save to Contact
                    </Button>
                  )}
                </Label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    type="url"
                    placeholder="https://..."
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">The AI will read this site to personalize the pitch.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Outreach Goal</Label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Introductory Email">Introductory Email</SelectItem>
                  <SelectItem value="Happy Hour Invite">Happy Hour Invite</SelectItem>
                  <SelectItem value="Fundraiser Pitch">Fundraiser Pitch</SelectItem>
                  <SelectItem value="Catering Pitch">Catering Pitch</SelectItem>
                  <SelectItem value="Employee Appreciation Event Pitch">Employee Appreciation Event Pitch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              className="w-full gap-2" 
              onClick={() => generateMessage.mutate()}
              disabled={!selectedContactId || !websiteUrl || generateMessage.isPending}
            >
              {generateMessage.isPending ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-r-transparent animate-spin" />
                  Analyzing Site...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Draft
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="h-full min-h-[500px] flex flex-col">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              AI Draft
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {generatedMessage ? (
              <div className="p-6 h-full flex flex-col">
                <Textarea 
                  className="flex-1 min-h-[350px] resize-none border-0 focus-visible:ring-0 p-0 text-base leading-relaxed bg-transparent"
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                />
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(generatedMessage);
                    toast({ description: "Copied to clipboard." });
                  }}>
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary/40" />
                </div>
                <div>
                  <p className="font-medium text-foreground">No draft generated yet</p>
                  <p className="text-sm mt-1 max-w-xs mx-auto">Select a contact and enter their website to create a highly personalized outreach message.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
