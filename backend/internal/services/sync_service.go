package services

import (
	"context"
	"time"

	"diagram-app/backend/internal/models"
	"diagram-app/backend/internal/repository"

	"github.com/google/uuid"
)

type SyncService struct {
	syncRepo   *repository.SyncRepository
	schemaRepo *repository.SchemaRepository
}

type SyncPullResult struct {
	Schemas   []*models.Schema `json:"schemas"`
	Timestamp time.Time        `json:"timestamp"`
	HasMore   bool             `json:"hasMore"`
}

type SyncPushResult struct {
	Processed int      `json:"processed"`
	Failed    int      `json:"failed"`
	Errors    []string `json:"errors,omitempty"`
}

type SyncStatus struct {
	Pending    int       `json:"pending"`
	Processing int       `json:"processing"`
	Completed  int       `json:"completed"`
	Failed     int       `json:"failed"`
	LastSync   time.Time `json:"lastSync"`
}

type ConflictInfo struct {
	SchemaID     uuid.UUID              `json:"schemaId"`
	LocalHash    string                 `json:"localHash"`
	RemoteHash   string                 `json:"remoteHash"`
	LocalContent map[string]interface{} `json:"localContent"`
	RemoteSchema *models.Schema         `json:"remoteSchema"`
}

func NewSyncService(syncRepo *repository.SyncRepository, schemaRepo *repository.SchemaRepository) *SyncService {
	return &SyncService{
		syncRepo:   syncRepo,
		schemaRepo: schemaRepo,
	}
}

func (s *SyncService) Pull(ctx context.Context, userID uuid.UUID, since time.Time) (*SyncPullResult, error) {
	schemas, err := s.syncRepo.GetChangedSchemas(ctx, userID, since)
	if err != nil {
		return nil, err
	}

	return &SyncPullResult{
		Schemas:   schemas,
		Timestamp: time.Now(),
		HasMore:   false,
	}, nil
}

func (s *SyncService) Push(ctx context.Context, userID uuid.UUID, operations []map[string]interface{}) (*SyncPushResult, error) {
	result := &SyncPushResult{
		Processed: 0,
		Failed:    0,
		Errors:    []string{},
	}

	for _, op := range operations {
		// Support both frontend field names (operationType/operationData) and backend ones (type/data)
		opType, _ := op["type"].(string)
		if opType == "" {
			opType, _ = op["operationType"].(string)
		}
		entityType, _ := op["entityType"].(string)
		entityIDStr, _ := op["entityId"].(string)
		data, _ := op["data"].(map[string]interface{})
		if data == nil {
			data, _ = op["operationData"].(map[string]interface{})
		}

		entityID, err := uuid.Parse(entityIDStr)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, "invalid entity ID: "+entityIDStr)
			continue
		}

		switch opType {
		case "create":
			err = s.handleCreate(ctx, entityType, data)
		case "update":
			err = s.handleUpdate(ctx, entityType, entityID, data)
		case "delete":
			err = s.handleDelete(ctx, entityType, entityID)
		default:
			result.Failed++
			result.Errors = append(result.Errors, "unknown operation type: "+opType)
			continue
		}

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, err.Error())
		} else {
			result.Processed++
		}
	}

	return result, nil
}

func (s *SyncService) handleCreate(ctx context.Context, entityType string, data map[string]interface{}) error {
	switch entityType {
	case "schema":
		projectIDStr, _ := data["projectId"].(string)
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			return err
		}

		name, _ := data["name"].(string)
		fileName, _ := data["fileName"].(string)
		content, _ := data["content"].(map[string]interface{})
		canvasState, _ := data["canvasState"].(map[string]interface{})
		formatVersion, _ := data["formatVersion"].(string)

		schema := &models.Schema{
			ProjectID:     projectID,
			Name:          name,
			FileName:      fileName,
			Content:       content,
			FormatVersion: formatVersion,
			CanvasState:   canvasState,
			Metadata:      make(map[string]interface{}),
		}

		return s.schemaRepo.Create(ctx, schema)
	}

	return nil
}

func (s *SyncService) handleUpdate(ctx context.Context, entityType string, entityID uuid.UUID, data map[string]interface{}) error {
	switch entityType {
	case "schema":
		schema, err := s.schemaRepo.GetByID(ctx, entityID)
		if err != nil {
			return err
		}

		if name, ok := data["name"].(string); ok {
			schema.Name = name
		}
		if fileName, ok := data["fileName"].(string); ok {
			schema.FileName = fileName
		}
		if content, ok := data["content"].(map[string]interface{}); ok {
			schema.Content = content
		}
		if canvasState, ok := data["canvasState"].(map[string]interface{}); ok {
			schema.CanvasState = canvasState
		}

		return s.schemaRepo.Update(ctx, schema)
	}

	return nil
}

func (s *SyncService) handleDelete(ctx context.Context, entityType string, entityID uuid.UUID) error {
	switch entityType {
	case "schema":
		return s.schemaRepo.Delete(ctx, entityID)
	}

	return nil
}

func (s *SyncService) GetStatus(ctx context.Context, userID uuid.UUID) (*SyncStatus, error) {
	statusMap, err := s.syncRepo.GetQueueStatus(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &SyncStatus{
		Pending:    statusMap["pending"],
		Processing: statusMap["processing"],
		Completed:  statusMap["completed"],
		Failed:     statusMap["failed"],
		LastSync:   time.Now(),
	}, nil
}

func (s *SyncService) DetectConflicts(ctx context.Context, userID uuid.UUID, localHashes map[string]string) ([]ConflictInfo, error) {
	var conflicts []ConflictInfo

	for schemaIDStr, localHash := range localHashes {
		schemaID, err := uuid.Parse(schemaIDStr)
		if err != nil {
			continue
		}

		remoteHash, err := s.schemaRepo.GetContentHash(ctx, schemaID)
		if err != nil {
			continue
		}

		if remoteHash != localHash {
			remoteSchema, err := s.schemaRepo.GetByID(ctx, schemaID)
			if err != nil {
				continue
			}

			conflicts = append(conflicts, ConflictInfo{
				SchemaID:     schemaID,
				LocalHash:    localHash,
				RemoteHash:   remoteHash,
				RemoteSchema: remoteSchema,
			})
		}
	}

	return conflicts, nil
}

func (s *SyncService) ResolveConflict(ctx context.Context, schemaID uuid.UUID, resolution string, mergedContent map[string]interface{}) error {
	schema, err := s.schemaRepo.GetByID(ctx, schemaID)
	if err != nil {
		return err
	}

	switch resolution {
	case "keep_remote":
		return nil
	case "keep_local":
		if mergedContent != nil {
			schema.Content = mergedContent
			return s.schemaRepo.Update(ctx, schema)
		}
	case "merge":
		if mergedContent != nil {
			schema.Content = mergedContent
			return s.schemaRepo.Update(ctx, schema)
		}
	}

	return nil
}

func (s *SyncService) QueueOperation(ctx context.Context, userID uuid.UUID, opType, entityType string, entityID uuid.UUID, data map[string]interface{}, priority int) error {
	item := &models.SyncQueueItem{
		UserID:        userID,
		OperationType: opType,
		EntityType:    entityType,
		EntityID:      entityID,
		OperationData: data,
		Priority:      priority,
		Metadata:      make(map[string]interface{}),
	}

	return s.syncRepo.CreateQueueItem(ctx, item)
}

func (s *SyncService) ProcessQueue(ctx context.Context, userID uuid.UUID, batchSize int) (*SyncPushResult, error) {
	items, err := s.syncRepo.GetPendingItems(ctx, userID, batchSize)
	if err != nil {
		return nil, err
	}

	result := &SyncPushResult{
		Processed: 0,
		Failed:    0,
		Errors:    []string{},
	}

	for _, item := range items {
		var processErr error

		switch item.OperationType {
		case "create":
			processErr = s.handleCreate(ctx, item.EntityType, item.OperationData)
		case "update":
			processErr = s.handleUpdate(ctx, item.EntityType, item.EntityID, item.OperationData)
		case "delete":
			processErr = s.handleDelete(ctx, item.EntityType, item.EntityID)
		}

		if processErr != nil {
			errMsg := processErr.Error()
			s.syncRepo.UpdateItemStatus(ctx, item.ID, "failed", &errMsg)
			result.Failed++
			result.Errors = append(result.Errors, errMsg)
		} else {
			s.syncRepo.UpdateItemStatus(ctx, item.ID, "completed", nil)
			result.Processed++
		}
	}

	return result, nil
}
