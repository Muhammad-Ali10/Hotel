import type {
  Compliance,
  Contact,
  Contract,
  Device,
} from "@/lib/extranet/types"

export const contacts: Contact[] = [
  {
    id: "ct1",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@aurorahospitality.com",
    phone: "+1 (310) 555-0101",
    role: "General Manager",
    property: "All Properties",
    seed: "sarah-mitchell",
  },
  {
    id: "ct2",
    name: "David Chen",
    email: "david.chen@aurorahospitality.com",
    phone: "+1 (312) 555-0144",
    role: "Operations Manager",
    property: "The Metropolitan",
    seed: "david-chen",
  },
  {
    id: "ct3",
    name: "Maria Lopez",
    email: "maria.lopez@aurorahospitality.com",
    phone: "+52 984 555 0177",
    role: "Property Manager",
    property: "Casa del Mar",
    seed: "maria-lopez",
  },
  {
    id: "ct4",
    name: "Hiroshi Tanaka",
    email: "hiroshi.tanaka@aurorahospitality.com",
    phone: "+81 75 555 0188",
    role: "Property Manager",
    property: "Sakura Ryokan",
    seed: "hiroshi-tanaka",
  },
  {
    id: "ct5",
    name: "Hans Mueller",
    email: "hans.mueller@aurorahospitality.com",
    phone: "+41 27 555 0199",
    role: "Property Manager",
    property: "Alpine Lodge Zermatt",
    seed: "hans-mueller",
  },
]

export const devices: Device[] = [
  {
    id: "dv1",
    name: 'MacBook Pro 16"',
    browser: "Chrome 126",
    location: "New York, US",
    lastActive: "Active now",
    current: true,
    type: "laptop",
  },
  {
    id: "dv2",
    name: "iPhone 16 Pro",
    browser: "Safari 18",
    location: "New York, US",
    lastActive: "2 hours ago",
    current: false,
    type: "phone",
  },
  {
    id: "dv3",
    name: "iPad Air",
    browser: "Safari 18",
    location: "Malibu, US",
    lastActive: "Yesterday",
    current: false,
    type: "tablet",
  },
  {
    id: "dv4",
    name: "Windows Desktop",
    browser: "Edge 126",
    location: "Zurich, CH",
    lastActive: "3 days ago",
    current: false,
    type: "desktop",
  },
]

export const connectivityProvider = {
  name: "SiteMinder",
  status: "Connected",
  since: "Jan 15, 2025",
  lastSync: "Jun 15, 2026 · 9:45 AM",
  frequency: "Every 15 minutes",
  channels: ["Booking.com", "Expedia", "Agoda", "Trip.com"],
}

export const contracts: Contract[] = [
  {
    id: "co1",
    name: "Master Service Agreement",
    type: "Legal",
    status: "Active",
    signed: "Jan 15, 2025",
    expires: "Jan 15, 2027",
    body: "This Master Service Agreement governs the relationship between Stayora and Aurora Hospitality. It sets out a platform commission of 12% on all completed bookings, with settlement to the partner within 7 business days of guest check-out. Either party may terminate with 60 days' written notice. This document is digitally signed and legally binding.",
  },
  {
    id: "co2",
    name: "Commission Agreement",
    type: "Financial",
    status: "Active",
    signed: "Jan 15, 2025",
    expires: "Jan 15, 2027",
    body: "The Commission Agreement details the 12% standard commission rate, applicable taxes, and the monthly invoicing and payout schedule. Adjusted rates apply to Genius and Preferred Partner participation. This document is digitally signed and legally binding.",
  },
  {
    id: "co3",
    name: "Data Processing Addendum",
    type: "Privacy",
    status: "Active",
    signed: "Jan 15, 2025",
    expires: "Jan 15, 2027",
    body: "The Data Processing Addendum defines how guest personal data is collected, processed and stored in compliance with GDPR and CCPA. Stayora acts as a data processor on behalf of the partner. This document is digitally signed and legally binding.",
  },
  {
    id: "co4",
    name: "Genius Partner Addendum",
    type: "Program",
    status: "Active",
    signed: "Mar 1, 2025",
    expires: "Mar 1, 2027",
    body: "The Genius Partner Addendum sets out the terms of participation in the Genius loyalty program, including the minimum discount offered to Genius travellers and the enhanced visibility benefits. This document is digitally signed and legally binding.",
  },
]

export const compliance: Compliance[] = [
  {
    id: "cm1",
    name: "GDPR Compliance",
    status: "Compliant",
    lastReviewed: "Mar 2026",
    description: "EU General Data Protection Regulation requirements met",
  },
  {
    id: "cm2",
    name: "PCI DSS",
    status: "Compliant",
    lastReviewed: "Feb 2026",
    description: "Payment Card Industry Data Security Standard certified",
  },
  {
    id: "cm3",
    name: "CCPA",
    status: "Compliant",
    lastReviewed: "Jan 2026",
    description: "California Consumer Privacy Act requirements met",
  },
  {
    id: "cm4",
    name: "Accessibility (WCAG 2.1)",
    status: "In Progress",
    lastReviewed: "May 2026",
    description: "Web Content Accessibility Guidelines — AA level target",
  },
  {
    id: "cm5",
    name: "Anti-Money Laundering",
    status: "Compliant",
    lastReviewed: "Apr 2026",
    description: "AML/KYC procedures in place for all transactions",
  },
]
