"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import { faqs } from "../_lib/faqs"

/**
 * The answers, filtered by whatever the search box put in the URL.
 *
 * The two used to be unrelated: a search box at the top of the page that
 * searched nothing, and this list at the bottom that always showed everything.
 * They are one feature now, joined by `?q=` rather than by shared state, so a
 * result can be linked to.
 *
 * A match opens automatically when it is the only one — a search that returns
 * one answer should show it, not make you click again.
 */
function FaqListInner() {
  const params = useSearchParams()
  const query = params.get("q")?.trim().toLowerCase() ?? ""

  const matches = query
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      )
    : faqs

  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground mt-8 text-center text-sm">
        No answer here covers that. The form below reaches a person.
      </p>
    )
  }

  return (
    <Accordion
      className="mt-8"
      defaultValue={matches.length === 1 ? [matches[0]!.question] : []}
    >
      {matches.map((faq) => (
        <AccordionItem key={faq.question} value={faq.question}>
          <AccordionTrigger className="font-heading text-base font-medium">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            <p>{faq.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/** Same Suspense requirement as the search box it is driven by. */
export function FaqList() {
  return (
    <React.Suspense fallback={<div className="mt-8 h-64" aria-hidden />}>
      <FaqListInner />
    </React.Suspense>
  )
}
