import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function PublicCateringForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    eventDate: "",
    guestCount: "",
    locationId: "",
    orderPreference: "",
    notes: "",
    heardAboutUs: ""
  });

  const [utmData, setUtmData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const currentUtms: Record<string, string> = {};
    
    let hasNewUtms = false;
    utmKeys.forEach(key => {
      const val = params.get(key);
      if (val) {
        currentUtms[key] = val;
        sessionStorage.setItem(key, val);
        hasNewUtms = true;
      } else {
        const stored = sessionStorage.getItem(key);
        if (stored) {
          currentUtms[key] = stored;
        }
      }
    });
    
    setUtmData(currentUtms);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // 1. Insert into database
      const { error: dbError } = await supabase.from('catering_requests').insert([{
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        event_date: form.eventDate,
        guest_count: parseInt(form.guestCount || "0", 10),
        location: form.locationId,
        order_preference: form.orderPreference,
        notes: form.notes,
        heard_about_us: form.heardAboutUs,
        status: "Requested",
        utm_source: utmData.utm_source || null,
        utm_medium: utmData.utm_medium || null,
        utm_campaign: utmData.utm_campaign || null,
        utm_content: utmData.utm_content || null,
        utm_term: utmData.utm_term || null
      }]);

      if (dbError) throw dbError;

      const locationName = locations.find(l => l.id === form.locationId)?.name || form.locationId;

      // 2. Trigger notification
      await supabase.functions.invoke('send-catering-inbound-email', {
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          eventDate: form.eventDate,
          guestCount: form.guestCount,
          location: locationName,
          orderPreference: form.orderPreference,
          notes: form.notes,
          heardAboutUs: form.heardAboutUs
        }
      });
      
      // 3. Fire Meta Pixel Lead event
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead');
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "An error occurred while submitting your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="h-24 md:h-32 mb-4 w-full flex justify-center">
            <img 
              src="https://media-api-prod.apigateway.co/files/v3/AG-D5HZKZ2TNH/FileID-2859e6a7-48eb-46ed-83a6-9d6ebb5d5850/uploaded-1782298633843015700.png" 
              alt="Square Peg Connect Logo" 
              className="h-full w-auto object-contain" 
            />
          </div>
        </div>
        <Card className="max-w-md w-full text-center py-12 border-0 shadow-lg">
          <CardContent className="flex flex-col items-center pt-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
            <h2 className="text-2xl font-bold mb-2">Request Received!</h2>
            <p className="text-muted-foreground">
              Thank you for your interest in Square Peg Catering. Our team has received your details and will be in touch shortly to discuss your event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="h-24 md:h-32 mb-4 w-full flex justify-center">
          <img 
            src="https://media-api-prod.apigateway.co/files/v3/AG-D5HZKZ2TNH/FileID-2859e6a7-48eb-46ed-83a6-9d6ebb5d5850/uploaded-1782298633843015700.png" 
            alt="Square Peg Connect Logo" 
            className="h-full w-auto object-contain" 
          />
        </div>
        <p className="text-muted-foreground tracking-widest uppercase text-sm font-semibold">Catering Request</p>
      </div>

      {/* Form Card */}
      <Card className="max-w-2xl w-full border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Fill out the form below with your event details, and our team will get back to you with a quote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md mb-6 border border-destructive/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  required
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company / Organization</Label>
                <Input
                  id="company"
                  placeholder="Optional"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  placeholder="(555) 555-5555"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventDate">Event Date *</Label>
                <Input
                  id="eventDate"
                  type="date"
                  required
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestCount">Estimated Guest Count *</Label>
                <Input
                  id="guestCount"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 50"
                  value={form.guestCount}
                  onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="location">Preferred Location *</Label>
                <Select
                  value={form.locationId}
                  onValueChange={(val) => setForm({ ...form, locationId: val })}
                  required
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select a location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderPreference">Where would you prefer your order? *</Label>
                <Select
                  value={form.orderPreference}
                  onValueChange={(val) => setForm({ ...form, orderPreference: val })}
                  required
                >
                  <SelectTrigger id="orderPreference">
                    <SelectValue placeholder="Select preference..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In-restaurant dining">In-restaurant dining</SelectItem>
                    <SelectItem value="Pick-up catering">Pick-up catering</SelectItem>
                    <SelectItem value="Food truck private service">Food truck private service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Details / Notes</Label>
              <Textarea
                id="notes"
                placeholder="Tell us a bit more about your event..."
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heardAboutUs">How did you hear about us? (Optional)</Label>
              <Select
                value={form.heardAboutUs}
                onValueChange={(val) => setForm({ ...form, heardAboutUs: val })}
              >
                <SelectTrigger id="heardAboutUs">
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Social Media">Social Media</SelectItem>
                  <SelectItem value="Word of Mouth / Friend">Word of Mouth / Friend</SelectItem>
                  <SelectItem value="Google Search">Google Search</SelectItem>
                  <SelectItem value="Attended a Previous Event">Attended a Previous Event</SelectItem>
                  <SelectItem value="Walk-in / Drove By">Walk-in / Drove By</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                "Submit Catering Request"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
