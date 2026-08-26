-- Insert NSW Central Coast region
INSERT INTO regions (id, name, hds_zone, enabled, created_at, updated_at) VALUES
(29, 'NSW Central Coast', 'NSW Central Coast', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  hds_zone = EXCLUDED.hds_zone,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- Update all Central Coast postcodes to be assigned to the new region
UPDATE suburbs SET region_id = 29 
WHERE postcode IN ('2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258')
AND region_id = 1; -- Only update those currently assigned to NSW Sydney Metro (id=1)
