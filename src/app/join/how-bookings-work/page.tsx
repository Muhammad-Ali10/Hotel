"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"

const faqs = [
  {
    q: "Are bookings confirmed right away?",
    a: "Yes — bookings are confirmed instantly as soon as a guest completes their reservation. There's no manual review or approval step. Your calendar updates automatically the moment a booking comes through, so you never have to worry about double bookings.",
  },
  {
    q: "Can I choose which booking requests I accept or decline?",
    a: "No — any date you keep open on your calendar can be booked by any guest who meets your property's requirements. This ensures a smooth, reliable experience for travelers and keeps your listing visible in search results. You control availability through your calendar, not by filtering individual requests.",
  },
  {
    q: "Can I decide when I get bookings?",
    a: "Yes — you're in full control of your availability. Use your calendar to block dates when you can't accept guests, close entire room types for maintenance, or set minimum stay requirements. You can update your calendar anytime from the extranet dashboard.",
  },
]

export default function HowBookingsWorkPage() {
  return (
    <WizardShell>
      <StepHeading
        title="How bookings work"
        description="A few things to know about how bookings work — takes less than a minute."
      />

      <Accordion defaultValue={["item-0"]} className="w-full">
        {faqs.map((faq, i) => (
          <AccordionItem key={faq.q} value={`item-${i}`}>
            <AccordionTrigger className="text-left text-sm font-medium">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <StepNav slug="how-bookings-work" />
    </WizardShell>
  )
}
