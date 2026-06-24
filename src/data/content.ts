import type { Feature, Testimonial } from "@/types"

export const whyChooseUs: Feature[] = [
  {
    title: "Best Price Guarantee",
    description:
      "We guarantee the lowest rates for luxury properties. If you find a better price elsewhere, we'll match it.",
    icon: "BadgeDollarSign",
  },
  {
    title: "Verified Reviews",
    description:
      "Every review on our platform comes from confirmed guests. No fake reviews, no misleading ratings.",
    icon: "ShieldCheck",
  },
  {
    title: "24/7 Concierge",
    description:
      "Our dedicated concierge team is available around the clock to handle any request, from reservations to recommendations.",
    icon: "Headset",
  },
  {
    title: "Exclusive Perks",
    description:
      "Enjoy complimentary upgrades, late checkouts, spa credits, and welcome amenities at partner properties.",
    icon: "Gift",
  },
]

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    author: "Sarah Mitchell",
    role: "Business Traveler",
    rating: 5,
    quote:
      "The attention to detail was impeccable. Every aspect of our stay was curated to perfection.",
    seed: "sarah",
  },
  {
    id: "t2",
    author: "James Chen",
    role: "Luxury Enthusiast",
    rating: 5,
    quote:
      "I have stayed at properties worldwide, and this experience ranks among the finest. Truly exceptional.",
    seed: "james",
  },
  {
    id: "t3",
    author: "Elena Rodriguez",
    role: "Travel Blogger",
    rating: 5,
    quote:
      "As someone who reviews luxury hotels for a living, I am genuinely impressed. The properties are stunning.",
    seed: "elena",
  },
  {
    id: "t4",
    author: "Michael Thompson",
    role: "Honeymoon Guest",
    rating: 5,
    quote:
      "Our honeymoon exceeded every expectation. The private dining experience on the terrace was unforgettable.",
    seed: "michael",
  },
  {
    id: "t5",
    author: "Amara Okafor",
    role: "Family Vacationer",
    rating: 5,
    quote:
      "Traveling with three children can be challenging, but the staff made it effortless. Highly recommended.",
    seed: "amara",
  },
  {
    id: "t6",
    author: "David Park",
    role: "Corporate Executive",
    rating: 5,
    quote:
      "Efficiency meets elegance. The business center, meeting rooms, and connectivity are world-class.",
    seed: "david",
  },
]
