import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export type LegalSection = {
  heading: string
  body: string[]
}

/** Slug used for the in-page anchor + table-of-contents link. */
function anchor(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Shared document shell for the policy pages (terms, privacy, cookies,
 * cancellation). Same hero band + prose rhythm as the Help Center so the
 * legal pages read as part of the site rather than bolted on.
 */
export function LegalShell({
  eyebrow,
  icon: Icon,
  title,
  summary,
  updated,
  sections,
}: {
  eyebrow: string
  icon: LucideIcon
  title: string
  summary: string
  updated: string
  sections: LegalSection[]
}) {
  return (
    <div>
      {/* HERO */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <Badge variant="secondary">
            <Icon className="size-3" />
            {eyebrow}
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">
            {summary}
          </p>
          <p className="text-muted-foreground mt-6 text-sm">
            Last updated {updated}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        {/* CONTENTS */}
        <nav
          aria-label="On this page"
          className="rounded-xl border bg-muted/30 p-6"
        >
          <h2 className="font-heading text-sm font-semibold">On this page</h2>
          <ol className="mt-3 space-y-2">
            {sections.map((section, i) => (
              <li key={section.heading} className="flex gap-2 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {i + 1}.
                </span>
                <a
                  href={`#${anchor(section.heading)}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* DOCUMENT */}
        <div className="mt-10 space-y-10">
          {sections.map((section, i) => (
            <section
              key={section.heading}
              id={anchor(section.heading)}
              className="scroll-mt-24"
            >
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                <span className="text-muted-foreground mr-2 tabular-nums">
                  {i + 1}.
                </span>
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-muted-foreground mt-3 leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {/* FOOTNOTE */}
        <div className="mt-12 rounded-xl border bg-muted/30 p-6">
          <h2 className="font-heading font-semibold">Questions about this policy?</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Our support team can walk you through anything on this page. Reach
            them through the{" "}
            <Link href="/support" className="text-foreground hover:underline">
              Help Center
            </Link>{" "}
            or email{" "}
            <a
              href="mailto:legal@stayora.com"
              className="text-foreground hover:underline"
            >
              legal@stayora.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
