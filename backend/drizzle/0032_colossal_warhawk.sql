ALTER TABLE "properties" ADD COLUMN "ranking_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "ranked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "properties_ranking_idx" ON "properties" USING btree ("status","ranking_score");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_ranking_check" CHECK ("properties"."ranking_score" >= 0 AND "properties"."ranking_score" <= 10000);