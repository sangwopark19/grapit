CREATE TYPE "public"."seat_status" AS ENUM('available', 'locked', 'sold');--> statement-breakpoint
CREATE TABLE "seat_inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showtime_id" uuid NOT NULL,
	"seat_id" varchar(20) NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"locked_by" uuid,
	"locked_until" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seat_inventories" ADD CONSTRAINT "seat_inventories_showtime_id_showtimes_id_fk" FOREIGN KEY ("showtime_id") REFERENCES "public"."showtimes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_seat_inv_showtime_seat" ON "seat_inventories" USING btree ("showtime_id","seat_id");