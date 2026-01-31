package services

import (
	"context"
	"errors"

	"diagram-app/backend/internal/models"
	"diagram-app/backend/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrSchemaNotFound = errors.New("schema not found")
)

type SchemaService struct {
	schemaRepo *repository.SchemaRepository
}

func NewSchemaService(schemaRepo *repository.SchemaRepository) *SchemaService {
	return &SchemaService{schemaRepo: schemaRepo}
}

func (s *SchemaService) Create(ctx context.Context, projectID uuid.UUID, name, fileName string, content, canvasState map[string]interface{}, formatVersion string) (*models.Schema, error) {
	schema := &models.Schema{
		ProjectID:     projectID,
		Name:          name,
		FileName:      fileName,
		Content:       content,
		FormatVersion: formatVersion,
		CanvasState:   canvasState,
		IsEncrypted:   false,
		Metadata:      make(map[string]interface{}),
	}

	if err := s.schemaRepo.Create(ctx, schema); err != nil {
		return nil, err
	}

	return schema, nil
}

func (s *SchemaService) Get(ctx context.Context, schemaID uuid.UUID) (*models.Schema, error) {
	schema, err := s.schemaRepo.GetByID(ctx, schemaID)
	if err != nil {
		return nil, ErrSchemaNotFound
	}

	return schema, nil
}

func (s *SchemaService) ListByProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]*models.Schema, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	return s.schemaRepo.ListByProject(ctx, projectID, limit, offset)
}

func (s *SchemaService) ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.Schema, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	return s.schemaRepo.ListByUser(ctx, userID, limit, offset)
}

func (s *SchemaService) Update(ctx context.Context, schemaID uuid.UUID, name, fileName *string, content, canvasState map[string]interface{}) (*models.Schema, error) {
	schema, err := s.schemaRepo.GetByID(ctx, schemaID)
	if err != nil {
		return nil, ErrSchemaNotFound
	}

	if name != nil {
		schema.Name = *name
	}
	if fileName != nil {
		schema.FileName = *fileName
	}
	if content != nil {
		schema.Content = content
	}
	if canvasState != nil {
		schema.CanvasState = canvasState
	}

	if err := s.schemaRepo.Update(ctx, schema); err != nil {
		return nil, err
	}

	return schema, nil
}

func (s *SchemaService) Delete(ctx context.Context, schemaID uuid.UUID) error {
	_, err := s.schemaRepo.GetByID(ctx, schemaID)
	if err != nil {
		return ErrSchemaNotFound
	}

	return s.schemaRepo.Delete(ctx, schemaID)
}

func (s *SchemaService) CreateVersion(ctx context.Context, schemaID, userID uuid.UUID, commitMessage string) (*models.SchemaVersion, error) {
	schema, err := s.schemaRepo.GetByID(ctx, schemaID)
	if err != nil {
		return nil, ErrSchemaNotFound
	}

	latestVersion, err := s.schemaRepo.GetLatestVersionNumber(ctx, schemaID)
	if err != nil {
		return nil, err
	}

	version := &models.SchemaVersion{
		SchemaID:      schemaID,
		VersionNumber: latestVersion + 1,
		Content:       schema.Content,
		CreatedBy:     userID,
		CommitMessage: commitMessage,
		Diff:          make(map[string]interface{}),
		Metadata:      make(map[string]interface{}),
	}

	if err := s.schemaRepo.CreateVersion(ctx, version); err != nil {
		return nil, err
	}

	return version, nil
}

func (s *SchemaService) ListVersions(ctx context.Context, schemaID uuid.UUID, limit, offset int) ([]*models.SchemaVersion, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	return s.schemaRepo.ListVersions(ctx, schemaID, limit, offset)
}

func (s *SchemaService) GetVersion(ctx context.Context, versionID uuid.UUID) (*models.SchemaVersion, error) {
	return s.schemaRepo.GetVersion(ctx, versionID)
}

func (s *SchemaService) Search(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]*models.Schema, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	return s.schemaRepo.Search(ctx, userID, query, limit, offset)
}

func (s *SchemaService) GetContentHash(ctx context.Context, schemaID uuid.UUID) (string, error) {
	return s.schemaRepo.GetContentHash(ctx, schemaID)
}
