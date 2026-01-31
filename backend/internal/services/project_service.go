package services

import (
	"context"
	"errors"

	"diagram-app/backend/internal/models"
	"diagram-app/backend/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrProjectNotFound = errors.New("project not found")
	ErrAccessDenied    = errors.New("access denied")
)

type ProjectService struct {
	projectRepo *repository.ProjectRepository
}

func NewProjectService(projectRepo *repository.ProjectRepository) *ProjectService {
	return &ProjectService{projectRepo: projectRepo}
}

func (s *ProjectService) Create(ctx context.Context, ownerID uuid.UUID, name, description string, isPublic bool) (*models.Project, error) {
	project := &models.Project{
		OwnerID:     ownerID,
		Name:        name,
		Description: description,
		Settings:    make(map[string]interface{}),
		IsArchived:  false,
		IsPublic:    isPublic,
		Metadata:    make(map[string]interface{}),
	}

	if err := s.projectRepo.Create(ctx, project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *ProjectService) Get(ctx context.Context, projectID, userID uuid.UUID) (*models.Project, error) {
	hasAccess, err := s.projectRepo.HasAccess(ctx, projectID, userID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, ErrAccessDenied
	}

	project, err := s.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, ErrProjectNotFound
	}

	return project, nil
}

func (s *ProjectService) List(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.Project, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	projects, err := s.projectRepo.ListAccessible(ctx, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	count, err := s.projectRepo.Count(ctx, userID)
	if err != nil {
		return nil, 0, err
	}

	return projects, count, nil
}

func (s *ProjectService) Update(ctx context.Context, projectID, userID uuid.UUID, name, description *string, isPublic, isArchived *bool, settings map[string]interface{}) (*models.Project, error) {
	isOwner, err := s.projectRepo.IsOwner(ctx, projectID, userID)
	if err != nil {
		return nil, err
	}
	if !isOwner {
		return nil, ErrAccessDenied
	}

	project, err := s.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, ErrProjectNotFound
	}

	if name != nil {
		project.Name = *name
	}
	if description != nil {
		project.Description = *description
	}
	if isPublic != nil {
		project.IsPublic = *isPublic
	}
	if isArchived != nil {
		project.IsArchived = *isArchived
	}
	if settings != nil {
		for k, v := range settings {
			project.Settings[k] = v
		}
	}

	if err := s.projectRepo.Update(ctx, project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *ProjectService) Delete(ctx context.Context, projectID, userID uuid.UUID) error {
	isOwner, err := s.projectRepo.IsOwner(ctx, projectID, userID)
	if err != nil {
		return err
	}
	if !isOwner {
		return ErrAccessDenied
	}

	return s.projectRepo.Delete(ctx, projectID)
}

func (s *ProjectService) IsOwner(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	return s.projectRepo.IsOwner(ctx, projectID, userID)
}

func (s *ProjectService) HasAccess(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	return s.projectRepo.HasAccess(ctx, projectID, userID)
}

func (s *ProjectService) CheckAccess(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	return s.projectRepo.HasAccess(ctx, projectID, userID)
}

func (s *ProjectService) GetCollaborators(ctx context.Context, projectID uuid.UUID) ([]repository.CollaboratorInfo, error) {
	return s.projectRepo.GetCollaborators(ctx, projectID)
}

func (s *ProjectService) AddCollaborator(ctx context.Context, projectID uuid.UUID, email, permission string, invitedBy uuid.UUID) (*repository.CollaboratorInfo, error) {
	return s.projectRepo.AddCollaborator(ctx, projectID, email, permission, invitedBy)
}

func (s *ProjectService) UpdateCollaborator(ctx context.Context, projectID, userID uuid.UUID, permission string) error {
	return s.projectRepo.UpdateCollaborator(ctx, projectID, userID, permission)
}

func (s *ProjectService) RemoveCollaborator(ctx context.Context, projectID, userID uuid.UUID) error {
	return s.projectRepo.RemoveCollaborator(ctx, projectID, userID)
}
