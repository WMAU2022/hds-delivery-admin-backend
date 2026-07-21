-- Add location and cutoff_time columns to regions table if they don't exist
ALTER TABLE regions
ADD COLUMN IF NOT EXISTS location VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS cutoff_time VARCHAR(10) DEFAULT '23:00';

-- Create index on enabled for faster queries
CREATE INDEX IF NOT EXISTS idx_regions_enabled ON regions(enabled);

COMMENT ON COLUMN regions.location IS 'Delivery location identifier (e.g., WOM, IKU)';
COMMENT ON COLUMN regions.cutoff_time IS 'Order cutoff time in HH:MM format (AEST)';
