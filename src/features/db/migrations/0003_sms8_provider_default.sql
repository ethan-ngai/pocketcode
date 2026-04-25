ALTER TABLE "sms_messages" ALTER COLUMN "provider" SET DEFAULT 'sms8';--> statement-breakpoint
UPDATE "sms_messages" SET "provider" = 'sms8' WHERE "provider" = 'twilio';
