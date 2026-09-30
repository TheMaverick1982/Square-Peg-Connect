import { useState } from "react";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { format, startOfDay, isBefore } from "date-fns";

export default function PublicLargeReservationForm() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    locationId: "",
    eventDate: undefined as Date | undefined,
    timeStart: "",
    timeFinish: "",
    name: "",
    email: "",
    phone: "",
    organization: "",
    guestCount: "",
    notes: "",
    requiresRoom: false,
    heardAboutUs: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isDateDisabled = (date: Date) => {
    // Disable if in the past
    if (isBefore(date, startOfDay(new Date()))) return true;
    return false;
  };

  const handleNext = () => {
    if (step === 1 && !formData.locationId) {
      toast({ title: "Please select a location" });
      return;
    }
    if (step === 2 && !formData.eventDate) {
      toast({ title: "Please select a date" });
      return;
    }
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventDate) return;

    setIsSubmitting(true);
    const orderData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      organization: formData.organization,
      location: formData.locationId,
      event_date: format(formData.eventDate, 'yyyy-MM-dd'),
      time_start: formData.timeStart,
      time_finish: formData.timeFinish,
      guest_count: parseInt(formData.guestCount) || 0,
      notes: formData.notes,
      heard_about_us: formData.heardAboutUs,
      requires_room: formData.requiresRoom,
      status: 'Requested'
    };

    const { error } = await supabase.from('large_reservations').insert([orderData]);

    if (error) {
      setIsSubmitting(false);
      toast({ title: "Error submitting request", description: error.message, variant: "destructive" });
      return;
    }

    // Sync to CRM
    const { error: crmError } = await supabase.from('b2b_contacts').insert([{
      location_id: formData.locationId,
      organization_name: formData.organization || "No Org Provided",
      contact_name: formData.name,
      email: formData.email,
      phone: formData.phone,
      category: 'Reservation'
    }]);
    if (crmError) console.error("Error syncing to CRM:", crmError);

    // Trigger email notification
    const location = locations.find(l => l.id === formData.locationId) || locations[0];
    await supabase.functions.invoke('send-large-reservation-email', {
      body: {
        order: {
          ...orderData,
          eventDate: orderData.event_date,
          timeStart: orderData.time_start,
          timeFinish: orderData.time_finish,
          guestCount: orderData.guest_count,
          heardAboutUs: orderData.heard_about_us
        },
        location
      }
    });

    setIsSubmitting(false);
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-green-600">Request Received!</CardTitle>
            <CardDescription>We will review your date and contact you shortly.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Thank you for choosing Square Peg Pizzeria.<br />
              Our manager will be in touch to finalize details.
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
            src="/square-peg-logo.png" 
            alt="Square Peg Connect Logo" 
            className="h-full w-auto object-contain" 
          />
        </div>
        <p className="text-muted-foreground tracking-widest uppercase text-sm font-semibold">Large Reservation Request</p>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span className={step >= 1 ? "text-primary font-medium" : ""}>1. Location</span>
            <span>&rarr;</span>
            <span className={step >= 2 ? "text-primary font-medium" : ""}>2. Date & Time</span>
            <span>&rarr;</span>
            <span className={step >= 3 ? "text-primary font-medium" : ""}>3. Details</span>
          </div>
          <CardTitle>
            {step === 1 && "Choose a Location"}
            {step === 2 && "Date & Time"}
            {step === 3 && "Your Details"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Select the restaurant location for your event."}
            {step === 2 && "Choose the date and timeframe for your reservation."}
            {step === 3 && "Tell us about your group."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 1 && (
            <div className="grid gap-4 py-4">
              <Label htmlFor="location">Restaurant Location</Label>
              <Select value={formData.locationId} onValueChange={(val) => setFormData({ ...formData, locationId: val })}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select a location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6 py-4">
              <div className="flex flex-col items-center">
                <Calendar
                  mode="single"
                  selected={formData.eventDate}
                  onSelect={(date) => setFormData({ ...formData, eventDate: date })}
                  disabled={isDateDisabled}
                  className="rounded-md border shadow-sm w-fit"
                />
                {formData.eventDate && (
                  <div className="mt-4 text-center">
                    <p className="text-sm font-semibold text-primary">
                      {format(formData.eventDate, "EEEE, MMMM do, yyyy")}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="timeStart">Start Time</Label>
                  <Input id="timeStart" type="time" value={formData.timeStart} onChange={(e) => setFormData({...formData, timeStart: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="timeFinish">End Time</Label>
                  <Input id="timeFinish" type="time" value={formData.timeFinish} onChange={(e) => setFormData({...formData, timeFinish: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <form id="reservation-form" onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Client Name</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization">Organization Name (Optional)</Label>
                <Input id="organization" value={formData.organization} onChange={e => setFormData({...formData, organization: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guestCount">How many guests?</Label>
                <Input id="guestCount" type="number" min="1" required value={formData.guestCount} onChange={e => setFormData({...formData, guestCount: e.target.value})} />
              </div>
              {/* Location-specific room requirement */}
              {(formData.locationId === "loc-7" || formData.locationId === "loc-5") && (
                <div className="grid gap-4 bg-muted/20 p-4 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-primary">
                      {formData.locationId === "loc-7" ? "Banquet Room Required?" : "Private Dining Room Required?"}
                    </Label>
                    <Switch 
                      checked={formData.requiresRoom} 
                      onCheckedChange={(checked) => setFormData({...formData, requiresRoom: checked})}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="notes">Order Notes</Label>
                <Textarea id="notes" placeholder="Any specific details we should know?" rows={4} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="heardAboutUs">How did you hear about us? (Optional)</Label>
                <Select
                  value={formData.heardAboutUs}
                  onValueChange={(val) => setFormData({ ...formData, heardAboutUs: val })}
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
            </form>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
          )}
          {step === 1 && <div />}
          
          {step < 3 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button type="submit" form="reservation-form" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
