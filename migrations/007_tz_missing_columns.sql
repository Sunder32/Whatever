-- Migration 007: Add missing columns/constraints required by ТЗ and Go models
-- Aligns database schema with тз.md specification

-- ============================================================
-- 1. users: add username, is_active, metadata
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
-- Backfill username from email prefix for existing rows
UPDATE users SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_settings_gin ON users USING gin(settings jsonb_path_ops);

-- ============================================================
-- 2. collaborators: add role column (ТЗ: owner/editor/viewer)
-- ============================================================
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'editor';
-- Backfill role from permission for existing rows
UPDATE collaborators SET role = CASE
    WHEN permission = 'admin' THEN 'owner'
    WHEN permission = 'write' THEN 'editor'
    WHEN permission = 'read' THEN 'viewer'
    ELSE 'viewer'
END WHERE role = 'editor' OR role IS NULL;

CREATE INDEX IF NOT EXISTS idx_collaborators_role ON collaborators(role);

-- Also add permissions JSONB column if missing (ТЗ requires detailed permissions)
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- ============================================================
-- 3. realtime_sessions: add connection_id, selected_elements, status, connected_at, last_heartbeat, metadata
-- ============================================================
ALTER TABLE realtime_sessions ADD COLUMN IF NOT EXISTS connection_id VARCHAR(255);
ALTER TABLE realtime_sessions ADD COLUMN IF NOT EXISTS selected_elements JSONB DEFAULT '[]';
ALTER TABLE realtime_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE realtime_sessions ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE realtime_sessions ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE realtime_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_realtime_sessions_connection_id ON realtime_sessions(connection_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_last_heartbeat ON realtime_sessions(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_status ON realtime_sessions(status);

-- ============================================================
-- 4. schema_locks: add element_id, locked_by, locked_at; rebuild unique constraint
-- ============================================================
ALTER TABLE schema_locks ADD COLUMN IF NOT EXISTS element_id VARCHAR(255);
ALTER TABLE schema_locks ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE schema_locks ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE schema_locks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Backfill locked_by from user_id
UPDATE schema_locks SET locked_by = user_id WHERE locked_by IS NULL;

-- Drop old UNIQUE on just schema_id (was whole-schema lock)
ALTER TABLE schema_locks DROP CONSTRAINT IF EXISTS schema_locks_schema_id_key;
-- Create element-level unique constraint (ТЗ: UNIQUE(schema_id, element_id))
CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_locks_schema_element
    ON schema_locks(schema_id, element_id) WHERE element_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schema_locks_locked_by ON schema_locks(locked_by);

-- ============================================================
-- 5. assets: add data (BYTEA), storage_url, storage_type, content_hash
-- ============================================================
ALTER TABLE assets ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage_url TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'filesystem';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Rename name→file_name if it doesn't exist (ТЗ uses file_name)
-- Column already exists as 'name' in migration 001 — add alias column
ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
UPDATE assets SET file_name = name WHERE file_name IS NULL;

-- Deduplication index (ТЗ requires unique content_hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_content_hash
    ON assets(content_hash) WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assets_storage_type ON assets(storage_type);

-- ============================================================
-- 6. projects: unique (owner_id, name) where not deleted
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_name_unique
    ON projects(owner_id, LOWER(name)) WHERE deleted_at IS NULL;

-- ============================================================
-- 7. Add missing 'tags' and 'thumbnail' to projects if missing
-- ============================================================
-- tags and thumbnail already exist in migration 001, just verifying
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumbnail TEXT;
