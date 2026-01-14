-- Add last_at_shop_at column to spireon_devices
ALTER TABLE spireon_devices ADD COLUMN IF NOT EXISTS last_at_shop_at TIMESTAMP WITH TIME ZONE;

-- Update existing devices that are currently at shop
-- Shop location: 40.622877, -73.993128, radius 0.3 miles (~482 meters)
UPDATE spireon_devices
SET last_at_shop_at = current_location_at
WHERE current_lat IS NOT NULL 
  AND current_lng IS NOT NULL
  AND current_location_at IS NOT NULL
  AND (
    -- Haversine formula approximation for ~0.3 miles radius
    6371000 * 2 * ASIN(SQRT(
      POWER(SIN((RADIANS(current_lat) - RADIANS(40.622877)) / 2), 2) +
      COS(RADIANS(40.622877)) * COS(RADIANS(current_lat)) *
      POWER(SIN((RADIANS(current_lng) - RADIANS(-73.993128)) / 2), 2)
    )) <= 482
  );
