"use client"

import { Heart } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { useFavorites, useSession, useToggleFavorite } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"

/**
 * The only way a property gets into Favorites (rule #96).
 *
 * It used to write to a zustand store, which meant a saved list lived in one
 * browser tab: sign in on a phone and it was empty, clear site data and it was
 * gone. It now writes to the account.
 *
 * Idempotent on the server, so a double tap is one row — the button does not
 * have to guard against its own second click.
 */
export function FavoriteButton({
  propertyId,
  propertyName,
  className,
  variant = "secondary",
}: {
  propertyId: string
  propertyName: string
  className?: string
  variant?: "secondary" | "outline" | "ghost"
}) {
  const { data: session } = useSession()
  /* Only once there is somebody whose list it could be on. */
  const { data } = useFavorites(Boolean(session))
  const toggle = useToggleFavorite()

  const saved = (data?.items ?? []).some((item) => item.id === propertyId)

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-pressed={saved}
      aria-label={
        saved ? `Remove ${propertyName} from favourites` : `Save ${propertyName} to favourites`
      }
      disabled={toggle.isPending}
      onClick={(e) => {
        // The heart usually sits inside a link to the property.
        e.preventDefault()
        e.stopPropagation()

        /*
         * A visitor is told what to do rather than silently ignored.
         *
         * Saving to nowhere would be the worst outcome: the heart fills, they
         * believe it, and the list is empty when they sign in.
         */
        if (!session) {
          toast.info("Sign in to save this", {
            description: "Your saved hotels follow your account.",
          })
          return
        }

        toggle.mutate(
          { propertyId, saved },
          {
            onSuccess: () =>
              toast.success(saved ? "Removed from favourites" : "Saved to favourites"),
            onError: (error) => toast.error(error.message),
          }
        )
      }}
      className={cn("size-9 rounded-full shadow-sm backdrop-blur", className)}
    >
      <Heart className={cn("size-4 transition-colors", saved && "fill-rose-500 text-rose-500")} />
    </Button>
  )
}
