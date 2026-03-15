-- =============================================================================
-- Consolidated schema — merges migrations 001-008 into a single idempotent file.
-- All tables, indexes, triggers, functions and seed templates in one place.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    role VARCHAR(50) DEFAULT 'user',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_settings_gin ON users USING gin(settings jsonb_path_ops);

-- ============================================================
-- projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_archived BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    thumbnail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON projects USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON projects(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_name_unique ON projects(owner_id, LOWER(name)) WHERE deleted_at IS NULL;

-- ============================================================
-- collaborators
-- ============================================================
CREATE TABLE IF NOT EXISTS collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL DEFAULT 'read',
    role VARCHAR(20) DEFAULT 'editor',
    permissions JSONB DEFAULT '{}',
    invited_by UUID REFERENCES users(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_project_id ON collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_permission ON collaborators(permission);
CREATE INDEX IF NOT EXISTS idx_collaborators_role ON collaborators(role);

-- ============================================================
-- schemas
-- ============================================================
CREATE TABLE IF NOT EXISTS schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    format_version VARCHAR(20) DEFAULT '1.0.0',
    canvas_state JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    content_hash VARCHAR(64),
    file_size INTEGER DEFAULT 0,
    is_template BOOLEAN DEFAULT FALSE,
    thumbnail BYTEA,
    thumbnail_url TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_schemas_project_id ON schemas(project_id);
CREATE INDEX IF NOT EXISTS idx_schemas_name_trgm ON schemas USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_schemas_file_name ON schemas(file_name);
CREATE INDEX IF NOT EXISTS idx_schemas_is_template ON schemas(is_template);
CREATE INDEX IF NOT EXISTS idx_schemas_created_at ON schemas(created_at);
CREATE INDEX IF NOT EXISTS idx_schemas_updated_at ON schemas(updated_at);
CREATE INDEX IF NOT EXISTS idx_schemas_deleted_at ON schemas(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schemas_project_updated ON schemas(project_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schemas_project_name_unique ON schemas(project_id, LOWER(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_schemas_project_filename_unique ON schemas(project_id, LOWER(file_name)) WHERE deleted_at IS NULL;

-- ============================================================
-- schema_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    canvas_state JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    commit_message TEXT,
    content_hash VARCHAR(64),
    diff JSONB DEFAULT '{}',
    file_size INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schema_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_schema_versions_schema_id ON schema_versions(schema_id);
CREATE INDEX IF NOT EXISTS idx_schema_versions_version_number ON schema_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_schema_versions_created_by ON schema_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_schema_versions_created_at ON schema_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_schema_versions_schema_version_desc ON schema_versions(schema_id, version_number DESC);

-- ============================================================
-- assets
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schema_id UUID REFERENCES schemas(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255),
    file_path TEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    metadata JSONB DEFAULT '{}',
    checksum VARCHAR(64),
    data BYTEA,
    storage_url TEXT,
    storage_type VARCHAR(20) DEFAULT 'filesystem',
    content_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_schema_id ON assets(schema_id);
CREATE INDEX IF NOT EXISTS idx_assets_file_type ON assets(file_type);
CREATE INDEX IF NOT EXISTS idx_assets_mime_type ON assets(mime_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_storage_type ON assets(storage_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_content_hash ON assets(content_hash) WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- sync_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    operation_data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_type ON sync_queue(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_id ON sync_queue(entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(user_id, status, priority DESC, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_queue_retryable ON sync_queue(status, retry_count, max_retries) WHERE status = 'failed';

-- ============================================================
-- sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255),
    user_agent TEXT,
    ip_address VARCHAR(45),
    device_info JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_expires_at TIMESTAMP WITH TIME ZONE,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(user_id, expires_at) WHERE revoked = FALSE;

-- ============================================================
-- realtime_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS realtime_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    session_data JSONB DEFAULT '{}',
    cursor_position JSONB DEFAULT '{}',
    connection_id VARCHAR(255),
    selected_elements JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active',
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, schema_id)
);

CREATE INDEX IF NOT EXISTS idx_realtime_sessions_user_id ON realtime_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_schema_id ON realtime_sessions(schema_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_last_activity ON realtime_sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_connection_id ON realtime_sessions(connection_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_last_heartbeat ON realtime_sessions(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_status ON realtime_sessions(status);

-- ============================================================
-- schema_locks (element-level locking)
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lock_type VARCHAR(50) DEFAULT 'exclusive',
    element_id VARCHAR(255),
    locked_by UUID REFERENCES users(id) ON DELETE CASCADE,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schema_locks_schema_id ON schema_locks(schema_id);
CREATE INDEX IF NOT EXISTS idx_schema_locks_user_id ON schema_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_schema_locks_expires_at ON schema_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_schema_locks_locked_by ON schema_locks(locked_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_locks_schema_element ON schema_locks(schema_id, element_id) WHERE element_id IS NOT NULL;

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- templates
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    content JSONB NOT NULL DEFAULT '{}',
    canvas_state JSONB DEFAULT '{}',
    thumbnail TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_usage_count ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_templates_name_trgm ON templates USING gin(name gin_trgm_ops);

-- ============================================================
-- user_followers
-- ============================================================
CREATE TABLE IF NOT EXISTS user_followers (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_followers_following_id ON user_followers(following_id);

-- ============================================================
-- project_stars
-- ============================================================
CREATE TABLE IF NOT EXISTS project_stars (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_stars_project_id ON project_stars(project_id);

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collaborators_updated_at ON collaborators;
CREATE TRIGGER update_collaborators_updated_at
    BEFORE UPDATE ON collaborators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schemas_updated_at ON schemas;
CREATE TRIGGER update_schemas_updated_at
    BEFORE UPDATE ON schemas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_queue_updated_at ON sync_queue;
CREATE TRIGGER update_sync_queue_updated_at
    BEFORE UPDATE ON sync_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schema_locks_updated_at ON schema_locks;
CREATE TRIGGER update_schema_locks_updated_at
    BEFORE UPDATE ON schema_locks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Triggers: auto content hash (requires pgcrypto)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_content_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_hash = encode(digest(NEW.content::text, 'sha256'), 'hex');
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS calculate_schemas_content_hash ON schemas;
CREATE TRIGGER calculate_schemas_content_hash
    BEFORE INSERT OR UPDATE OF content ON schemas
    FOR EACH ROW EXECUTE FUNCTION calculate_content_hash();

DROP TRIGGER IF EXISTS calculate_schema_versions_content_hash ON schema_versions;
CREATE TRIGGER calculate_schema_versions_content_hash
    BEFORE INSERT OR UPDATE OF content ON schema_versions
    FOR EACH ROW EXECUTE FUNCTION calculate_content_hash();

-- ============================================================
-- Cleanup helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM schema_locks WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION cleanup_old_realtime_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM realtime_sessions WHERE last_activity_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- ============================================================
-- Seed: default templates (ON CONFLICT to make it idempotent)
-- ============================================================
INSERT INTO templates (name, description, category, content, is_public, tags, usage_count) VALUES
(
    'Blank Diagram',
    'Start with a clean canvas',
    'Basic',
    '{"nodes": [], "edges": [], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['blank', 'empty', 'start'],
    0
),
(
    'Flowchart',
    'Basic flowchart template with common shapes',
    'Business',
    '{"nodes": [{"id": "start", "type": "ellipse", "position": {"x": 300, "y": 50}, "size": {"width": 120, "height": 60}, "label": "Start", "style": {"fill": "#4CAF50", "stroke": "#2E7D32"}}, {"id": "process1", "type": "rectangle", "position": {"x": 280, "y": 150}, "size": {"width": 160, "height": 80}, "label": "Process", "style": {"fill": "#2196F3", "stroke": "#1565C0"}}, {"id": "decision", "type": "diamond", "position": {"x": 280, "y": 280}, "size": {"width": 160, "height": 100}, "label": "Decision?", "style": {"fill": "#FFC107", "stroke": "#FFA000"}}, {"id": "end", "type": "ellipse", "position": {"x": 300, "y": 430}, "size": {"width": 120, "height": 60}, "label": "End", "style": {"fill": "#F44336", "stroke": "#C62828"}}], "edges": [{"id": "e1", "source": "start", "target": "process1"}, {"id": "e2", "source": "process1", "target": "decision"}, {"id": "e3", "source": "decision", "target": "end"}], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['flowchart', 'process', 'business'],
    0
),
(
    'Mind Map',
    'Central topic with branching ideas',
    'Planning',
    '{"nodes": [{"id": "center", "type": "ellipse", "position": {"x": 350, "y": 250}, "size": {"width": 140, "height": 80}, "label": "Central Idea", "style": {"fill": "#9C27B0", "stroke": "#6A1B9A"}}, {"id": "branch1", "type": "rectangle", "position": {"x": 100, "y": 100}, "size": {"width": 120, "height": 60}, "label": "Topic 1", "style": {"fill": "#E91E63", "stroke": "#AD1457", "cornerRadius": 10}}, {"id": "branch2", "type": "rectangle", "position": {"x": 550, "y": 100}, "size": {"width": 120, "height": 60}, "label": "Topic 2", "style": {"fill": "#3F51B5", "stroke": "#283593", "cornerRadius": 10}}, {"id": "branch3", "type": "rectangle", "position": {"x": 100, "y": 400}, "size": {"width": 120, "height": 60}, "label": "Topic 3", "style": {"fill": "#009688", "stroke": "#00695C", "cornerRadius": 10}}, {"id": "branch4", "type": "rectangle", "position": {"x": 550, "y": 400}, "size": {"width": 120, "height": 60}, "label": "Topic 4", "style": {"fill": "#FF5722", "stroke": "#BF360C", "cornerRadius": 10}}], "edges": [{"id": "e1", "source": "center", "target": "branch1"}, {"id": "e2", "source": "center", "target": "branch2"}, {"id": "e3", "source": "center", "target": "branch3"}, {"id": "e4", "source": "center", "target": "branch4"}], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['mindmap', 'brainstorm', 'ideas', 'planning'],
    0
),
(
    'Org Chart',
    'Organizational hierarchy structure',
    'Business',
    '{"nodes": [{"id": "ceo", "type": "rectangle", "position": {"x": 350, "y": 50}, "size": {"width": 140, "height": 60}, "label": "CEO", "style": {"fill": "#1976D2", "stroke": "#0D47A1"}}, {"id": "cto", "type": "rectangle", "position": {"x": 150, "y": 150}, "size": {"width": 120, "height": 50}, "label": "CTO", "style": {"fill": "#388E3C", "stroke": "#1B5E20"}}, {"id": "cfo", "type": "rectangle", "position": {"x": 350, "y": 150}, "size": {"width": 120, "height": 50}, "label": "CFO", "style": {"fill": "#388E3C", "stroke": "#1B5E20"}}, {"id": "coo", "type": "rectangle", "position": {"x": 550, "y": 150}, "size": {"width": 120, "height": 50}, "label": "COO", "style": {"fill": "#388E3C", "stroke": "#1B5E20"}}, {"id": "dev1", "type": "rectangle", "position": {"x": 80, "y": 250}, "size": {"width": 100, "height": 40}, "label": "Dev Team", "style": {"fill": "#7CB342", "stroke": "#558B2F"}}, {"id": "dev2", "type": "rectangle", "position": {"x": 220, "y": 250}, "size": {"width": 100, "height": 40}, "label": "QA Team", "style": {"fill": "#7CB342", "stroke": "#558B2F"}}], "edges": [{"id": "e1", "source": "ceo", "target": "cto"}, {"id": "e2", "source": "ceo", "target": "cfo"}, {"id": "e3", "source": "ceo", "target": "coo"}, {"id": "e4", "source": "cto", "target": "dev1"}, {"id": "e5", "source": "cto", "target": "dev2"}], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['orgchart', 'hierarchy', 'organization', 'business'],
    0
),
(
    'Network Diagram',
    'IT network infrastructure layout',
    'Technical',
    '{"nodes": [{"id": "internet", "type": "ellipse", "position": {"x": 350, "y": 50}, "size": {"width": 100, "height": 60}, "label": "Internet", "style": {"fill": "#90CAF9", "stroke": "#1565C0"}}, {"id": "firewall", "type": "rectangle", "position": {"x": 325, "y": 150}, "size": {"width": 150, "height": 50}, "label": "Firewall", "style": {"fill": "#EF5350", "stroke": "#B71C1C"}}, {"id": "router", "type": "rectangle", "position": {"x": 340, "y": 250}, "size": {"width": 120, "height": 50}, "label": "Router", "style": {"fill": "#66BB6A", "stroke": "#2E7D32"}}, {"id": "switch", "type": "rectangle", "position": {"x": 340, "y": 350}, "size": {"width": 120, "height": 50}, "label": "Switch", "style": {"fill": "#42A5F5", "stroke": "#1565C0"}}, {"id": "server1", "type": "rectangle", "position": {"x": 150, "y": 450}, "size": {"width": 100, "height": 50}, "label": "Server 1", "style": {"fill": "#78909C", "stroke": "#37474F"}}, {"id": "server2", "type": "rectangle", "position": {"x": 350, "y": 450}, "size": {"width": 100, "height": 50}, "label": "Server 2", "style": {"fill": "#78909C", "stroke": "#37474F"}}, {"id": "server3", "type": "rectangle", "position": {"x": 550, "y": 450}, "size": {"width": 100, "height": 50}, "label": "Server 3", "style": {"fill": "#78909C", "stroke": "#37474F"}}], "edges": [{"id": "e1", "source": "internet", "target": "firewall"}, {"id": "e2", "source": "firewall", "target": "router"}, {"id": "e3", "source": "router", "target": "switch"}, {"id": "e4", "source": "switch", "target": "server1"}, {"id": "e5", "source": "switch", "target": "server2"}, {"id": "e6", "source": "switch", "target": "server3"}], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['network', 'infrastructure', 'IT', 'technical'],
    0
),
(
    'Use Case Diagram',
    'UML use case diagram template',
    'Technical',
    '{"nodes": [{"id": "actor1", "type": "ellipse", "position": {"x": 50, "y": 200}, "size": {"width": 60, "height": 80}, "label": "User", "style": {"fill": "#FFEB3B", "stroke": "#F9A825"}}, {"id": "system", "type": "rectangle", "position": {"x": 200, "y": 50}, "size": {"width": 400, "height": 400}, "label": "System", "style": {"fill": "#E3F2FD", "stroke": "#1976D2", "strokeWidth": 2}}, {"id": "uc1", "type": "ellipse", "position": {"x": 300, "y": 100}, "size": {"width": 160, "height": 60}, "label": "Login", "style": {"fill": "#FFFFFF", "stroke": "#424242"}}, {"id": "uc2", "type": "ellipse", "position": {"x": 300, "y": 200}, "size": {"width": 160, "height": 60}, "label": "View Dashboard", "style": {"fill": "#FFFFFF", "stroke": "#424242"}}, {"id": "uc3", "type": "ellipse", "position": {"x": 300, "y": 300}, "size": {"width": 160, "height": 60}, "label": "Create Report", "style": {"fill": "#FFFFFF", "stroke": "#424242"}}, {"id": "uc4", "type": "ellipse", "position": {"x": 300, "y": 400}, "size": {"width": 160, "height": 60}, "label": "Export Data", "style": {"fill": "#FFFFFF", "stroke": "#424242"}}], "edges": [{"id": "e1", "source": "actor1", "target": "uc1"}, {"id": "e2", "source": "actor1", "target": "uc2"}, {"id": "e3", "source": "actor1", "target": "uc3"}, {"id": "e4", "source": "actor1", "target": "uc4"}], "layers": [{"id": "default", "name": "Default Layer", "visible": true, "locked": false, "opacity": 1.0, "order": 0}]}',
    TRUE,
    ARRAY['usecase', 'UML', 'requirements', 'technical'],
    0
)
ON CONFLICT (name) DO NOTHING;
