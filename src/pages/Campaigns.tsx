import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Megaphone, Mail, Users, Send, CalendarClock, MousePointerClick, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Campaigns() {
  const { selectedLocationId } = useLocationContext();
  const [isDrafting, setIsDrafting] = useState(false);

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Broadcast Campaigns</h1>
          <p className="text-muted-foreground mt-1">Send one-off email blasts directly to your contact lists.</p>
        </div>
        
        <Sheet open={isDrafting} onOpenChange={setIsDrafting}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Megaphone className="w-4 h-4" />
              New Broadcast
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[600px] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>Draft New Campaign</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-6">
              <div className="grid gap-2">
                <Label>Internal Campaign Name</Label>
                <Input placeholder="e.g. Summer Catering Promo 2024" />
              </div>
              
              <div className="grid gap-2">
                <Label>Target Audience</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts (Global)</SelectItem>
                    <SelectItem value="b2b">B2B Partnerships Only</SelectItem>
                    <SelectItem value="catering">Past Catering Clients</SelectItem>
                    <SelectItem value="fundraisers">Past Tuesday Fundraisers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Email Subject Line</Label>
                <Input placeholder="e.g. Book your holiday party early and save!" />
              </div>

              <div className="grid gap-2">
                <Label>Email Body (HTML supported)</Label>
                <Textarea 
                  placeholder="Hi there,<br><br>We're excited to announce..." 
                  rows={10} 
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDrafting(false)}>Cancel</Button>
                <Button variant="secondary" className="gap-2">
                  <CalendarClock className="w-4 h-4" />
                  Save Draft
                </Button>
                <Button className="gap-2">
                  <Send className="w-4 h-4" />
                  Send Now
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,450</div>
            <p className="text-xs text-muted-foreground mt-1">+14% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Open Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42.8%</div>
            <p className="text-xs text-muted-foreground mt-1">Industry avg: 21%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Click Rate</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2%</div>
            <p className="text-xs text-muted-foreground mt-1">Industry avg: 2.5%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>View performance of your recent email blasts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
              <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Draft your first email blast to engage your contacts.</p>
              <Button variant="outline" onClick={() => setIsDrafting(true)}>Draft New Broadcast</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(camp => (
                <div key={camp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/10 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{camp.title}</span>
                      {camp.status === 'sent' ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">Sent</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200">Draft</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Targeting: {camp.audience_type === 'all' ? 'All Contacts' : camp.audience_type} • 
                      {camp.status === 'sent' ? ` Sent ${format(new Date(camp.sent_at), 'MMM d, yyyy')}` : ` Last updated ${format(new Date(camp.updated_at), 'MMM d')}`}
                    </div>
                  </div>
                  
                  {camp.status === 'sent' ? (
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <div className="text-center">
                        <div className="font-medium text-foreground">{camp.recipients_count}</div>
                        <div className="text-[10px] uppercase tracking-wider">Sent</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-foreground">{camp.opens_count}</div>
                        <div className="text-[10px] uppercase tracking-wider">Opens</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-foreground">{camp.clicks_count}</div>
                        <div className="text-[10px] uppercase tracking-wider">Clicks</div>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="gap-2 text-primary" onClick={() => setIsDrafting(true)}>
                      <Clock className="w-4 h-4" />
                      Continue Draft
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
