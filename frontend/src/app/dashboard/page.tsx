import { StatCards } from "./_components/stat-cards"
import { UpcomingTrips } from "./_components/upcoming-trips"
import { RecentBookings } from "./_components/recent-bookings"

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <StatCards />

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Upcoming Trips
        </h2>
        <UpcomingTrips />
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Recent Bookings
        </h2>
        <RecentBookings />
      </section>
    </div>
  )
}
