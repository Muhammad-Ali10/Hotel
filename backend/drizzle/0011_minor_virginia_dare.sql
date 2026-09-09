CREATE TABLE "partner_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"partner_org_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_account_ref" varchar(128) NOT NULL,
	"holder_name" varchar(160) DEFAULT '' NOT NULL,
	"last4" varchar(4) DEFAULT '' NOT NULL,
	"bank_name" varchar(120) DEFAULT '' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(32) DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_payout_accounts_org_unique" UNIQUE("partner_org_id"),
	CONSTRAINT "partner_payout_accounts_status_check" CHECK ("partner_payout_accounts"."status" IN ('unverified', 'verified', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "payout_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"payout_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"gross_amount" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_items_booking_unique" UNIQUE("booking_id"),
	CONSTRAINT "payout_items_net_check" CHECK ("payout_items"."net_amount" = "payout_items"."gross_amount" - "payout_items"."commission_amount"),
	CONSTRAINT "payout_items_gross_check" CHECK ("payout_items"."gross_amount" >= 0 AND "payout_items"."commission_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"partner_org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_amount" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"carry_in" integer DEFAULT 0 NOT NULL,
	"net_amount" integer NOT NULL,
	"direction" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"provider" varchar(32) DEFAULT '' NOT NULL,
	"provider_ref" varchar(128),
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_org_period_unique" UNIQUE("partner_org_id","period_start"),
	CONSTRAINT "payouts_direction_check" CHECK ("payouts"."direction" IN ('payout', 'invoice', 'carry')),
	CONSTRAINT "payouts_status_check" CHECK ("payouts"."status" IN ('pending', 'processing', 'paid', 'failed')),
	CONSTRAINT "payouts_period_check" CHECK ("payouts"."period_end" >= "payouts"."period_start"),
	CONSTRAINT "payouts_gross_check" CHECK ("payouts"."gross_amount" >= 0 AND "payouts"."commission_amount" >= 0),
	CONSTRAINT "payouts_net_check" CHECK ("payouts"."net_amount" = "payouts"."gross_amount" - "payouts"."commission_amount" + "payouts"."carry_in"),
	CONSTRAINT "payouts_direction_sign_check" CHECK (("payouts"."direction" = 'invoice' AND "payouts"."net_amount" < 0)
          OR ("payouts"."direction" <> 'invoice' AND "payouts"."net_amount" >= 0)),
	CONSTRAINT "payouts_paid_consistency" CHECK (("payouts"."status" = 'paid' AND "payouts"."paid_at" IS NOT NULL)
          OR ("payouts"."status" <> 'paid' AND "payouts"."paid_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "partner_payout_accounts" ADD CONSTRAINT "partner_payout_accounts_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payout_items_payout_idx" ON "payout_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status","period_start");