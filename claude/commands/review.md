# Full Product Review — Claude Code Prompt

> Isko apne project ke root mein save karein (ya `.claude/commands/review.md` mein daal dein
> taake `/review` slash command ban jaye), phir Claude Code mein paste karein.

---

## THE PROMPT (copy from here ↓)

```
You are acting as BOTH a senior Product Manager and a Staff-level Full-Stack Engineer
doing a pre-launch production readiness review of this codebase.

## PRODUCT CONTEXT
This is a Bookme-style multi-vendor online booking/ticketing platform
(bus / flights / hotels / events). Stack: Next.js (App Router) + TypeScript.

Three surfaces exist and are "complete":
1. Public pages — search, listings, detail, booking flow, checkout, ticket
2. Customer/Vendor Extranet dashboard — operators manage inventory, bookings, payouts
3. Admin dashboard — internal super-admin panel

Money moves through this product and inventory is finite and perishable.
That means correctness bugs = real financial loss. Review accordingly.

## GROUND RULES — read carefully
- DO NOT write any fixes yet. This pass is READ-ONLY. Audit first, fix after I approve.
- Every finding MUST cite `path/to/file.ts:line`. No claim without evidence from the code.
- If you are unsure whether something is a bug, say "NEEDS VERIFICATION" and tell me
  exactly what to check — do NOT pad the report with speculation.
- Do not report style/formatting nitpicks. Only things that break, leak, lose money,
  confuse users, or will not scale.
- Work in phases. STOP after each phase and show me the output before continuing.

---

# PHASE 0 — Recon & Map (do this first)

Build a mental model before judging anything.

1. Read: package.json, next.config, tsconfig, middleware.ts, prisma/schema (or equivalent
   DB schema), .env.example, and the folder structure of app/ and components/.
2. Produce a **Route Map** table:
   | Route | Surface (public/extranet/admin) | Rendering (RSC/client/SSG/ISR) | Auth required | Role(s) | Data source |
3. Produce a **Data Layer Map**: where do API calls live? (server actions / route handlers /
   fetch in components / a services layer?) Is it consistent, or are there 3 different
   patterns doing the same thing?
4. Produce a **Domain Model**: core entities (User, Vendor, Trip/Inventory, Seat, Booking,
   Payment, Refund, Ticket) and how they relate. Flag any entity that has ambiguous ownership.
5. List anything you could NOT find that a product like this must have
   (e.g. no idempotency keys anywhere, no audit log, no seat-lock table, no webhook handler).

STOP. Show me Phase 0 output.

---

# PHASE 1 — Data Flow Audit (screen by screen)

For EVERY screen in all three surfaces, trace the full path:
DB → query/service → server component → serialization → client component → state → UI render
→ user action → mutation → cache invalidation → re-render.

For each screen report ONLY where it is broken. Specifically hunt for:

**Fetching**
- Data fetched in the wrong layer (client-side fetch where RSC would do, or vice versa)
- Waterfall requests that should be parallel (`await` chains that don't depend on each other)
- Same data fetched 2+ times on one page (duplicate/overlapping queries)
- N+1 queries in list screens (a query inside a `.map()`)
- Missing pagination — any query that can return unbounded rows

**State & freshness**
- Mutation happens but the list/table does NOT refresh
  (missing `revalidatePath` / `revalidateTag` / `router.refresh()` / query invalidation)
- `cache: 'force-cache'` or default caching on data that must be live
  (seat availability, prices, booking status) — THIS IS CRITICAL for a booking product
- Stale closure bugs in useEffect / event handlers
- Derived state stored in useState instead of computed (goes out of sync)
- Two sources of truth for the same value (URL params vs local state vs server state)
- Optimistic UI with no rollback on failure

**Boundaries**
- Server-only code (DB client, secrets, node APIs) imported into a client component
- Non-serializable values passed from server → client component
- `'use client'` placed too high in the tree, dragging the whole subtree client-side
- Missing Suspense boundaries → whole page blocks on the slowest query

**States**
- For each screen, does it handle: loading, empty, error, partial-failure, no-permission,
  offline/slow-network? List every screen missing any of these.

Output format:
| # | Screen/Route | File:line | Issue | Why it breaks | Severity |

STOP. Show me Phase 1 output.

---

# PHASE 2 — Booking Flow Correctness (the money path)

This is the highest-value phase. Trace the complete transaction:
search → select trip → select seat/room → hold/lock → passenger details → apply
coupon/wallet → payment initiate → gateway callback/webhook → booking confirm →
ticket issue → email/SMS → cancel → refund → payout to vendor.

Answer each of these explicitly with code evidence:

1. **Double booking**: Can two users buy the same seat? Is there a DB-level unique
   constraint or a transaction with row lock (`SELECT ... FOR UPDATE` / serializable),
   or is it only checked in application code (race condition)?
2. **Seat hold / TTL**: Is inventory held while the user pays? What releases it if they
   abandon? Is there a cron/queue, or do holds leak forever?
3. **Idempotency**: If the payment webhook fires twice (gateway retries — they always do),
   is the booking created twice / refund issued twice? Where is the idempotency key?
4. **Atomicity**: Is `create booking + decrement inventory + record payment` inside ONE
   transaction? If it fails midway, what is left in the DB?
5. **Trusting the client**: Is the final amount recalculated on the SERVER, or is the price
   taken from the request body? Can I change the price in devtools and pay Rs. 1?
   Same question for coupon discount, wallet balance, seat count, and vendor commission.
6. **Money math**: Are amounts stored as integers (paisa) or floats? Any place where
   rounding could drop or invent money? Is currency stored explicitly?
7. **Webhook security**: Is the gateway callback signature verified? Is the endpoint
   authenticated? Can I POST a fake "payment success"?
8. **State machine**: List every booking status and legal transition. Find any code path
   that can jump illegally (e.g. cancelled → confirmed, or refunded twice).
9. **Failure paths**: Payment succeeds but ticket issuance fails — what happens? Payment
   times out — what does the user see? Gateway returns success after our timeout — is it
   reconciled?
10. **Cancellation & refund**: Is the refund policy enforced server-side (time windows,
    partial refund, non-refundable fares)? Is inventory returned to the pool?
11. **Timezones**: Departure times — stored UTC or local? Is the user shown the operator's
    local time? Any `new Date()` on the client used for business logic?
12. **Vendor payout**: Commission calculated where? Can a vendor see or affect another
    vendor's data?

For each: state VERIFIED-OK / BUG / NEEDS VERIFICATION with file:line.

STOP. Show me Phase 2 output.

---

# PHASE 3 — Security & Authorization

1. **Authorization is server-side?** For every mutation (server action / route handler),
   confirm the role+ownership check happens on the server. Middleware alone is NOT enough.
   List every endpoint with no server-side check.
2. **IDOR**: Can customer A fetch booking B by changing the ID in the URL? Can vendor X
   read vendor Y's bookings? Test every `params.id` usage — is it scoped by owner?
3. **Role separation**: Public / customer / vendor extranet / admin roles — is there any
   route or API where an extranet user can hit an admin endpoint?
4. **Input validation**: Is every server action / route handler input parsed with zod (or
   equivalent) before use? List unvalidated ones.
5. **Secrets**: Any secret in `NEXT_PUBLIC_*`? Any key hardcoded? Any secret reachable in
   the client bundle? Grep for it.
6. **Injection**: Raw SQL string interpolation, unsanitized `dangerouslySetInnerHTML`,
   unvalidated redirect URLs, file upload without type/size checks.
7. **Rate limiting / abuse**: Login, OTP, coupon apply, search, booking create — any of
   these unthrottled? Can someone brute-force a booking reference or PNR?
8. **PII**: Are CNIC / passport / phone / card data logged anywhere? Console.log in
   production paths? Sent to a third party?
9. **Session**: Cookie flags (httpOnly, secure, sameSite), token expiry, logout actually
   invalidating, session fixation.

STOP. Show me Phase 3 output.

---

# PHASE 4 — Performance, Errors & Build Health

Run these and report actual output (don't guess):
- `npx tsc --noEmit`          → every type error, grouped
- `npm run lint`              → real problems only
- `npm run build`             → build errors + warnings + route-by-route bundle sizes
- Check for `@ts-ignore`, `as any`, `// eslint-disable` — list each with why it's there

Then statically identify:
- Routes with First Load JS > 200 kB and what's bloating them
- Heavy libs imported at top level that should be dynamic (`next/dynamic`)
- `<img>` instead of `next/image`; unoptimized/oversized assets
- Missing `error.tsx` / `not-found.tsx` / `loading.tsx` per route segment
- Any promise/await without error handling; any `catch` that swallows silently
- Hydration mismatch risks (`Date.now()`, `Math.random()`, `window` during render,
  locale-dependent formatting in RSC)
- Missing DB indexes on columns used in WHERE/ORDER BY of hot queries
- Dead code / unused routes / unreferenced components
- Accessibility blockers: unlabeled inputs, modals without focus trap, non-keyboard-
  reachable actions, contrast failures in the booking flow

STOP. Show me Phase 4 output.

---

# PHASE 5 — Final Report

Produce `REVIEW_REPORT.md` in the repo root:

1. **Executive summary** — 5 bullets. Is this shippable? What is the single biggest risk?
2. **Severity table**, sorted:
   - **P0 (Ship blocker)** — loses money, corrupts data, leaks data, or breaks the
     booking flow
   - **P1 (Fix before launch)** — broken behaviour on a real user path
   - **P2 (Fix soon)** — degraded UX, perf, missing states
   - **P3 (Tech debt)** — inconsistencies, refactors
   Columns: `# | Severity | Area | File:line | Issue | Impact | Fix (1 line) | Effort`
3. **Repro steps** for every P0 and P1 — exact clicks/requests so QA can confirm.
4. **What's actually solid** — be honest, list what's well built. I need signal, not
   only noise.
5. **Product gaps (PM hat)** — what a Bookme-class product has that this doesn't yet:
   audit trail, reconciliation report, dispute/complaint flow, vendor SLA metrics,
   analytics events, notification retry, admin impersonation with logging, feature flags,
   soft-delete + restore, bulk ops, export.
6. **Suggested fix order** — a numbered plan grouped so related fixes land together.

Then STOP and wait. Do not start fixing until I pick which items to fix.
```

## (copy ends ↑)

---

## Follow-up prompts (Phase 5 ke baad use karein)

**Fixing:**
```
Fix P0 items #1, #2, #4 from REVIEW_REPORT.md. One item per commit.
For each: show the diff, explain the root cause in 2 lines, and add a test that fails
before the fix and passes after. Do not touch anything unrelated. Do not refactor.
```

**Verification:**
```
Write integration tests for the booking flow that specifically cover:
concurrent seat purchase, duplicate payment webhook, payment-succeeded-but-ticket-failed,
cancel after departure, and coupon amount tampering. Use the existing test setup.
```

---

## Big product ko review kaise kiya jata hai — the actual method

1. **Map before you judge.** Pehle poora system ka naqsha banao (routes, data layer, domain
   model). Bina map ke review = random bug hunting.
2. **Follow the money and the state.** Har product mein 1–2 flows hote hain jahan galti
   sab se mehngi hai. Yahan booking + payment. 80% effort wahan lagao.
3. **Trace one thing end-to-end, not everything shallowly.** Ek complete booking ko DB se
   UI tak aur wapas trace karna 50 files skim karne se zyada bugs deta hai.
4. **Attack it, don't admire it.** "Kya ye kaam karta hai?" ke bajaye poocho: "Main isay
   kaise torun?" — do users ek waqt par, network fail beech mein, webhook do baar, price
   devtools se badla hua.
5. **Trust boundaries.** Har jagah jahan client server se baat karta hai, ya vendor A ka
   data vendor B ke qareeb aata hai — wahan check lagao. Baaqi jagah waqt zaya na karo.
6. **Severity honestly.** Sab kuch "critical" likhna = kuch bhi critical nahi. P0 sirf wo
   jo paisa/data khota hai ya launch rokta hai.
7. **Evidence or it didn't happen.** Har finding ke saath file:line aur repro steps.
   Warna team bharosa nahi karegi aur report shelf par chali jayegi.
8. **Say what's good too.** Warna review defensive ban jata hai aur log next time nahi
   karwate.
