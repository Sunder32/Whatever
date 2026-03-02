package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"diagram-app/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProjectRepository struct {
	pool *pgxpool.Pool
}

func NewProjectRepository(pool *pgxpool.Pool) *ProjectRepository {
	return &ProjectRepository{pool: pool}
}

func (r *ProjectRepository) Create(ctx context.Context, project *models.Project) error {
	project.ID = uuid.New()
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	settingsJSON, err := json.Marshal(project.Settings)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(project.Metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO projects (
			id, owner_id, name, description, settings, created_at, updated_at,
			is_archived, is_public, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	// Try to insert; if name conflicts (unique index), append a suffix
	originalName := project.Name
	for attempt := 0; attempt < 10; attempt++ {
		_, err = r.pool.Exec(ctx, query,
			project.ID,
			project.OwnerID,
			project.Name,
			project.Description,
			settingsJSON,
			project.CreatedAt,
			project.UpdatedAt,
			project.IsArchived,
			project.IsPublic,
			metadataJSON,
		)
		if err == nil {
			return nil
		}
		// Check if it's a unique constraint violation on name
		if strings.Contains(err.Error(), "idx_projects_owner_name_unique") || strings.Contains(err.Error(), "duplicate key") {
			attempt++
			project.Name = fmt.Sprintf("%s (%d)", originalName, attempt)
			project.ID = uuid.New() // new UUID for retry
			continue
		}
		return err
	}

	return err
}

func (r *ProjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Project, error) {
	query := `
		SELECT id, owner_id, name, description, settings, created_at, updated_at,
			   is_archived, is_public, metadata
		FROM projects WHERE id = $1
	`

	var project models.Project
	var settingsJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&project.ID,
		&project.OwnerID,
		&project.Name,
		&project.Description,
		&settingsJSON,
		&project.CreatedAt,
		&project.UpdatedAt,
		&project.IsArchived,
		&project.IsPublic,
		&metadataJSON,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(settingsJSON, &project.Settings); err != nil {
		project.Settings = make(map[string]interface{})
	}
	if err := json.Unmarshal(metadataJSON, &project.Metadata); err != nil {
		project.Metadata = make(map[string]interface{})
	}

	return &project, nil
}

func (r *ProjectRepository) ListByOwner(ctx context.Context, ownerID uuid.UUID, limit, offset int) ([]*models.Project, error) {
	query := `
		SELECT id, owner_id, name, description, settings, created_at, updated_at,
			   is_archived, is_public, metadata
		FROM projects 
		WHERE owner_id = $1 
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, ownerID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*models.Project
	for rows.Next() {
		var project models.Project
		var settingsJSON, metadataJSON []byte

		err := rows.Scan(
			&project.ID,
			&project.OwnerID,
			&project.Name,
			&project.Description,
			&settingsJSON,
			&project.CreatedAt,
			&project.UpdatedAt,
			&project.IsArchived,
			&project.IsPublic,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(settingsJSON, &project.Settings); err != nil {
			project.Settings = make(map[string]interface{})
		}
		if err := json.Unmarshal(metadataJSON, &project.Metadata); err != nil {
			project.Metadata = make(map[string]interface{})
		}

		projects = append(projects, &project)
	}

	return projects, nil
}

func (r *ProjectRepository) ListAccessible(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.Project, error) {
	query := `
		SELECT DISTINCT p.id, p.owner_id, p.name, p.description, p.settings, 
			   p.created_at, p.updated_at, p.is_archived, p.is_public, p.metadata
		FROM projects p
		LEFT JOIN collaborators c ON p.id = c.project_id
		WHERE p.owner_id = $1 OR c.user_id = $1 OR p.is_public = true
		ORDER BY p.updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*models.Project
	for rows.Next() {
		var project models.Project
		var settingsJSON, metadataJSON []byte

		err := rows.Scan(
			&project.ID,
			&project.OwnerID,
			&project.Name,
			&project.Description,
			&settingsJSON,
			&project.CreatedAt,
			&project.UpdatedAt,
			&project.IsArchived,
			&project.IsPublic,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(settingsJSON, &project.Settings); err != nil {
			project.Settings = make(map[string]interface{})
		}
		if err := json.Unmarshal(metadataJSON, &project.Metadata); err != nil {
			project.Metadata = make(map[string]interface{})
		}

		projects = append(projects, &project)
	}

	return projects, nil
}

func (r *ProjectRepository) Update(ctx context.Context, project *models.Project) error {
	project.UpdatedAt = time.Now()

	settingsJSON, err := json.Marshal(project.Settings)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(project.Metadata)
	if err != nil {
		return err
	}

	query := `
		UPDATE projects SET
			name = $2,
			description = $3,
			settings = $4,
			updated_at = $5,
			is_archived = $6,
			is_public = $7,
			metadata = $8
		WHERE id = $1
	`

	_, err = r.pool.Exec(ctx, query,
		project.ID,
		project.Name,
		project.Description,
		settingsJSON,
		project.UpdatedAt,
		project.IsArchived,
		project.IsPublic,
		metadataJSON,
	)

	return err
}

func (r *ProjectRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM projects WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *ProjectRepository) IsOwner(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2)`
	var exists bool
	err := r.pool.QueryRow(ctx, query, projectID, userID).Scan(&exists)
	return exists, err
}

func (r *ProjectRepository) HasAccess(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM projects p
			LEFT JOIN collaborators c ON p.id = c.project_id
			WHERE p.id = $1 AND (p.owner_id = $2 OR c.user_id = $2 OR p.is_public = true)
		)
	`
	var exists bool
	err := r.pool.QueryRow(ctx, query, projectID, userID).Scan(&exists)
	return exists, err
}

func (r *ProjectRepository) Count(ctx context.Context, ownerID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM projects WHERE owner_id = $1`
	var count int
	err := r.pool.QueryRow(ctx, query, ownerID).Scan(&count)
	return count, err
}

type CollaboratorInfo struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"userId"`
	Email      string     `json:"email"`
	Name       string     `json:"name"`
	Avatar     *string    `json:"avatar,omitempty"`
	Permission string     `json:"permission"`
	InvitedBy  *uuid.UUID `json:"invitedBy,omitempty"`
}

func (r *ProjectRepository) GetCollaborators(ctx context.Context, projectID uuid.UUID) ([]CollaboratorInfo, error) {
	query := `
		SELECT c.id, c.user_id, u.email, u.name, u.avatar, c.permission, c.invited_by
		FROM collaborators c
		JOIN users u ON c.user_id = u.id
		WHERE c.project_id = $1
		ORDER BY c.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var collaborators []CollaboratorInfo
	for rows.Next() {
		var c CollaboratorInfo
		err := rows.Scan(&c.ID, &c.UserID, &c.Email, &c.Name, &c.Avatar, &c.Permission, &c.InvitedBy)
		if err != nil {
			continue
		}
		collaborators = append(collaborators, c)
	}

	return collaborators, nil
}

func (r *ProjectRepository) AddCollaborator(ctx context.Context, projectID uuid.UUID, email, permission string, invitedBy uuid.UUID) (*CollaboratorInfo, error) {
	// Find user by email
	var userID uuid.UUID
	var userName string
	var userAvatar *string
	err := r.pool.QueryRow(ctx, `SELECT id, name, avatar FROM users WHERE email = $1 AND deleted_at IS NULL`, email).
		Scan(&userID, &userName, &userAvatar)
	if err != nil {
		return nil, err
	}

	// Check if already collaborator
	var exists bool
	err = r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM collaborators WHERE project_id = $1 AND user_id = $2)`,
		projectID, userID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, &DuplicateError{Message: "User is already a collaborator"}
	}

	// Validate permission
	if permission != "read" && permission != "write" && permission != "admin" {
		permission = "read"
	}

	// Insert collaborator
	var collabID uuid.UUID
	err = r.pool.QueryRow(ctx, `
		INSERT INTO collaborators (project_id, user_id, permission, invited_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id
	`, projectID, userID, permission, invitedBy).Scan(&collabID)
	if err != nil {
		return nil, err
	}

	return &CollaboratorInfo{
		ID:         collabID,
		UserID:     userID,
		Email:      email,
		Name:       userName,
		Avatar:     userAvatar,
		Permission: permission,
		InvitedBy:  &invitedBy,
	}, nil
}

func (r *ProjectRepository) UpdateCollaborator(ctx context.Context, projectID, userID uuid.UUID, permission string) error {
	if permission != "read" && permission != "write" && permission != "admin" {
		return &ValidationError{Message: "Invalid permission"}
	}

	_, err := r.pool.Exec(ctx, `
		UPDATE collaborators SET permission = $1, updated_at = NOW()
		WHERE project_id = $2 AND user_id = $3
	`, permission, projectID, userID)
	return err
}

func (r *ProjectRepository) RemoveCollaborator(ctx context.Context, projectID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM collaborators WHERE project_id = $1 AND user_id = $2`, projectID, userID)
	return err
}

type DuplicateError struct {
	Message string
}

func (e *DuplicateError) Error() string {
	return e.Message
}

type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}
