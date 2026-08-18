"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { UserPlus } from "lucide-react"

import { adminClients } from "@/data/admin"
import { useInviteManager } from "@/lib/admin/api/hooks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ROLES = [
  "Owner",
  "General Manager",
  "Revenue Manager",
  "Front Desk Manager",
  "Staff",
] as const

/** The Figma showed three fields and no validation rules — these are ours. */
const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  role: z.enum(ROLES, { message: "Choose a role." }),
  clientId: z.string().min(1, "Choose which client this manager belongs to."),
})

type FormValues = z.infer<typeof schema>

const ROLE_ITEMS = ROLES.map((role) => ({ label: role, value: role }))
const CLIENT_ITEMS = adminClients.map((client) => ({
  label: client.name,
  value: client.id,
}))

export function InviteManagerDialog() {
  const [open, setOpen] = React.useState(false)
  const invite = useInviteManager()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "General Manager", clientId: "" },
  })

  React.useEffect(() => {
    if (open) form.reset({ email: "", role: "General Manager", clientId: "" })
  }, [open, form])

  function onSubmit(values: FormValues) {
    invite.mutate(values, {
      onSuccess: () => setOpen(false),
      onError: (error) => {
        // Surface duplicate-email conflicts on the field that caused them.
        if (error.code === "duplicate_email") {
          form.setError("email", { message: error.message })
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlus className="size-4" />
            Invite manager
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite manager</DialogTitle>
          <DialogDescription>
            Send an invitation to a new property manager.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="invite-manager-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="off"
                      placeholder="manager@example.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    items={ROLE_ITEMS}
                    value={field.value}
                    onValueChange={(value) => field.onChange(String(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Determines what the manager can do inside the client&rsquo;s
                    extranet.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    items={CLIENT_ITEMS}
                    value={field.value}
                    onValueChange={(value) => field.onChange(String(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CLIENT_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={invite.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-manager-form"
            disabled={invite.isPending}
          >
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
