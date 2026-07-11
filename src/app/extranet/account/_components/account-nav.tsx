import Link from "next/link"

import { Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"

export const accountNav = [
  { title: "Contacts", desc: "Key property contacts", icon: "Users", href: "/extranet/account/contacts" },
  { title: "My Devices", desc: "Signed-in devices", icon: "Smartphone", href: "/extranet/account/devices" },
  { title: "Connectivity", desc: "Channel manager link", icon: "Globe", href: "/extranet/account/connectivity" },
  { title: "Contracts", desc: "Your agreements", icon: "FileText", href: "/extranet/account/contracts" },
  { title: "Compliance", desc: "Regulatory status", icon: "BadgeCheck", href: "/extranet/account/compliance" },
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
