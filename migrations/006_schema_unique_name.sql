-- Add unique constraint to prevent duplicate schema names within a project
CREATE UNIQUE INDEX IF NOT EXISTS idx_schemas_project_name_unique 
    ON schemas(project_id, LOWER(name)) 
    WHERE deleted_at IS NULL;

-- Add unique constraint for schema file names within a project
CREATE UNIQUE INDEX IF NOT EXISTS idx_schemas_project_filename_unique 
    ON schemas(project_id, LOWER(file_name)) 
    WHERE deleted_at IS NULL;
