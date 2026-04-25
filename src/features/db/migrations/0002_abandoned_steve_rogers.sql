CREATE TABLE "sms_quotas" (
	"phone_e164" text PRIMARY KEY NOT NULL,
	"hourly_limit" integer DEFAULT 20 NOT NULL,
	"daily_limit" integer DEFAULT 100 NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
