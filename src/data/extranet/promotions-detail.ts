import type {
  GeniusTier,
  LongStayModule,
  PreferredCriterion,
  PromotionTemplate,
  RoomDifferentiation,
} from "@/lib/extranet/types"

/* --------------------------- Choose Promotion -------------------------- */

export const promotionTemplates: PromotionTemplate[] = [
  {
    id: "pt1",
    name: "Early Bird 2026",
    discount: "20% off",
    type: "Percentage",
    minStay: "Min 2 nights",
    bookingWindow: "Book 30+ days ahead",
    validity: "Jan 1 – Mar 31, 2026",
    status: "Available",
    uses: 312,
  },
  {
    id: "pt2",
    name: "Summer Getaway",
    discount: "$50 off",
    type: "Fixed amount",
    minStay: "Min 3 nights",
    bookingWindow: "Anytime",
    validity: "Jun 1 – Aug 31, 2026",
    status: "Available",
    uses: 198,
  },
  {
    id: "pt3",
    name: "Last Minute Escape",
    discount: "35% off",
    type: "Percentage",
    minStay: "Min 1 night",
    bookingWindow: "Within 3 days",
    validity: "Rolling",
    status: "Available",
    uses: 145,
  },
  {
    id: "pt4",
    name: "Weekend Special",
    discount: "3rd night free",
    type: "Free night",
    minStay: "Min 3 nights",
    bookingWindow: "Anytime",
    validity: "Fri – Sun",
    status: "Draft",
    uses: 0,
  },
  {
    id: "pt5",
    name: "Loyalty Member Rate",
    discount: "10% off",
    type: "Percentage",
    minStay: "Min 1 night",
    bookingWindow: "Members only",
    validity: "Year-round",
    status: "Available",
    uses: 523,
  },
]

/* ---------------------------- Genius Partner --------------------------- */

export const geniusTiers: GeniusTier[] = [
  {
    id: "gt1",
    level: "Genius Level 1",
    discount: "10% off",
    current: true,
    features: [
      "Basic Genius badge on listing",
      "Access to Genius traveler audience",
      "Standard placement in Genius search results",
    ],
  },
  {
    id: "gt2",
    level: "Genius Level 2",
    discount: "15% off",
    current: false,
    features: [
      "Premium Genius badge",
      "Priority placement in search results",
      "Featured in Genius email campaigns",
      "Genius loyalty points boost",
    ],
  },
  {
    id: "gt3",
    level: "Genius Level 3",
    discount: "20% off",
    current: false,
    features: [
      "Elite Genius badge",
      "Top placement in search results",
      "Dedicated Genius marketing campaigns",
      "Access to high-value Genius bookers",
      "Monthly performance reports",
      "Genius Partner webinars",
    ],
  },
]

/* --------------------------- Preferred Partner ------------------------- */

export const preferredCriteria: PreferredCriterion[] = [
  { id: "pc1", label: "Review Score", required: "8.0+", yours: "8.4", met: true },
  { id: "pc2", label: "Response Rate", required: "90%+", yours: "95%", met: true },
  { id: "pc3", label: "Cancellation Rate", required: "<5%", yours: "2.3%", met: true },
  { id: "pc4", label: "Commission", required: "15% min", yours: "12%", met: false },
  { id: "pc5", label: "Available Rooms", required: "5+", yours: "34", met: true },
  { id: "pc6", label: "Photos", required: "20+", yours: "28", met: true },
]

export const preferredQualifies = preferredCriteria.every((c) => c.met)

/* --------------------------- Long Stays Toolkit ------------------------ */

export const longStayModules: LongStayModule[] = [
  {
    id: "ls1",
    name: "Weekly Stay Discount",
    description: "Offer an automatic discount on stays of 7 or more nights.",
    status: "Active",
    icon: "Calendar",
  },
  {
    id: "ls2",
    name: "Monthly Stay Package",
    description: "Special rates and perks for guests booking 28+ nights.",
    status: "Available",
    icon: "CalendarRange",
  },
  {
    id: "ls3",
    name: "Work-from-Hotel Bundle",
    description: "Desk, fast Wi-Fi and unlimited coffee for remote workers.",
    status: "Active",
    icon: "Wifi",
  },
  {
    id: "ls4",
    name: "Long Stay Loyalty Bonus",
    description: "Reward returning long-stay guests with bonus perks.",
    status: "Available",
    icon: "BadgeCheck",
  },
]

/* ------------------------- Room Differentiation ------------------------ */

export const roomDifferentiation: RoomDifferentiation[] = [
  {
    id: "rd1",
    roomType: "Family Suite",
    marketStandard: "2 beds, basic amenities",
    yourOffering: "2 queens + sofa bed, kids amenities, separate living area",
    advantage: "Sleeps 6 vs market average of 4",
  },
  {
    id: "rd2",
    roomType: "Penthouse Suite",
    marketStandard: "Suite with city view",
    yourOffering: "Private terrace, butler service, jacuzzi, wine cellar",
    advantage: "Only penthouse with butler service in market",
  },
  {
    id: "rd3",
    roomType: "Accessible Room",
    marketStandard: "Standard accessible room",
    yourOffering: "Roll-in shower, grab bars, visual alarms, lowered fixtures",
    advantage: "Full WCAG 2.1 compliance",
  },
  {
    id: "rd4",
    roomType: "Deluxe Ocean Suite",
    marketStandard: "Ocean view room",
    yourOffering: "Floor-to-ceiling ocean views, private balcony, bathtub",
    advantage: "Direct beach access",
  },
]
