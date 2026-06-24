export type PropertyType =
  | "Hotel"
  | "Resort"
  | "Apartment"
  | "Villa"
  | "Boutique"

export type Room = {
  id: string
  name: string
  guests: number
  bed: string
  size: string
  features: string[]
  pricePerNight: number
}

export type HotelReview = {
  id: string
  author: string
  badge: string
  rating: number
  date: string
  comment: string
}

export type Hotel = {
  id: string
  name: string
  city: string
  country: string
  type: PropertyType
  pricePerNight: number
  originalPrice?: number
  discountLabel?: string
  rating: number
  reviewCount: number
  amenities: string[]
  description: string
  rooms: Room[]
  reviews: HotelReview[]
  /** image seed for the placeholder helper */
  seed: string
}

export type Destination = {
  id: string
  name: string
  properties: number
  seed: string
}

export type Testimonial = {
  id: string
  author: string
  role: string
  rating: number
  quote: string
  seed: string
}

export type Feature = {
  title: string
  description: string
  icon: string
}

export type BookingStatus = "confirmed" | "pending" | "completed" | "cancelled"

export type Booking = {
  id: string
  hotel: string
  room: string
  city: string
  checkIn: string
  checkOut: string
  guests: number
  total: number
  status: BookingStatus
  seed: string
}

export type Trip = {
  id: string
  hotel: string
  room: string
  date: string
  guests: number
  status: BookingStatus
  seed: string
}

export type NotificationType = "booking" | "offer" | "review" | "system"

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
  time: string
  read: boolean
}

export type UserReview = {
  id: string
  hotel: string
  city: string
  rating: number
  date: string
  comment: string
  seed: string
}
