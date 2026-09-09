ALTER TABLE "bookings" DROP CONSTRAINT "bookings_payment_method_check";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_payment_status_check";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "payment_method";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "payment_status";