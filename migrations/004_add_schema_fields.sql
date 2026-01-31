-- Add missing fields to schemas table

ALTER TABLE schemas ADD COLUMN IF NOT EXISTS thumbnail BYTEA;
ALTER TABLE schemas ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE schemas ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE schemas ADD COLUMN IF NOT EXISTS encryption_method VARCHAR(50);
