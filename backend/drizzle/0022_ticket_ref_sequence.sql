/*
 * Ticket references come from a SEQUENCE, never from a random number (rule #8).
 *
 * The prototype generated `TKT-1000`…`TKT-9999` at random with no uniqueness
 * check: nine thousand possible values, and past roughly a hundred tickets a
 * collision is more likely than not. `formatTicketRef()` in the shared package
 * is formatting only and deliberately has no random variant — this is where
 * the number it formats comes from.
 *
 * A sequence rather than `MAX(ref) + 1`: two tickets opened in the same instant
 * would read the same maximum, and one of them would take a reference the other
 * already has.
 */
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START WITH 1 INCREMENT BY 1;
--> statement-breakpoint
/*
 * And the reference is unique, which is the guarantee the sequence exists to
 * provide. A UNIQUE index rather than trust: a sequence can be reset by hand,
 * and a duplicate reference means two guests quoting the same code.
 */
CREATE UNIQUE INDEX IF NOT EXISTS support_threads_ref_unique ON "support_threads" ("ref");
