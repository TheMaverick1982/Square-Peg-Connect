import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { alertMarketingRequest } from "@/lib/notify";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function PublicMarketingRequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    target_date: new Date(),
    location_id: "",
    description: "",
    support_needed: "",
    external_links: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Create a Draft Campaign on the Horizon planner (Store Promotions tab)
      const campaignPayload = {
        title: `Support: ${formData.title}`,
        description: `Marketing Support Request.\nNeeds: ${formData.support_needed}\nLinks: ${formData.external_links}\nNotes: ${formData.description}`,
        target_date: format(formData.target_date, 'yyyy-MM-dd'),
        location_id: formData.location_id,
        status: 'planning',
      };

      // Public visitors can submit but not read back rows, so no .select() here.
      const { error: campaignError } = await supabase
        .from('marketing_campaigns')
        .insert(campaignPayload);

      if (campaignError) throw campaignError;

      // 2. Log it to the structured requests table
      const requestPayload = {
        event_name: formData.title,
        event_date: format(formData.target_date, 'yyyy-MM-dd'),
        location_id: formData.location_id,
        support_needed: formData.support_needed,
        external_links: formData.external_links,
        notes: formData.description,
        status: 'Draft'
      };

      const { error: requestError } = await supabase
        .from('marketing_support_requests')
        .insert(requestPayload);
      const supportRequest = { ...requestPayload, created_at: new Date().toISOString() };
        
      if (requestError) throw requestError;

      // 3. Email Brian (Super Admin)
      void supportRequest;
      await alertMarketingRequest(formData.title);

      setIsSuccess(true);
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Request Submitted!</h2>
            <p className="text-muted-foreground">
              Your marketing support request has been added to the planning horizon and the corporate team has been notified.
            </p>
            <Button 
              className="mt-6" 
              variant="outline" 
              onClick={() => {
                setFormData({ title: "", target_date: new Date(), location_id: "", description: "", support_needed: "", external_links: "" });
                setIsSuccess(false);
              }}
            >
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Square Peg Pizzeria" className="h-16 mx-auto mb-6 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Store Promotion Request</h1>
          <p className="text-muted-foreground mt-2">Submit an upcoming store event or promotion to get support from the corporate marketing team.</p>
        </div>

        <Card className="border shadow-md">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Event / Promotion Name <span className="text-destructive">*</span></Label>
                  <Input 
                    placeholder="e.g. Local Brewery Tap Takeover, Teacher Appreciation Week" 
                    value={formData.title}
                    onChange={e => setFormData(f => ({...f, title: e.target.value}))}
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Store Location <span className="text-destructive">*</span></Label>
                    <Select value={formData.location_id} onValueChange={v => setFormData(f => ({...f, location_id: v}))} required>
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue placeholder="Select Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Event Date <span className="text-destructive">*</span></Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal bg-background">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.target_date ? format(formData.target_date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={formData.target_date} onSelect={d => d && setFormData(f => ({...f, target_date: d}))} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label>What specific support do you need? <span className="text-destructive">*</span></Label>
                  <Textarea 
                    placeholder="e.g. Need an Instagram flyer, an email blast to our list, and table tents designed." 
                    value={formData.support_needed}
                    onChange={e => setFormData(f => ({...f, support_needed: e.target.value}))}
                    className="mt-1 min-h-[100px] bg-background"
                    required
                  />
                </div>

                <div>
                  <Label>External Links (Optional)</Label>
                  <Input 
                    placeholder="Links to partner websites, menus, or inspiration..." 
                    value={formData.external_links}
                    onChange={e => setFormData(f => ({...f, external_links: e.target.value}))}
                    className="mt-1 bg-background"
                  />
                </div>

                <div>
                  <Label>Additional Context</Label>
                  <Textarea 
                    placeholder="Any other details the marketing team should know..." 
                    value={formData.description}
                    onChange={e => setFormData(f => ({...f, description: e.target.value}))}
                    className="mt-1 min-h-[80px] bg-background"
                  />
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-12 text-base font-semibold" 
                disabled={!formData.title || !formData.location_id || !formData.support_needed || isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting Request...</>
                ) : (
                  "Submit Request to Corporate"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}