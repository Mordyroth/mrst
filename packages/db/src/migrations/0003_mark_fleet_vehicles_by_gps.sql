-- Mark vehicles as fleet vehicles if they have GPS tracking from Spireon
-- Fleet vehicles have GPS devices, reservation-only vehicles do not

-- Mark vehicles that have matching VINs in spireon_devices as fleet vehicles
UPDATE hq_vehicles
SET is_fleet_vehicle = true
WHERE is_fleet_vehicle = false
  AND deleted_at IS NULL
  AND vin IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM spireon_devices sd
    WHERE UPPER(sd.vehicle_vin) = UPPER(hq_vehicles.vin)
      AND sd.deleted_at IS NULL
      AND sd.name NOT ILIKE '%inactive%'
  );

-- Also mark vehicles with unit numbers (fleet vehicles have internal fleet numbers)
UPDATE hq_vehicles
SET is_fleet_vehicle = true
WHERE is_fleet_vehicle = false
  AND deleted_at IS NULL
  AND unit_number IS NOT NULL
  AND unit_number != '';

-- Show results
DO $$
DECLARE
  fleet_count integer;
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO fleet_count FROM hq_vehicles WHERE is_fleet_vehicle = true AND deleted_at IS NULL;
  SELECT COUNT(*) INTO total_count FROM hq_vehicles WHERE deleted_at IS NULL;
  RAISE NOTICE 'Marked % vehicles as fleet vehicles (out of % total)', fleet_count, total_count;
END $$;
