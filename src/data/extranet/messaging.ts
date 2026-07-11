import type {
  MessagingChannel,
  MessagingPreference,
} from "@/lib/extranet/types"

/** Column order for the Messaging Preferences matrix. */
export const messagingChannels: { id: MessagingChannel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "push", label: "Push" },
]

/**
 * Notification preferences shown on the Property → Messaging Preferences screen.
 * Each row can be delivered over Email, SMS and/or Push. Mock data mirrors the
 * "Aurora Hospitality" Figma design.
 */
export const messagingPreferences: MessagingPreference[] = [
  {
    id: "booking-confirmation",
    label: "Booking Confirmation",
    description: "When a guest completes a booking",
    channels: { email: true, sms: true, push: true },
  },
  {
    id: "cancellation-alert",
    label: "Cancellation Alert",
    description: "When a reservation is cancelled",
    channels: { email: true, sms: true, push: true },
  },
  {
    id: "checkin-reminder",
    label: "Check-in Reminder",
    description: "24 hours before guest arrival",
    channels: { email: true, sms: false, push: true },
  },
  {
    id: "new-guest-message",
    label: "New Guest Message",
    description: "When a guest sends a message",
    channels: { email: true, sms: false, push: true },
  },
  {
    id: "review-posted",
    label: "Review Posted",
    description: "When a guest leaves a review",
    channels: { email: true, sms: false, push: false },
  },
  {
    id: "payment-received",
    label: "Payment Received",
    description: "When a payment is processed",
    channels: { email: true, sms: false, push: true },
  },
  {
    id: "promotional-emails",
    label: "Promotional Emails",
    description: "Marketing and promotional updates from Stayora",
    channels: { email: false, sms: false, push: false },
  },
]
