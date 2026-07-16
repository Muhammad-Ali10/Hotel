import type { Review, ReviewCategories, ReviewStatus } from "@/types"
import { addDays } from "@/lib/domain"
import { makeRandom, randomInt } from "@/lib/random"
import { TODAY } from "./config"
import { hotels } from "./hotels"

/**
 * Review seed. Every hotel gets its own reviews — the catalogue used to reuse
 * one array of three across all ten properties, so `rating` and `reviewCount`
 * could not tie to anything. Headline ratings are now derived from this list
 * via `deriveRating`, never stored on the hotel.
 */

type ReviewTemplate = {
  rating: number
  title: string
  body: string
  /** category deltas applied to the base rating, clamped to 1–5 */
  skew?: Partial<Record<keyof ReviewCategories, number>>
}

const templates: ReviewTemplate[] = [
  {
    rating: 5,
    title: "Worth every penny",
    body: "We booked two nights and extended to four. The staff remembered our names by the second morning, the room was silent despite the location, and nothing we asked for was ever a problem.",
  },
  {
    rating: 5,
    title: "The best stay we've had",
    body: "From the welcome to the check-out, everything was handled with a kind of quiet precision you rarely see. The breakfast alone is worth the booking.",
    skew: { staff: 0 },
  },
  {
    rating: 4,
    title: "Beautiful property, small niggles",
    body: "The building and the grounds are stunning and the spa was a highlight. Check-in took twenty-five minutes on a busy evening, which is the only reason this isn't five stars.",
    skew: { staff: -1 },
  },
  {
    rating: 5,
    title: "Faultless",
    body: "Third time back and it has not slipped once. The suite was exactly as photographed, the bed is genuinely the most comfortable I have slept in, and the concierge got us a table nobody else could.",
  },
  {
    rating: 4,
    title: "Excellent, if pricey",
    body: "No complaints about the room or the service — both were first-rate. The extras add up quickly though, and the minibar pricing raised an eyebrow.",
    skew: { comfort: 1 },
  },
  {
    rating: 5,
    title: "Exceeded every expectation",
    body: "We came for an anniversary and they turned it into something we still talk about. Champagne waiting, a handwritten note, and a late check-out offered before we asked.",
  },
  {
    rating: 3,
    title: "Good but not what we expected",
    body: "The location and the building are excellent. Our room faced an interior wall despite what we booked, and it took two calls to sort. Once moved, the stay was lovely.",
    skew: { location: 2, comfort: -1 },
  },
  {
    rating: 5,
    title: "The service is the difference",
    body: "Plenty of hotels have nice rooms. Very few have a team that anticipates what you need before you say it. That is what you are paying for here.",
  },
  {
    rating: 4,
    title: "Lovely stay, would return",
    body: "Spotless throughout and the pool area never felt crowded. Wifi dropped a few times in the room which was mildly annoying for work calls.",
  },
  {
    rating: 5,
    title: "Genuinely special",
    body: "Booked on a whim and could not be happier. The restaurant is destination-worthy on its own and the staff made our children feel like guests rather than an inconvenience.",
  },
  {
    rating: 4,
    title: "Very good, minor gripes",
    body: "Bed, bath and view all excellent. Breakfast service was slow on the Saturday but the food made up for it.",
  },
  {
    rating: 5,
    title: "Impeccable from start to finish",
    body: "Everything was where it should be, when it should be. Immaculate rooms, an unhurried check-in, and a spa that lived up to the photographs.",
  },
]

const authors = [
  { name: "Alexandra Chen", country: "Singapore", seed: "rv-alexandra" },
  { name: "Michael Torres", country: "United States", seed: "rv-michael" },
  { name: "Emma Watson", country: "United Kingdom", seed: "rv-emma" },
  { name: "Rahul Mehta", country: "India", seed: "rv-rahul" },
  { name: "Sofia Martinez", country: "Spain", seed: "rv-sofia" },
  { name: "Lars Andersen", country: "Denmark", seed: "rv-lars" },
  { name: "Yuki Tanaka", country: "Japan", seed: "rv-yuki" },
  { name: "Claire Dubois", country: "France", seed: "rv-claire" },
  { name: "James Chen", country: "Australia", seed: "rv-james" },
  { name: "Nadia Hassan", country: "UAE", seed: "rv-nadia" },
  { name: "Tom Bergman", country: "Sweden", seed: "rv-tom" },
  { name: "Priya Nair", country: "India", seed: "rv-priya" },
  { name: "Marco Rossi", country: "Italy", seed: "rv-marco" },
  { name: "Grace Lee", country: "South Korea", seed: "rv-grace" },
  { name: "Daniel Kim", country: "South Korea", seed: "rv-daniel" },
  { name: "Olivia Bennett", country: "Canada", seed: "rv-olivia" },
]

const responses = [
  "Thank you for taking the time to write this — I have shared it with the whole team, who will be delighted. We hope to welcome you back before long.",
  "We really appreciate the feedback, and I am sorry the check-in took longer than it should have. We have added a second host to the evening shift since your stay.",
  "Thank you for staying with us and for the generous words. Do let us know before your next visit — we would love to arrange the same table again.",
  "I am glad the team could make the occasion feel special, and thank you for telling us. The note is now on our staff board.",
]

function clamp(n: number): number {
  return Math.min(5, Math.max(1, n))
}

function categoriesFor(
  rating: number,
  skew: ReviewTemplate["skew"],
  seed: string
): ReviewCategories {
  const random = makeRandom(seed)
  const jitter = () => (random() < 0.4 ? (random() < 0.5 ? -1 : 1) * 0.5 : 0)
  return {
    cleanliness: clamp(rating + (skew?.cleanliness ?? 0) + jitter()),
    comfort: clamp(rating + (skew?.comfort ?? 0) + jitter()),
    location: clamp(rating + (skew?.location ?? 0) + jitter()),
    facilities: clamp(rating + (skew?.facilities ?? 0) + jitter()),
    staff: clamp(rating + (skew?.staff ?? 0) + jitter()),
  }
}

function buildReviews(): Review[] {
  const out: Review[] = []

  for (const hotel of hotels) {
    const count = randomInt(5, 8, `${hotel.seed}-review-count`)
    const managed = Boolean(hotel.managedBy)

    for (let i = 0; i < count; i++) {
      const seed = `${hotel.seed}-review-${i}`
      const template = templates[randomInt(0, templates.length - 1, `${seed}-tpl`)]
      const author = authors[randomInt(0, authors.length - 1, `${seed}-author`)]
      const room = hotel.rooms[randomInt(0, hotel.rooms.length - 1, `${seed}-room`)]
      const daysAgo = randomInt(3, 240, `${seed}-age`)

      // Managed hotels carry the moderation queue the extranet works through;
      // unmanaged hotels have nobody to moderate them, so all are published.
      let status: ReviewStatus = "published"
      if (managed && i === 0) status = "pending"
      else if (managed && i === 1 && hotel.id === "the-ritz-carlton") status = "flagged"

      const hasResponse = managed && status === "published" && i % 3 === 0

      out.push({
        id: `rev-${hotel.id}-${i + 1}`,
        hotelId: hotel.id,
        bookingId: i % 4 === 3 ? undefined : `seeded-stay-${hotel.id}-${i}`,
        author: author.name,
        authorSeed: author.seed,
        country: author.country,
        roomName: room.name,
        rating: template.rating,
        categories: categoriesFor(template.rating, template.skew, `${seed}-cat`),
        title: template.title,
        body: template.body,
        date: addDays(TODAY, -daysAgo),
        status,
        response: hasResponse
          ? {
              text: responses[randomInt(0, responses.length - 1, `${seed}-resp`)],
              date: addDays(TODAY, -Math.max(daysAgo - 2, 1)),
            }
          : undefined,
      })
    }
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export const reviews: Review[] = buildReviews()
