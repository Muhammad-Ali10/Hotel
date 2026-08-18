// TEMPORARY build-time probe — deleted after verification.
import { bookings } from "@/data/bookings"
import { hotels } from "@/data/hotels"
import { reviews } from "@/data/reviews"
import { userProfile } from "@/data/profile"
import { datesInRange, unitsBookedOn } from "@/lib/domain"

export default function Page() {
  const owned = bookings.filter((b) => b.customerId === userProfile.id)
  const orphanOwner = bookings.filter(
    (b) => b.customerId !== undefined && b.customerId !== userProfile.id
  )

  const overCapacity = bookings.filter((b) => {
    const room = hotels.find((h) => h.id === b.hotelId)?.rooms.find((r) => r.id === b.roomId)
    return room ? b.guests > room.guests : false
  })

  const overbooked: string[] = []
  for (const hotel of hotels) {
    for (const room of hotel.rooms) {
      const nights = new Set(
        bookings
          .filter((b) => b.hotelId === hotel.id && b.roomId === room.id && b.status !== "cancelled")
          .flatMap((b) => datesInRange(b.checkIn, b.checkOut))
      )
      for (const iso of nights) {
        const used = unitsBookedOn(bookings, hotel.id, room.id, iso)
        if (used > room.units) {
          overbooked.push(`${hotel.id}/${room.id} ${iso}: ${used}/${room.units}`)
        }
      }
    }
  }

  const dupeRefs = bookings.length - new Set(bookings.map((b) => b.id)).size

  console.log("SEEDCHECK owned-by-demo-user:", owned.length, "of", bookings.length)
  console.log("SEEDCHECK other-owners:", orphanOwner.length)
  console.log("SEEDCHECK over-capacity:", overCapacity.length, overCapacity.map((b) => b.id))
  console.log("SEEDCHECK overbooked:", overbooked.length, overbooked.slice(0, 10))
  console.log("SEEDCHECK duplicate-refs:", dupeRefs)
  console.log("SEEDCHECK reviews-with-authorId:", reviews.filter((r) => r.authorId).length)

  return <p>seedcheck</p>
}
