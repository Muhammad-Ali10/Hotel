import type { Contact, TeamUser } from "@/lib/extranet/types"
import { PARTNER_ORG } from "@/data/config"
import { hotels } from "@/data/hotels"
import { partnerProfile } from "@/data/profile"

/**
 * ONE list of people at the partner organisation.
 *
 * The team screen and the contacts screen used to keep separate lists: one had
 * Tom Bergman, the other had Hiroshi Tanaka, and the same person carried a
 * different job title on each. `teamUsers` and `contacts` are now both derived
 * from this array, so they cannot disagree.
 */

type Member = {
  id: string
  firstName: string
  lastName: string
  /** what they do */
  jobTitle: string
  /** what they can do in the extranet */
  access: TeamUser["role"]
  status: TeamUser["status"]
  lastLogin: string
  phone: string
  /** the hotel they run, or undefined for org-wide */
  hotelId?: string
}

const members: Member[] = [
  {
    id: "u1",
    firstName: "Sarah",
    lastName: "Mitchell",
    jobTitle: partnerProfile.role,
    access: "Admin",
    status: "Active",
    lastLogin: "2 hours ago",
    phone: "+1 (212) 555-0101",
  },
  {
    id: "u2",
    firstName: "David",
    lastName: "Chen",
    jobTitle: "Operations Manager",
    access: "Manager",
    status: "Active",
    lastLogin: "Yesterday",
    phone: "+33 1 55 50 01 44",
    hotelId: "four-seasons",
  },
  {
    id: "u3",
    firstName: "Maria",
    lastName: "Lopez",
    jobTitle: "Property Manager",
    access: "Manager",
    status: "Active",
    lastLogin: "3 days ago",
    phone: "+960 555 0177",
    hotelId: "one-and-only",
  },
  {
    id: "u4",
    firstName: "Hiroshi",
    lastName: "Tanaka",
    jobTitle: "Property Manager",
    access: "Staff",
    status: "Active",
    lastLogin: "1 week ago",
    phone: "+81 3 5555 0188",
    hotelId: "aman-tokyo",
  },
  {
    id: "u5",
    firstName: "Hans",
    lastName: "Mueller",
    jobTitle: "Property Manager",
    access: "Staff",
    status: "Invited",
    lastLogin: "Never",
    phone: "+852 5555 0199",
    hotelId: "the-peninsula",
  },
]

const email = (m: Member) =>
  `${m.firstName.toLowerCase()}.${m.lastName.toLowerCase()}@aurorahospitality.com`
const seed = (m: Member) => `${m.firstName.toLowerCase()}-${m.lastName.toLowerCase()}`
const fullName = (m: Member) => `${m.firstName} ${m.lastName}`

/** Create & Manage Users — access levels. */
export const teamUsers: TeamUser[] = members.map((m) => ({
  id: m.id,
  name: fullName(m),
  email: email(m),
  role: m.access,
  status: m.status,
  lastLogin: m.lastLogin,
  seed: seed(m),
}))

/** Contacts — the same people, with their job titles and the property they run. */
export const contacts: Contact[] = members.map((m) => ({
  id: `ct-${m.id}`,
  name: fullName(m),
  email: email(m),
  phone: m.phone,
  role: m.jobTitle,
  property: m.hotelId
    ? (hotels.find((h) => h.id === m.hotelId)?.name ?? "All Properties")
    : "All Properties",
  seed: seed(m),
}))

export const currentUser = {
  name: partnerProfile.name,
  role: partnerProfile.role,
  email: partnerProfile.email,
  phone: members[0].phone,
  company: PARTNER_ORG.name,
  location: partnerProfile.location,
  seed: partnerProfile.seed,
}
