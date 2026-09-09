ALTER TABLE "photos" ADD COLUMN "storage_key" varchar(512) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "content_type" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "width" smallint;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "height" smallint;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "status" varchar(32) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "pending_changes" jsonb;--> statement-breakpoint
CREATE INDEX "photos_property_status_idx" ON "photos" USING btree ("property_id","status","position");--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_status_check" CHECK ("photos"."status" IN ('pending', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_bytes_check" CHECK ("photos"."bytes" >= 0);--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_storage_consistency" CHECK (("photos"."storage_key" = '') = ("photos"."content_type" = ''));--> statement-breakpoint
/*
 * Photos that already existed were already public.
 *
 * The new column defaults to 'pending', which is right for an upload arriving
 * from now on — and wrong for every row already in the table. Without this the
 * migration would quietly empty the gallery of every listing on the platform,
 * and the cause would look like a rendering bug rather than a data one.
 */
UPDATE "photos" SET "status" = 'approved' WHERE "created_at" < now();
