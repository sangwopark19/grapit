CREATE TYPE "public"."payment_status" AS ENUM('READY', 'DONE', 'CANCELED', 'ABORTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"payment_key" varchar(200) NOT NULL,
	"toss_order_id" varchar(200) NOT NULL,
	"method" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_status" DEFAULT 'READY' NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reservation_id_unique" UNIQUE("reservation_id"),
	CONSTRAINT "payments_payment_key_unique" UNIQUE("payment_key")
);
--> statement-breakpoint
CREATE TABLE "reservation_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"seat_id" varchar(50) NOT NULL,
	"tier_name" varchar(50) NOT NULL,
	"price" integer NOT NULL,
	"row" varchar(10) NOT NULL,
	"number" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"showtime_id" uuid NOT NULL,
	"reservation_number" varchar(30) NOT NULL,
	"toss_order_id" varchar(200),
	"status" "reservation_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"total_amount" integer NOT NULL,
	"cancel_deadline" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_reservation_number_unique" UNIQUE("reservation_number"),
	CONSTRAINT "reservations_toss_order_id_unique" UNIQUE("toss_order_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_seats" ADD CONSTRAINT "reservation_seats_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_showtime_id_showtimes_id_fk" FOREIGN KEY ("showtime_id") REFERENCES "public"."showtimes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reservations_user_id" ON "reservations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reservations_showtime_id" ON "reservations" USING btree ("showtime_id");--> statement-breakpoint
CREATE INDEX "idx_reservations_status" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reservations_reservation_number" ON "reservations" USING btree ("reservation_number");--> statement-breakpoint
CREATE INDEX "idx_reservations_toss_order_id" ON "reservations" USING btree ("toss_order_id");