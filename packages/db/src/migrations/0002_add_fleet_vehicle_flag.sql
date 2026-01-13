-- Add is_fleet_vehicle field to hq_vehicles table
-- This distinguishes vehicles from /fleets/vehicles API (actual fleet, ~88 vehicles)
-- from vehicles that only appear in reservation data (not part of active fleet)

ALTER TABLE "hq_vehicles" ADD COLUMN "is_fleet_vehicle" boolean DEFAULT false NOT NULL;

-- Create index for efficient filtering
CREATE INDEX "hq_vehicles_is_fleet_vehicle_idx" ON "hq_vehicles" ("is_fleet_vehicle");

-- Comment for clarity
COMMENT ON COLUMN "hq_vehicles"."is_fleet_vehicle" IS 'True if vehicle was synced from /fleets/vehicles endpoint (actual active fleet). False if only seen in reservation data.';
