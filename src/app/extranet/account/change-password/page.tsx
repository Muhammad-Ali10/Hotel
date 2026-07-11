import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PasswordForm } from "./_components/password-form"

export default function ChangePasswordPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Change Password" subtitle="Update your account password">
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/account" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card className="max-w-lg">
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
