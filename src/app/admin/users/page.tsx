import type { Metadata } from "next"

import { UsersView } from "./_components/users-view"

export const metadata: Metadata = { title: "Managers & Users · Stayora Admin" }

export default function AdminUsersPage() {
  return <UsersView />
}
