DROP INDEX "idx_seat_maps_performance_id";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_seat_maps_performance_id" ON "seat_maps" USING btree ("performance_id");