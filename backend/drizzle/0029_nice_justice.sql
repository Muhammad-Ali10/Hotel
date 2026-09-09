ALTER TABLE "promotions" DROP CONSTRAINT "promotions_kind_check";--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_kind_check" CHECK ("promotions"."kind" IN (
        'seasonal_deal', 'limited_time', 'member_exclusive', 'group_booking',
        'early_bird', 'last_minute', 'flash', 'long_stay', 'genius'
      ));