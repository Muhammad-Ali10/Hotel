import Link from "next/link"

import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"

export const accountNav = [
  { title: "Contacts", desc: "Who answers for what", icon: "Users", href: "/extranet/account/contacts" },
  { title: "Devices", desc: "Signed-in sessions", icon: "Smartphone", href: "/extranet/account/devices" },
  { title: "Contracts", desc: "What you have agreed to", icon: "FileText", href: "/extranet/account/contracts" },
  { title: "Connectivity", desc: "Channel managers", icon: "Globe", href: "/extranet/account/connectivity" },
  { title: "Compliance", desc: "How we handle your data", icon: "BadgeCheck", href: "/extranet/account/compliance" },
  { title: "Change Password", desc: "Update your password", icon: "Settings", href: "/extranet/account/change-password" },
]

export function AccountNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accountNav.map((s) => (
        <Link key={s.title} href={s.href}>
          <Card size="sm" className="hover:bg-muted/40 h-full transition-colors">
            <CardContent className="flex items-center gap-3">
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon name={s.icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground truncate text-xs">{s.desc}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
