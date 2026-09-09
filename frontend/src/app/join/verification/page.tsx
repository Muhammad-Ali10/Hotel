"use client"

import * as React from "react"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import type { RegistrationDocumentView } from "@stayora/shared"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useRemoveRegistrationFile,
  useUploadRegistrationFile,
} from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

/* ============================================================================
 * Step 29 — partner verification.
 *
 * This screen said "to comply with legal and regulatory requirements" and then
 * threw away everything it collected. The business entity block was five
 * uncontrolled inputs. The beneficial-owner block — full names and dates of
 * birth of everyone owning 25% or more — was controlled, validated, refused to
 * continue without it, and written to local state that died on navigation. So
 * did the "also known as" field.
 *
 * Asking for named individuals' dates of birth under a compliance heading and
 * then discarding them is worse than not asking: it is personal data collected
 * for a stated purpose that was never served, and a partner who supplied it
 * believes they are verified.
 *
 * What verification actually is here: documents. The registration has carried
 * `identity`, `ownership`, `business` and `tax` document kinds all along, with
 * a checked upload path and a reviewer's queue in the admin panel — and not one
 * screen in thirty-one ever uploaded one. That is this screen now.
 * ========================================================================== */

type Kind = Exclude<RegistrationDocumentView["kind"], "photo">

const KINDS: { value: Kind; label: string; hint: string }[] = [
  {
    value: "identity",
    label: "Proof of identity",
    hint: "Passport or national ID of the person signing the agreement",
  },
  {
    value: "ownership",
    label: "Proof of ownership or the right to let",
    hint: "Title deed, lease, or a management agreement",
  },
  {
    value: "business",
    label: "Business registration",
    hint: "Trade licence or certificate of incorporation, if you list as a company",
  },
  {
    value: "tax",
    label: "Tax registration",
    hint: "VAT or tax number certificate, where your country requires one",
  },
]

const OWNER_TYPES = [
  { value: "individual", label: "I'm an individual running a business" },
  { value: "business", label: "I represent a business entity" },
]

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf"

const STATUS_LABEL: Record<RegistrationDocumentView["status"], string> = {
  pending: "Waiting for review",
  approved: "Accepted",
  rejected: "Not accepted",
}

export default function VerificationPage() {
  const { data, documents, save } = useWizard()
  const [ownerType, setOwnerType] = React.useState<"individual" | "business">(
    data.ownerType
  )
  const [uploading, setUploading] = React.useState<Kind | null>(null)

  const upload = useUploadRegistrationFile()
  const remove = useRemoveRegistrationFile()
  const inputs = React.useRef<Partial<Record<Kind, HTMLInputElement | null>>>({})

  async function onPick(kind: Kind, event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    setUploading(kind)
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, kind })
      } catch (error) {
        toast.error(`Couldn't upload ${file.name}`, {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    }
    setUploading(null)
  }

  return (
    <WizardShell>
      <StepHeading
        title="Partner verification"
        description="The platform checks who it is contracting with and who has the right to let the property. Everything here goes to a reviewer, not onto your listing."
      />

      <div className="space-y-2">
        <Label>
          Is the accommodation owned by an individual or business entity?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Select
          items={OWNER_TYPES}
          value={ownerType}
          onValueChange={(v) => setOwnerType(v as "individual" | "business")}
        >
          <SelectTrigger className="w-full" size="default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OWNER_TYPES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-sm font-semibold">Documents</p>
        {KINDS.map((kind) => {
          const files = documents.filter((doc) => doc.kind === kind.value)
          const busy = uploading === kind.value

          return (
            <div key={kind.value} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{kind.label}</p>
                  <p className="text-muted-foreground text-xs">{kind.hint}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputs.current[kind.value]?.click()}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload
                </Button>
              </div>

              <input
                ref={(el) => {
                  inputs.current[kind.value] = el
                }}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => onPick(kind.value, e)}
              />

              {files.length > 0 && (
                <ul className="mt-3 divide-y border-t">
                  {files.map((file) => (
                    <li key={file.id} className="flex items-center gap-3 py-2">
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{file.fileName}</p>
                        <p className="text-muted-foreground text-xs">
                          {STATUS_LABEL[file.status]}
                          {file.reviewNote ? ` — ${file.reviewNote}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove.mutate(file.id)}
                        disabled={remove.isPending}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${file.fileName}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        {/* Honest about what is enforced: none of these is a submission gap, so
            the wizard does not pretend one is mandatory when it is not. */}
        None of these blocks you from applying. Sending them now means the
        platform can decide without coming back to ask — an application with no
        proof of ownership usually does.
      </p>

      <StepNav
        slug="verification"
        nextDisabled={uploading !== null}
        onContinue={() => save({ ownerType })}
      />
    </WizardShell>
  )
}
