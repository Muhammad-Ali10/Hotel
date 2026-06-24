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
    { title: "About Us", href: "/support#about" },
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
        { title: "About Us", href: "/support#about" },
        { title: "Careers", href: "#" },
        { title: "Press", href: "#" },
        { title: "Blog", href: "#" },
      ],
    },
    {
      title: "Support",
      links: [
        { title: "Help Center", href: "/support" },
        { title: "Contact Us", href: "/support#contact" },
        { title: "Cancellation Policy", href: "#" },
        { title: "Terms of Service", href: "#" },
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
        { title: "Hotel Partners", href: "#" },
        { title: "Affiliate Program", href: "#" },
        { title: "Travel Agents", href: "#" },
        { title: "Corporate Travel", href: "#" },
      ],
    },
  ],

  legal: [
    { title: "Privacy Policy", href: "#" },
    { title: "Terms of Use", href: "#" },
    { title: "Cookies", href: "#" },
  ],

  socials: [
    { title: "Facebook", href: "#" },
    { title: "Twitter", href: "#" },
    { title: "Instagram", href: "#" },
    { title: "LinkedIn", href: "#" },
  ],
}

export type SiteConfig = typeof siteConfig
