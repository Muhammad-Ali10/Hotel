import type { TeamUser, ToggleSetting } from "@/lib/extranet/types"

export const currentUser = {
  name: "Sarah Mitchell",
  role: "General Manager",
  email: "sarah.mitchell@aurorahospitality.com",
  phone: "+1 (310) 555-0101",
  company: "Aurora Hospitality",
  location: "Malibu, CA",
  seed: "sarah-mitchell",
}

/** Create & Manage Users — 5 team members. */
export const teamUsers: TeamUser[] = [
  {
    id: "u1",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@aurorahospitality.com",
    role: "Admin",
    status: "Active",
    lastLogin: "2 hours ago",
    seed: "sarah-mitchell",
  },
  {
    id: "u2",
    name: "David Chen",
    email: "david.chen@aurorahospitality.com",
    role: "Manager",
    status: "Active",
    lastLogin: "Yesterday",
    seed: "david-chen",
  },
  {
    id: "u3",
    name: "Maria Lopez",
    email: "maria.lopez@aurorahospitality.com",
    role: "Manager",
    status: "Active",
    lastLogin: "3 days ago",
    seed: "maria-lopez",
  },
  {
    id: "u4",
    name: "Hans Mueller",
    email: "hans.mueller@aurorahospitality.com",
    role: "Staff",
    status: "Active",
    lastLogin: "1 week ago",
    seed: "hans-mueller",
  },
  {
    id: "u5",
    name: "Tom Bergman",
    email: "tom.bergman@aurorahospitality.com",
    role: "Staff",
    status: "Invited",
    lastLogin: "Never",
    seed: "tom-bergman",
  },
]

export const notificationSettings: ToggleSetting[] = [
  {
    id: "ns1",
    label: "Email Notifications",
    description:
      "Receive booking confirmations, cancellations, and system updates via email",
    enabled: true,
  },
  {
    id: "ns2",
    label: "SMS Alerts",
    description:
      "Urgent alerts via SMS (booking within 24h, last-minute cancellations)",
    enabled: false,
  },
  {
    id: "ns3",
    label: "Push Notifications",
    description: "Real-time push notifications on your mobile device",
    enabled: true,
  },
  {
    id: "ns4",
    label: "Marketing Emails",
    description: "Product updates, tips, and promotional offers from Stayora",
    enabled: false,
  },
  {
    id: "ns5",
    label: "Weekly Digest",
    description: "Weekly performance summary and key metrics",
    enabled: true,
  },
  {
    id: "ns6",
    label: "Review Alerts",
    description: "Instant notification when a guest leaves a review",
    enabled: true,
  },
]

export const securitySettings: ToggleSetting[] = [
  {
    id: "se1",
    label: "Two-Factor Authentication",
    description: "Add an extra layer of security to your account",
    enabled: true,
  },
  {
    id: "se2",
    label: "Login Alerts",
    description:
      "Get notified when someone logs into your account from a new device",
    enabled: true,
  },
  {
    id: "se3",
    label: "Session Timeout",
    description: "Automatically log out after 30 minutes of inactivity",
    enabled: true,
  },
  {
    id: "se4",
    label: "IP Restriction",
    description: "Only allow logins from specific IP addresses",
    enabled: false,
  },
]
