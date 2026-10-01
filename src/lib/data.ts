export interface Location {
  id: string;
  name: string;
  vendestaId: string;
  address?: string;
  phone?: string;
  email?: string;
}

export const locations: Location[] = [
  { id: "loc-1", name: "Storrs", vendestaId: "ven-storrs-001", address: "9 Dog Ln, Storrs, CT 06268", phone: "(860) 454-6038", email: "storrs@squarepegpizzeria.com" },
  { id: "loc-2", name: "Vernon", vendestaId: "ven-vernon-002", address: "226 Talcottville Rd, Vernon, CT 06066", phone: "(860) 926-0088", email: "vernon@squarepegpizzeria.com" },
  { id: "loc-3", name: "Shelton", vendestaId: "ven-shelton-003", address: "320 Howe Ave, Unit 6, Shelton, CT 06484", phone: "(203) 538-5044", email: "shelton@squarepegpizzeria.com" },
  { id: "loc-4", name: "Preston", vendestaId: "ven-preston-004", address: "353 CT-165, Preston, CT 06365", phone: "(860) 319-0930", email: "preston@squarepegpizzeria.com" },
  { id: "loc-5", name: "Glastonbury", vendestaId: "ven-glastonbury-005", address: "1001 Hebron Ave, Glastonbury, CT 06033", phone: "(860) 286-0415", email: "glastonbury@squarepegpizzeria.com" },
  { id: "loc-6", name: "East Hartford", vendestaId: "ven-easthartford-006", address: "130 Long Hill St, East Hartford, CT 06108", phone: "(860) 509-4221", email: "ehartford@squarepegpizzeria.com" },
  { id: "loc-7", name: "Plainville", vendestaId: "ven-plainville-007", address: "400 New Britain Ave, Plainville, CT 06062", phone: "(860) 996-0363", email: "plainville@squarepegpizzeria.com" },
  { id: "loc-8", name: "Delray Beach", vendestaId: "ven-delray-008", address: "4957 W Atlantic Ave, Delray Beach, FL 33445", phone: "(561) 566-8828", email: "delraybeach@squarepegpizzeria.com" },
  { id: "loc-9", name: "Berlin", vendestaId: "ven-berlin-009", address: "151 Webster Square Rd, Berlin, CT 06037", phone: "(860) 505-4072", email: "berlin@squarepegpizzeria.com" },
  { id: "loc-10", name: "Bolton", vendestaId: "ven-bolton-010", address: "270 West St, Bolton, CT 06043", phone: "(860) 791-7109", email: "bolton@squarepegpizzeria.com" },
];

export type CateringStatus = "Requested" | "Waiting on you" | "Waiting on the customer" | "Confirmed" | "Completed" | "Cancelled";

export interface Contact {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  locationId: string;
  type: "B2B" | "Catering" | "Fundraiser";
}

export interface CateringOrder {
  id: string;
  contactId: string;
  contactName: string; // denormalized for easy display
  email?: string;
  phone?: string;
  notes?: string;
  locationId: string;
  eventName: string;
  eventDate: string;
  guestCount: number;
  totalAmount: number;
  status: CateringStatus;
  createdAt: string;
  quoteItems?: { description: string, amount: number, quantity: number }[];
  quoteTotal?: number;
  paymentLink?: string;
  quoteNotes?: string;
  orderPreference?: string;
  heardAboutUs?: string;
}

export interface FundraiserEvent {
  id: string;
  contactId: string;
  contactName: string;
  locationId: string;
  eventName: string;
  eventDate: string; // Must be a Tuesday
  customersAttended: number;
  revenueGenerated: number;
  notes: string;
}

// --- MOCK DATA ---

export const mockContacts: Contact[] = [
  { id: "c1", name: "Sarah Jenkins", company: "UConn Athletics", email: "sarah@uconn.edu", phone: "860-555-0199", locationId: "loc-1", type: "B2B" },
  { id: "c2", name: "Mike Thompson", company: "Vernon Tech", email: "mike@vernontech.com", phone: "860-555-2231", locationId: "loc-2", type: "Catering" },
  { id: "c3", name: "Jessica Alba", company: "Shelton PTO", email: "jessica@sheltonpto.org", phone: "203-555-8842", locationId: "loc-3", type: "Fundraiser" },
  { id: "c4", name: "David Cross", email: "dcross@gmail.com", phone: "860-555-1122", locationId: "loc-5", type: "Catering" },
];

export const mockCateringOrders: CateringOrder[] = [
  {
    id: "co-101",
    contactId: "c2",
    contactName: "Mike Thompson",
    locationId: "loc-2",
    eventName: "Corporate Lunch",
    eventDate: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
    guestCount: 45,
    totalAmount: 850.00,
    status: "Confirmed",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "co-102",
    contactId: "c4",
    contactName: "David Cross",
    locationId: "loc-5",
    eventName: "Birthday Party",
    eventDate: new Date(Date.now() + 86400000 * 12).toISOString(), // 12 days from now
    guestCount: 20,
    totalAmount: 320.00,
    status: "Waiting on the customer",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "co-103",
    contactId: "c1",
    contactName: "Sarah Jenkins",
    locationId: "loc-1",
    eventName: "Team Banquet",
    eventDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
    guestCount: 120,
    totalAmount: 2400.00,
    status: "Waiting on you",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: "co-104",
    contactId: "c3",
    contactName: "Jessica Alba",
    locationId: "loc-3",
    eventName: "Teacher Appreciation",
    eventDate: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
    guestCount: 60,
    totalAmount: 1100.00,
    status: "Confirmed",
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  }
];

export const mockFundraisers: FundraiserEvent[] = [
  {
    id: "f-1",
    contactId: "c3",
    contactName: "Jessica Alba",
    locationId: "loc-3",
    eventName: "Shelton High Band Booster",
    eventDate: "2024-06-11T18:00:00Z", // A Tuesday
    customersAttended: 145,
    revenueGenerated: 2150.50,
    notes: "Great turnout, ran out of pepperoni halfway through. Need to over-prep next year.",
  },
  {
    id: "f-2",
    contactId: "c1",
    contactName: "Sarah Jenkins",
    locationId: "loc-1",
    eventName: "UConn Ski Team",
    eventDate: "2024-06-18T18:00:00Z", // Next Tuesday
    customersAttended: 0,
    revenueGenerated: 0,
    notes: "Upcoming. Expecting 80-100 students.",
  }
];
