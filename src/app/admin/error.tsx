"use client"

import { ErrorState } from "@/components/shared/states"

/**
 * Catches render-time failures anywhere under `/admin`. Data-fetch errors are
 * handled inline by each screen so the chrome stays usable.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      variant="page"
      title="This screen failed to load"
      description={
        error.message ||
        "An unexpected error occurred while rendering the admin panel."
      }
      onRetry={reset}
    />
  )
}
