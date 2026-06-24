import type {
  AppNotification,
  Booking,
  Trip,
  UserReview,
} from "@/types"

export const dashboardUser = {
  name: "John Doe",
  email: "john.doe@example.com",
  membership: "Gold Member",
  phone: "+1 (555) 014-2389",
  location: "New York, USA",
  joined: "January 2024",
  seed: "john-doe",
}

export const dashboardStats = [
  { label: "Upcoming Trips", value: "3", icon: "Plane" },
  { label: "Total Bookings", value: "4", icon: "CalendarCheck" },
  { label: "Saved Hotels", value: "4", icon: "Heart" },
  { label: "Reward Points", value: "12,450", icon: "Sparkles" },
]

export const upcomingTrips: Trip[] = [
  {
    id: "u1",
    hotel: "The Ritz-Carlton",
    room: "Premier Suite",
    date: "2026-06-15",
    guests: 2,
    status: "confirmed",
    seed: "ritz-carlton",
  },
  {
    id: "u2",
    hotel: "Four Seasons Resort",
    room: "Sunset Water Villa",
    date: "2026-07-20",
    guests: 2,
    status: "confirmed",
    seed: "four-seasons",
  },
  {
    id: "u3",
    hotel: "Marina Bay Sands",
    room: "Deluxe Room",
    date: "2026-08-05",
    guests: 2,
    status: "pending",
    seed: "marina-bay",
  },
]

export const bookings: Booking[] = [
  {
    id: "b1",
    hotel: "The Ritz-Carlton",
    room: "Premier Suite",
    city: "New York, USA",
    checkIn: "2026-06-15",
    checkOut: "2026-06-18",
    guests: 2,
    total: 2850,
    status: "confirmed",
    seed: "ritz-carlton",
  },
  {
    id: "b2",
    hotel: "Four Seasons Resort",
    room: "Sunset Water Villa",
    city: "Maldives",
    checkIn: "2026-07-20",
    checkOut: "2026-07-25",
    guests: 2,
    total: 4750,
    status: "confirmed",
    seed: "four-seasons",
  },
  {
    id: "b3",
    hotel: "Marina Bay Sands",
    room: "Deluxe Room",
    city: "Singapore",
    checkIn: "2026-08-05",
    checkOut: "2026-08-08",
    guests: 2,
    total: 1650,
    status: "pending",
    seed: "marina-bay",
  },
  {
    id: "b4",
    hotel: "Atlantis The Palm",
    room: "Ocean Suite",
    city: "Dubai, UAE",
    checkIn: "2026-04-10",
    checkOut: "2026-04-14",
    guests: 2,
    total: 1800,
    status: "completed",
    seed: "atlantis",
  },
]

export const userReviews: UserReview[] = [
  {
    id: "ur1",
    hotel: "Atlantis The Palm",
    city: "Dubai, UAE",
    rating: 5,
    date: "April 2026",
    comment:
      "Absolutely breathtaking property. The aquarium suite was a once-in-a-lifetime experience for the whole family.",
    seed: "atlantis",
  },
  {
    id: "ur2",
    hotel: "The Ritz-Carlton",
    city: "New York, USA",
    rating: 4,
    date: "March 2026",
    comment:
      "Elegant rooms and impeccable service. Central Park views were stunning. Would happily return.",
    seed: "ritz-carlton",
  },
  {
    id: "ur3",
    hotel: "Mandarin Oriental",
    city: "Bangkok, Thailand",
    rating: 5,
    date: "January 2026",
    comment:
      "The riverside setting and spa were unforgettable. Staff anticipated every need with grace.",
    seed: "mandarin-oriental",
  },
]

export const notifications: AppNotification[] = [
  {
    id: "n1",
    type: "booking",
    title: "Booking Confirmed",
    message: "Your stay at The Ritz-Carlton, New York is confirmed for Jun 15–18.",
    time: "2 hours ago",
    read: false,
  },
  {
    id: "n2",
    type: "offer",
    title: "Exclusive Offer",
    message: "Enjoy 15% off luxury suites in the Maldives this season.",
    time: "1 day ago",
    read: false,
  },
  {
    id: "n3",
    type: "review",
    title: "Share Your Experience",
    message: "How was your stay at Atlantis The Palm? Leave a review.",
    time: "3 days ago",
    read: true,
  },
  {
    id: "n4",
    type: "system",
    title: "Reward Points Added",
    message: "You earned 1,200 reward points from your recent booking.",
    time: "5 days ago",
    read: true,
  },
]
