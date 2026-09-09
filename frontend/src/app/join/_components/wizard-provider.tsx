"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type {
  RegistrationDocumentView,
  RegistrationDraft,
  RegistrationView,
} from "@stayora/shared"

import { useRegistration, useSaveRegistration, useSession } from "@/lib/api/hooks"

import { fill, emptyDraft, type WizardData } from "../_lib/types"
import { stepFromPathname } from "../_lib/steps"

/* ============================================================================
 * Where a registration actually lives.
 *
 * It used to live in `localStorage`, which meant an application survived a
 * refresh and nothing else: not a different browser, not a phone, not the
 * partner's colleague, and not the platform — nobody could review an
 * application nobody could see. Thirty-one screens of answers were discarded
 * the day the tab was closed on a machine that had been tidied.
 *
 * Now the server holds it. `GET /join/registration` creates the draft on first
 * read, `PATCH` saves one screen, and the response to every save is the whole
 * draft — including `gaps`, so the final screens can list what is missing
 * without re-implementing `submissionGaps` and drifting from it.
 *
 * A save happens on Continue, not on every keystroke. A screen is the unit of
 * work: it either saved and you moved on, or it did not and you are still on
 * it. Debounced autosave would mean a partner who loses connectivity walks
 * forward through four screens believing they are stored.
 * ========================================================================== */

type WizardContextValue = {
  /** The draft, with every field filled — see `fill()`. */
  data: WizardData
  /** The server's own view: status, gaps, documents, commission. */
  view: RegistrationView | undefined
  /**
   * The listing photographs, separated from the verification documents.
   *
   * Both live in `view.documents`, and every summary screen wants the count of
   * one of them — so the split happens once here rather than as a `.filter()`
   * repeated in five places, each free to get the predicate wrong.
   */
  photos: RegistrationDocumentView[]
  documents: RegistrationDocumentView[]
  /** True while the draft is still loading for the first time. */
  loading: boolean
  /** True while a save is in flight. */
  saving: boolean
  /**
   * Save one screen's answers. Resolves `false` if the server refused, and the
   * caller should stay put — `StepNav` does exactly that.
   */
  save: (patch: RegistrationDraft) => Promise<boolean>
}

const WizardContext = React.createContext<WizardContextValue | null>(null)

/**
 * The four screens before there is an account.
 *
 * They are the only ones that render without a session, and the only ones that
 * cannot save — there is no draft to save into until somebody has signed up.
 */
const PRE_ACCOUNT = new Set(["create-account", "contact", "password", "verify"])

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const step = stepFromPathname(pathname ?? "")
  const preAccount = !step || PRE_ACCOUNT.has(step.slug)

  const session = useSession()
  const signedIn = Boolean(session.data)
  /*
   * Fired whenever there IS a session, including on the account screens: a
   * partner who comes back signed in should land back on the step they left,
   * and `/join` cannot offer that without knowing which one it was.
   */
  const registration = useRegistration(signedIn)
  const saveMutation = useSaveRegistration()

  /*
   * A visitor who opens step 9 from a bookmark has no draft to show and no
   * account to load one into. Sending them to the start is the only honest
   * answer — the alternative is thirty empty fields that cannot be saved.
   *
   * Only once the session query has actually answered: `session.data` is
   * `undefined` while it is in flight, and redirecting on that would bounce
   * every signed-in partner out of their own application on first paint.
   */
  React.useEffect(() => {
    if (preAccount || session.isPending || signedIn) return
    router.replace("/join")
  }, [preAccount, session.isPending, signedIn, router])

  const view = registration.data
  const data = React.useMemo(() => fill(view?.data), [view?.data])

  const [photos, documents] = React.useMemo(() => {
    const all = view?.documents ?? []
    return [
      all.filter((doc) => doc.kind === "photo"),
      all.filter((doc) => doc.kind !== "photo"),
    ]
  }, [view?.documents])

  /* Read out here rather than inside the callback, so the dependency is the
     number the save actually sends and not the whole step object. */
  const stepNumber = step?.step ?? undefined

  const save = React.useCallback(
    async (patch: RegistrationDraft) => {
      try {
        await saveMutation.mutateAsync({ step: stepNumber, data: patch })
        return true
      } catch (error) {
        /*
         * Named, because "Something went wrong" on a form with fourteen fields
         * is not something a partner can act on. The API's message says which
         * field it refused and why.
         */
        toast.error("Couldn't save this step", {
          description:
            error instanceof Error ? error.message : "Check your connection and try again.",
        })
        return false
      }
    },
    [saveMutation, stepNumber]
  )

  const value = React.useMemo<WizardContextValue>(
    () => ({
      data: preAccount ? emptyDraft : data,
      view,
      photos,
      documents,
      loading: !preAccount && registration.isPending,
      saving: saveMutation.isPending,
      save,
    }),
    [
      preAccount,
      data,
      view,
      photos,
      documents,
      registration.isPending,
      saveMutation.isPending,
      save,
    ]
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

export function useWizard() {
  const context = React.useContext(WizardContext)
  if (!context) throw new Error("useWizard must be used inside <WizardProvider>")
  return context
}

/**
 * Holds a screen back until the draft has arrived.
 *
 * Not a nicety. Every screen seeds its inputs with `React.useState(data.x)`,
 * which reads the draft ONCE, at mount. Rendering the form before the draft
 * lands would fill it with defaults, and the answers arriving a moment later
 * would change nothing on screen — the partner would retype work they had
 * already done, and Continue would overwrite the saved version with it.
 *
 * The gate sits inside the chrome rather than around it, so the header and the
 * step counter stay put while this resolves.
 */
export function WizardGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { loading, view } = useWizard()

  const step = stepFromPathname(pathname ?? "")
  const terminal = step?.slug === "done"
  const locked = Boolean(view && view.status !== "in_progress")

  /*
   * An application already with the platform is not editable, and the server
   * refuses every save against one. Leaving the form open would let a partner
   * fill in four more screens and be told "no" by each of them; `done` is the
   * screen that tells them where the application actually stands.
   */
  React.useEffect(() => {
    if (locked && !terminal) router.replace("/join/done")
  }, [locked, terminal, router])

  if (loading || (locked && !terminal)) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading your application…
      </div>
    )
  }

  return <>{children}</>
}
