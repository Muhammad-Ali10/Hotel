/* ============================================================================
 * The help centre's questions, and answers that describe THIS product.
 *
 * Lifted out of the page so the search box can actually search them — it used
 * to `toast.success("Searching help articles for …")` and stop, over a set of
 * answers that were sitting eight hundred pixels below it the whole time.
 *
 * Four of the answers described a different product:
 *
 *   · "Apple Pay, Google Pay and selected local payment methods" — the payments
 *     table holds a card brand and last four digits. Cards are the whole list.
 *   · "How do I earn and redeem reward points" — `users.points` has no earn and
 *     no spend logic anywhere. There is no loyalty module. What DOES affect a
 *     price is the Genius tier, so that is what the question is about now.
 *   · "message the hotel directly from this page" — a message hangs off a
 *     booking (rule #114), which is what decides who may read it. There is no
 *     way to message a property you have not booked.
 *   · "group or corporate bookings — our dedicated team will tailor rates" —
 *     no group booking flow, no corporate programme, no team behind it.
 * ========================================================================== */

export type Faq = { question: string; answer: string }

export const faqs: Faq[] = [
  {
    question: "How do I modify or cancel my booking?",
    answer:
      "Open My Bookings from your dashboard, choose the reservation you want to change, then select Modify or Cancel. What a cancellation costs depends on the rate plan you booked, and the exact refund is shown before you confirm — never estimated afterwards.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Credit and debit cards — Visa, Mastercard and American Express. When your rate is prepaid the card is charged at booking; when it is a guarantee rate the card is held and you settle at the property.",
  },
  {
    question: "What is the Genius tier?",
    answer:
      "It is the one thing about your account that changes a price: properties can run discounts that only Genius guests are shown, and those are applied automatically when you are signed in. Prices are always calculated on our side, so signing in is the only way to see yours.",
  },
  {
    question: "Can I request early check-in or late check-out?",
    answer:
      "Add it to the special requests field at checkout. It reaches the property with your booking, and they confirm it — it is a request, not a guarantee, and nothing is charged for it unless the property tells you otherwise.",
  },
  {
    question: "How do I message the property I booked with?",
    answer:
      "From the booking itself, in My Bookings. Messages belong to a reservation, which is what makes them private between you and that property — so there is no way to message a hotel you have not booked. For anything before you book, use the support form on this page.",
  },
  {
    question: "What happens if I need to change dates after booking?",
    answer:
      "Date changes go through My Bookings. If the new dates are available, the difference in price is quoted before you confirm. Whether a change is free depends on the rate plan you booked.",
  },
  {
    question: "Is my personal information secure?",
    answer:
      "Your card details never reach us — they go straight to the payment provider, and we store only the brand and last four digits. Passwords are hashed, sessions expire, and changing your password signs out every other device.",
  },
  {
    question: "How do I leave a review for a hotel I stayed at?",
    answer:
      "From the completed booking in My Bookings. Only a stay that actually finished can be reviewed, and only once — which is what the star rating on a listing is worth.",
  },
]
