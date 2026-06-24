import { useState } from "react";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export default function PublicCateringForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    contactName: "",
    email: "",
    phone: "",
    eventName: "",
    eventDate: "",
    guestCount: "",
    locationId: "",
    notes: ""
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLocationChange = (val: string) => {
    setFormData({ ...formData, locationId: val });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would POST to the backend API which feeds into the CRM.
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-xl shadow-lg p-8 text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Request Received!</h1>
          <p className="text-muted-foreground text-lg">
            Thank you for reaching out, {formData.contactName}. We've received your catering request for {formData.eventName}.
          </p>
          <p className="text-muted-foreground">
            Our location manager will review the details and contact you shortly to confirm the order.
          </p>
          <Button 
            className="mt-6 w-full"
            variant="outline"
            onClick={() => {
              setIsSubmitted(false);
              setFormData({
                contactName: "",
                email: "",
                phone: "",
                eventName: "",
                eventDate: "",
                guestCount: "",
                locationId: "",
                notes: ""
              });
            }}
          >
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary font-serif italic mb-2">
          Square Peg
        </h1>
        <p className="text-muted-foreground tracking-widest uppercase text-sm font-semibold">Catering Request</p>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl w-full bg-card border rounded-xl shadow-xl overflow-hidden">
        <div className="p-6 sm:p-10">
          <p className="text-muted-foreground mb-8 text-center">
            Fill out the form below with your event details, and our team will get back to you with a quote.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Your Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="contactName">Full Name</Label>
                  <Input 
                    id="contactName" 
                    name="contactName" 
                    placeholder="John Doe"
                    value={formData.contactName} 
                    onChange={handleFormChange} 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    name="email" 
                    placeholder="john@example.com"
                    value={formData.email} 
                    onChange={handleFormChange} 
                    required 
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    name="phone" 
                    placeholder="(555) 123-4567"
                    value={formData.phone} 
                    onChange={handleFormChange} 
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Event Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="locationId">Preferred Location</Label>
                  <Select value={formData.locationId} onValueChange={handleLocationChange} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location near you..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="eventName">Event Name / Type</Label>
                  <Input 
                    id="eventName" 
                    name="eventName" 
                    placeholder="e.g. Corporate Lunch, Birthday Party" 
                    value={formData.eventName} 
                    onChange={handleFormChange} 
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input 
                    id="eventDate" 
                    type="date" 
                    name="eventDate" 
                    value={formData.eventDate} 
                    onChange={handleFormChange} 
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="guestCount">Estimated Guest Count</Label>
                  <Input 
                    id="guestCount" 
                    type="number" 
                    name="guestCount" 
                    placeholder="e.g. 50" 
                    min="1"
                    value={formData.guestCount} 
                    onChange={handleFormChange} 
                    required 
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Order Details & Special Requests</Label>
                <Textarea 
                  id="notes" 
                  name="notes" 
                  placeholder="Tell us about dietary restrictions, delivery instructions, or any specific menu items you're interested in..." 
                  value={formData.notes} 
                  onChange={handleFormChange} 
                  rows={5} 
                />
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full text-lg h-12" size="lg">
                Submit Catering Request
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
