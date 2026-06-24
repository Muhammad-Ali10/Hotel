import { ProfileForm } from "./_components/profile-form"

export default function ProfilePage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        Profile
      </h1>

      <ProfileForm />
    </div>
  )
}
