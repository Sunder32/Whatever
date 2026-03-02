-- Migration 005: Database optimizations and schema fixes
-- Fixes column mismatches between Go code and DB schema,
-- adds missing indexes for query performance, removes unused indexes.

-- ============================================================
-- 1. Fix schema_versions: add missing columns used by Go code
-- ============================================================

-- Go code uses 'commit_message' but migration 001 created 'comment'
-- Rename to match the Go repository code (idempotent: skip if already renamed)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'schema_versions' AND column_name = 'comment'
    ) THEN
        ALTER TABLE schema_versions RENAME COLUMN comment TO commit_message;
    END IF;
END $$;

-- Add missing columns that Go code (CreateVersion, GetVersion) expects
ALTER TABLE schema_versions ADD COLUMN IF NOT EXISTS diff JSONB DEFAULT '{}';
ALTER TABLE schema_versions ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE schema_versions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================================
-- 2. Fix audit_logs: add missing device_info column
-- ============================================================

-- Go sync_repository.CreateAuditLog inserts device_info but column is missing
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- ============================================================
-- 3. Add missing indexes on user_followers and project_stars
-- ============================================================

-- GetFollowers, GetFollowersCount query: WHERE following_id = $1
-- PK is (follower_id, following_id) — can't use it for following_id lookups
CREATE INDEX IF NOT EXISTS idx_user_followers_following_id 
    ON user_followers(following_id);

-- Counting stars per project: WHERE project_id = $1
-- PK is (user_id, project_id) — can't use it for project_id lookups
CREATE INDEX IF NOT EXISTS idx_project_stars_project_id 
    ON project_stars(project_id);

-- ============================================================
-- 4. Add composite indexes for common query patterns
-- ============================================================

-- ListByProject: WHERE project_id = $1 ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_schemas_project_updated 
    ON schemas(project_id, updated_at DESC);

-- ListByOwner: WHERE owner_id = $1 ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated 
    ON projects(owner_id, updated_at DESC);

-- ListVersions: WHERE schema_id = $1 ORDER BY version_number DESC
-- (UNIQUE constraint on (schema_id, version_number) exists but ASC order)
CREATE INDEX IF NOT EXISTS idx_schema_versions_schema_version_desc 
    ON schema_versions(schema_id, version_number DESC);

-- ============================================================
-- 5. Add B-tree index on users.name for exact match lookups
-- ============================================================

-- GetByUsername does: WHERE name = $1 AND deleted_at IS NULL
-- Only trgm GIN index exists — inefficient for exact matches
CREATE INDEX IF NOT EXISTS idx_users_name 
    ON users(name) WHERE deleted_at IS NULL;

-- ============================================================
-- 6. Drop expensive unused index
-- ============================================================

-- schemas.content GIN index: no repository query uses JSONB path operations
-- on content. Content is always read/written as a whole blob.
-- This index adds significant write overhead on every schema save.
DROP INDEX IF EXISTS idx_schemas_content;

-- ============================================================
-- 7. Add partial index for active sessions cleanup
-- ============================================================

-- Active non-revoked sessions that haven't expired
CREATE INDEX IF NOT EXISTS idx_sessions_active 
    ON sessions(user_id, expires_at) 
    WHERE revoked = FALSE;

-- ============================================================
-- 8. Add index for sync_queue retry processing
-- ============================================================

-- Failed items that can be retried
CREATE INDEX IF NOT EXISTS idx_sync_queue_retryable 
    ON sync_queue(status, retry_count, max_retries) 
    WHERE status = 'failed';
