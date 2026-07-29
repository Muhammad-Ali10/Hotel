export type NavLink = { title: string; href: string }

export const siteConfig = {
  name: "Stayora",
  tagline: "Discover the World's Finest Hotels",
  description:
    "Curated luxury accommodations for the discerning traveler. Unforgettable stays at the world's finest hotels.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  // Public top-nav links.
  mainNav: [
    { title: "Home", href: "/" },
    { title: "Hotels", href: "/hotels" },
    { title: "Offers", href: "/hotels?filter=offers" },
    { title: "Destinations", href: "/hotels?view=destinations" },
    { title: "About Us", href: "/about" },
    { title: "Contact", href: "/support#contact" },
  ] satisfies NavLink[],

  // Booking category tabs shown under the nav.
  categories: [
    { label: "Stays", icon: "🏨", active: true },
    { label: "Flights", icon: "✈️", active: false },
    { label: "Car rentals", icon: "🚗", active: false },
    { label: "Attractions", icon: "🎟️", active: false },
    { label: "Airport taxis", icon: "🚕", active: false },
  ],

  // Public footer link groups.
  footerNav: [
    {
      title: "Company",
      links: [
        { title: "About Us", href: "/about" },
        { title: "Careers", href: "/careers" },
        { title: "Press", href: "/press" },
        { title: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Support",
      links: [
        { title: "Help Center", href: "/support" },
        { title: "Contact Us", href: "/support#contact" },
        { title: "Cancellation Policy", href: "/cancellation-policy" },
        { title: "Terms of Service", href: "/terms" },
      ],
    },
    {
      title: "Destinations",
      links: [
        { title: "Dubai", href: "/hotels?city=Dubai" },
        { title: "Paris", href: "/hotels?city=Paris" },
        { title: "Maldives", href: "/hotels?city=Maldives" },
        { title: "Tokyo", href: "/hotels?city=Tokyo" },
      ],
    },
    {
      title: "Partners",
      links: [
        { title: "List your property", href: "/join" },
        { title: "Hotel Partners", href: "/partners/hotels" },
        { title: "Affiliate Program", href: "/partners/affiliate" },
        { title: "Travel Agents", href: "/partners/travel-agents" },
      ],
    },
  ],

  legal: [
    { title: "Privacy Policy", href: "/privacy" },
    // Same document as "Terms of Service" in the Support column — one source of truth.
    { title: "Terms of Use", href: "/terms" },
    { title: "Cookies", href: "/cookies" },
  ],

  socials: [
    { title: "Facebook", href: "#" },
    { title: "Twitter", href: "#" },
    { title: "Instagram", href: "#" },
    { title: "LinkedIn", href: "#" },
  ],
}

export type SiteConfig = typeof siteConfig
