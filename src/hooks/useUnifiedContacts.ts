import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type SourceTag = "B2B" | "Guest Bounce Back" | "Catering" | "Fundraiser";

export interface UnifiedContact {
  id: string; // usually email or name lowercase
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

export function useUnifiedContacts(selectedLocationId?: string | null) {
  return useQuery({
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
}
