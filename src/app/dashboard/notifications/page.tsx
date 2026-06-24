import { notifications } from "@/data"

import { NotificationList } from "./_components/notification-list"

export default function NotificationsPage() {
  return <NotificationList items={notifications} />
}
