import { useState, useEffect } from "react";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { format, isTuesday, startOfDay, isBefore } from "date-fns";

export default function PublicFundraiserForm() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    locationId: "",
    eventDate: undefined as Date | undefined,
    name: "",
    email: "",
    phone: "",
    address: "",
    organization: ""
  });

  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (formData.locationId) {
      // Fetch booked dates for this location
      const fetchBookings = async () => {
        const { data, error } = await supabase
          .from('fundraisers')
          .select('event_date')
          .eq('location', formData.locationId);
          
        if (data) {
          setBookedDates(data.map(r => {
            const [year, month, day] = r.event_date.split('-');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }));
        }
      };
      fetchBookings();
    }
  }, [formData.locationId]);

  const isDateDisabled = (date: Date) => {
    // Disable if not Tuesday
    if (!isTuesday(date)) return true;
    
    // Disable if in the past
    if (isBefore(date, startOfDay(new Date()))) return true;

    // Disable if already booked
    return bookedDates.some(
      booked => format(booked, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
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
    const { error } = await supabase.from('fundraisers').insert([{
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      organization: formData.organization,
      location: formData.locationId,
      event_date: format(formData.eventDate, 'yyyy-MM-dd'),
      status: 'Requested'
    }]);

    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error submitting request", description: error.message, variant: "destructive" });
    } else {
      setIsSuccess(true);
    }
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
              Thank you for choosing us for your fundraiser. Our manager will be in touch to finalize details.
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
        <p className="text-muted-foreground tracking-widest uppercase text-sm font-semibold">Tuesday Fundraiser Request</p>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span className={step >= 1 ? "text-primary font-medium" : ""}>1. Location</span>
            <span>&rarr;</span>
            <span className={step >= 2 ? "text-primary font-medium" : ""}>2. Preferred Date</span>
            <span>&rarr;</span>
            <span className={step >= 3 ? "text-primary font-medium" : ""}>3. Details</span>
          </div>
          <CardTitle>
            {step === 1 && "Choose a Location"}
            {step === 2 && "Preferred Event Date"}
            {step === 3 && "Your Details"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Select the restaurant location for your event."}
            {step === 2 && "Fundraisers are hosted exclusively on Tuesdays. Gray dates are already booked."}
            {step === 3 && "Tell us about your organization."}
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
            <div className="flex justify-center py-4">
              <Calendar
                mode="single"
                selected={formData.eventDate}
                onSelect={(date) => setFormData({ ...formData, eventDate: date })}
                disabled={isDateDisabled}
                className="rounded-md border shadow-sm"
              />
            </div>
          )}

          {step === 3 && (
            <form id="fundraiser-form" onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Your Name</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization">Organization Name</Label>
                <Input id="organization" required value={formData.organization} onChange={e => setFormData({...formData, organization: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Mailing Address (for the check)</Label>
                <Input id="address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
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
            <Button type="submit" form="fundraiser-form" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
