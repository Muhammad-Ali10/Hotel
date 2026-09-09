import Link from "next/link"
import { Globe, Hotel, Mail, MessageCircle, Share2 } from "lucide-react"

import { siteConfig } from "@/config/site"

const socialIcons = [Globe, MessageCircle, Share2, Mail]

export function SiteFooter() {
  return (
    <footer className="bg-muted/40 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                <Hotel className="size-5" />
              </span>
              <span className="font-heading text-lg font-semibold">
                {siteConfig.name}
              </span>
            </Link>
            <p className="text-muted-foreground mt-3 max-w-xs text-sm">
              {siteConfig.description}
            </p>
            <div className="mt-4 flex gap-2">
              {socialIcons.map((Icon, i) => (
                <Link
                  key={i}
                  href="#"
                  aria-label={siteConfig.socials[i]?.title}
                  className="hover:bg-muted flex size-9 items-center justify-center rounded-full border transition-colors"
                >
                  <Icon className="size-4" />
                </Link>
              ))}
            </div>
          </div>

          {siteConfig.footerNav.map((group) => (
            <div key={group.title}>
              <h4 className="font-heading text-sm font-semibold">{group.title}</h4>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.title}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            © 2026 {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex gap-4">
            {siteConfig.legal.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {link.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
