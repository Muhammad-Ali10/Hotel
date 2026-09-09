CREATE TABLE "platform_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"support_email" varchar(254) DEFAULT '' NOT NULL,
	"default_commission_rate_bps" integer DEFAULT 1500 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_singleton_check" CHECK ("platform_settings"."id" = 1),
	CONSTRAINT "platform_settings_commission_check" CHECK ("platform_settings"."default_commission_rate_bps" >= 0 AND "platform_settings"."default_commission_rate_bps" <= 10000)
);
