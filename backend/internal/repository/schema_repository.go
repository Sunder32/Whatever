package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"

	"diagram-app/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SchemaRepository struct {
	pool *pgxpool.Pool
}

func NewSchemaRepository(pool *pgxpool.Pool) *SchemaRepository {
	return &SchemaRepository{pool: pool}
}

func (r *SchemaRepository) Create(ctx context.Context, schema *models.Schema) error {
	schema.ID = uuid.New()
	schema.CreatedAt = time.Now()
	schema.UpdatedAt = time.Now()

	contentJSON, err := json.Marshal(schema.Content)
	if err != nil {
		return err
	}

	hash := sha256.Sum256(contentJSON)
	schema.ContentHash = hex.EncodeToString(hash[:])
	schema.FileSize = int64(len(contentJSON))

	canvasStateJSON, err := json.Marshal(schema.CanvasState)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(schema.Metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO schemas (
			id, project_id, name, file_name, content, content_hash, file_size,
			format_version, thumbnail, thumbnail_url, canvas_state, created_at,
			updated_at, is_encrypted, encryption_method, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err = r.pool.Exec(ctx, query,
		schema.ID,
		schema.ProjectID,
		schema.Name,
		schema.FileName,
		contentJSON,
		schema.ContentHash,
		schema.FileSize,
		schema.FormatVersion,
		schema.Thumbnail,
		schema.ThumbnailURL,
		canvasStateJSON,
		schema.CreatedAt,
		schema.UpdatedAt,
		schema.IsEncrypted,
		schema.EncryptionMethod,
		metadataJSON,
	)

	return err
}

func (r *SchemaRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Schema, error) {
	query := `
		SELECT id, project_id, name, file_name, content, content_hash, file_size,
			   format_version, thumbnail, thumbnail_url, canvas_state, created_at,
			   updated_at, is_encrypted, encryption_method, metadata
		FROM schemas WHERE id = $1
	`

	var schema models.Schema
	var contentJSON, canvasStateJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&schema.ID,
		&schema.ProjectID,
		&schema.Name,
		&schema.FileName,
		&contentJSON,
		&schema.ContentHash,
		&schema.FileSize,
		&schema.FormatVersion,
		&schema.Thumbnail,
		&schema.ThumbnailURL,
		&canvasStateJSON,
		&schema.CreatedAt,
		&schema.UpdatedAt,
		&schema.IsEncrypted,
		&schema.EncryptionMethod,
		&metadataJSON,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(contentJSON, &schema.Content); err != nil {
		schema.Content = make(map[string]interface{})
	}
	if err := json.Unmarshal(canvasStateJSON, &schema.CanvasState); err != nil {
		schema.CanvasState = make(map[string]interface{})
	}
	if err := json.Unmarshal(metadataJSON, &schema.Metadata); err != nil {
		schema.Metadata = make(map[string]interface{})
	}

	return &schema, nil
}

func (r *SchemaRepository) ListByProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]*models.Schema, error) {
	query := `
		SELECT id, project_id, name, file_name, content_hash, file_size,
			   format_version, thumbnail_url, created_at, updated_at,
			   is_encrypted, encryption_method
		FROM schemas 
		WHERE project_id = $1 
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, projectID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []*models.Schema
	for rows.Next() {
		var schema models.Schema

		err := rows.Scan(
			&schema.ID,
			&schema.ProjectID,
			&schema.Name,
			&schema.FileName,
			&schema.ContentHash,
			&schema.FileSize,
			&schema.FormatVersion,
			&schema.ThumbnailURL,
			&schema.CreatedAt,
			&schema.UpdatedAt,
			&schema.IsEncrypted,
			&schema.EncryptionMethod,
		)
		if err != nil {
			return nil, err
		}

		schemas = append(schemas, &schema)
	}

	return schemas, nil
}

func (r *SchemaRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.Schema, error) {
	query := `
		SELECT s.id, s.project_id, s.name, s.file_name, s.content_hash, s.file_size,
			   s.format_version, s.thumbnail_url, s.created_at, s.updated_at,
			   s.is_encrypted, s.encryption_method
		FROM schemas s
		JOIN projects p ON s.project_id = p.id
		LEFT JOIN collaborators c ON p.id = c.project_id
		WHERE p.owner_id = $1 OR c.user_id = $1
		ORDER BY s.updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []*models.Schema
	for rows.Next() {
		var schema models.Schema

		err := rows.Scan(
			&schema.ID,
			&schema.ProjectID,
			&schema.Name,
			&schema.FileName,
			&schema.ContentHash,
			&schema.FileSize,
			&schema.FormatVersion,
			&schema.ThumbnailURL,
			&schema.CreatedAt,
			&schema.UpdatedAt,
			&schema.IsEncrypted,
			&schema.EncryptionMethod,
		)
		if err != nil {
			return nil, err
		}

		schemas = append(schemas, &schema)
	}

	return schemas, nil
}

func (r *SchemaRepository) Update(ctx context.Context, schema *models.Schema) error {
	schema.UpdatedAt = time.Now()

	contentJSON, err := json.Marshal(schema.Content)
	if err != nil {
		return err
	}

	hash := sha256.Sum256(contentJSON)
	schema.ContentHash = hex.EncodeToString(hash[:])
	schema.FileSize = int64(len(contentJSON))

	canvasStateJSON, err := json.Marshal(schema.CanvasState)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(schema.Metadata)
	if err != nil {
		return err
	}

	query := `
		UPDATE schemas SET
			name = $2,
			file_name = $3,
			content = $4,
			content_hash = $5,
			file_size = $6,
			format_version = $7,
			thumbnail = $8,
			thumbnail_url = $9,
			canvas_state = $10,
			updated_at = $11,
			is_encrypted = $12,
			encryption_method = $13,
			metadata = $14
		WHERE id = $1
	`

	_, err = r.pool.Exec(ctx, query,
		schema.ID,
		schema.Name,
		schema.FileName,
		contentJSON,
		schema.ContentHash,
		schema.FileSize,
		schema.FormatVersion,
		schema.Thumbnail,
		schema.ThumbnailURL,
		canvasStateJSON,
		schema.UpdatedAt,
		schema.IsEncrypted,
		schema.EncryptionMethod,
		metadataJSON,
	)

	return err
}

func (r *SchemaRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM schemas WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *SchemaRepository) GetContentHash(ctx context.Context, id uuid.UUID) (string, error) {
	query := `SELECT content_hash FROM schemas WHERE id = $1`
	var hash string
	err := r.pool.QueryRow(ctx, query, id).Scan(&hash)
	return hash, err
}

func (r *SchemaRepository) CreateVersion(ctx context.Context, version *models.SchemaVersion) error {
	version.ID = uuid.New()
	version.CreatedAt = time.Now()

	contentJSON, err := json.Marshal(version.Content)
	if err != nil {
		return err
	}

	hash := sha256.Sum256(contentJSON)
	version.ContentHash = hex.EncodeToString(hash[:])
	version.FileSize = int64(len(contentJSON))

	diffJSON, err := json.Marshal(version.Diff)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(version.Metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO schema_versions (
			id, schema_id, version_number, content, content_hash, created_by,
			created_at, commit_message, diff, file_size, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err = r.pool.Exec(ctx, query,
		version.ID,
		version.SchemaID,
		version.VersionNumber,
		contentJSON,
		version.ContentHash,
		version.CreatedBy,
		version.CreatedAt,
		version.CommitMessage,
		diffJSON,
		version.FileSize,
		metadataJSON,
	)

	return err
}

func (r *SchemaRepository) GetLatestVersionNumber(ctx context.Context, schemaID uuid.UUID) (int, error) {
	query := `SELECT COALESCE(MAX(version_number), 0) FROM schema_versions WHERE schema_id = $1`
	var version int
	err := r.pool.QueryRow(ctx, query, schemaID).Scan(&version)
	return version, err
}

func (r *SchemaRepository) ListVersions(ctx context.Context, schemaID uuid.UUID, limit, offset int) ([]*models.SchemaVersion, error) {
	query := `
		SELECT id, schema_id, version_number, content_hash, created_by,
			   created_at, commit_message, file_size
		FROM schema_versions 
		WHERE schema_id = $1 
		ORDER BY version_number DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, schemaID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []*models.SchemaVersion
	for rows.Next() {
		var version models.SchemaVersion

		err := rows.Scan(
			&version.ID,
			&version.SchemaID,
			&version.VersionNumber,
			&version.ContentHash,
			&version.CreatedBy,
			&version.CreatedAt,
			&version.CommitMessage,
			&version.FileSize,
		)
		if err != nil {
			return nil, err
		}

		versions = append(versions, &version)
	}

	return versions, nil
}

func (r *SchemaRepository) GetVersion(ctx context.Context, id uuid.UUID) (*models.SchemaVersion, error) {
	query := `
		SELECT id, schema_id, version_number, content, content_hash, created_by,
			   created_at, commit_message, diff, file_size, metadata
		FROM schema_versions WHERE id = $1
	`

	var version models.SchemaVersion
	var contentJSON, diffJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&version.ID,
		&version.SchemaID,
		&version.VersionNumber,
		&contentJSON,
		&version.ContentHash,
		&version.CreatedBy,
		&version.CreatedAt,
		&version.CommitMessage,
		&diffJSON,
		&version.FileSize,
		&metadataJSON,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(contentJSON, &version.Content); err != nil {
		version.Content = make(map[string]interface{})
	}
	if err := json.Unmarshal(diffJSON, &version.Diff); err != nil {
		version.Diff = make(map[string]interface{})
	}
	if err := json.Unmarshal(metadataJSON, &version.Metadata); err != nil {
		version.Metadata = make(map[string]interface{})
	}

	return &version, nil
}

func (r *SchemaRepository) Search(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]*models.Schema, error) {
	searchQuery := `
		SELECT s.id, s.project_id, s.name, s.file_name, s.content_hash, s.file_size,
			   s.format_version, s.thumbnail_url, s.created_at, s.updated_at,
			   s.is_encrypted, s.encryption_method
		FROM schemas s
		JOIN projects p ON s.project_id = p.id
		LEFT JOIN collaborators c ON p.id = c.project_id
		WHERE (p.owner_id = $1 OR c.user_id = $1)
		  AND (s.name ILIKE $2 OR s.file_name ILIKE $2)
		ORDER BY s.updated_at DESC
		LIMIT $3 OFFSET $4
	`

	searchPattern := "%" + query + "%"
	rows, err := r.pool.Query(ctx, searchQuery, userID, searchPattern, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []*models.Schema
	for rows.Next() {
		var schema models.Schema

		err := rows.Scan(
			&schema.ID,
			&schema.ProjectID,
			&schema.Name,
			&schema.FileName,
			&schema.ContentHash,
			&schema.FileSize,
			&schema.FormatVersion,
			&schema.ThumbnailURL,
			&schema.CreatedAt,
			&schema.UpdatedAt,
			&schema.IsEncrypted,
			&schema.EncryptionMethod,
		)
		if err != nil {
			return nil, err
		}

		schemas = append(schemas, &schema)
	}

	return schemas, nil
}
