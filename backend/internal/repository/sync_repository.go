package repository

import (
	"context"
	"encoding/json"
	"time"

	"diagram-app/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SyncRepository struct {
	pool *pgxpool.Pool
}

func NewSyncRepository(pool *pgxpool.Pool) *SyncRepository {
	return &SyncRepository{pool: pool}
}

func (r *SyncRepository) CreateQueueItem(ctx context.Context, item *models.SyncQueueItem) error {
	item.ID = uuid.New()
	item.CreatedAt = time.Now()
	item.Status = "pending"
	item.RetryCount = 0
	if item.MaxRetries == 0 {
		item.MaxRetries = 3
	}

	operationDataJSON, err := json.Marshal(item.OperationData)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(item.Metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO sync_queue (
			id, user_id, operation_type, entity_type, entity_id, operation_data,
			status, retry_count, max_retries, created_at, priority, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err = r.pool.Exec(ctx, query,
		item.ID,
		item.UserID,
		item.OperationType,
		item.EntityType,
		item.EntityID,
		operationDataJSON,
		item.Status,
		item.RetryCount,
		item.MaxRetries,
		item.CreatedAt,
		item.Priority,
		metadataJSON,
	)

	return err
}

func (r *SyncRepository) GetPendingItems(ctx context.Context, userID uuid.UUID, limit int) ([]*models.SyncQueueItem, error) {
	query := `
		SELECT id, user_id, operation_type, entity_type, entity_id, operation_data,
			   status, retry_count, max_retries, created_at, processed_at, error_message,
			   priority, metadata
		FROM sync_queue
		WHERE user_id = $1 AND status = 'pending'
		ORDER BY priority DESC, created_at ASC
		LIMIT $2
	`

	rows, err := r.pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*models.SyncQueueItem
	for rows.Next() {
		var item models.SyncQueueItem
		var operationDataJSON, metadataJSON []byte

		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.OperationType,
			&item.EntityType,
			&item.EntityID,
			&operationDataJSON,
			&item.Status,
			&item.RetryCount,
			&item.MaxRetries,
			&item.CreatedAt,
			&item.ProcessedAt,
			&item.ErrorMessage,
			&item.Priority,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(operationDataJSON, &item.OperationData); err != nil {
			item.OperationData = make(map[string]interface{})
		}
		if err := json.Unmarshal(metadataJSON, &item.Metadata); err != nil {
			item.Metadata = make(map[string]interface{})
		}

		items = append(items, &item)
	}

	return items, nil
}

func (r *SyncRepository) UpdateItemStatus(ctx context.Context, id uuid.UUID, status string, errorMessage *string) error {
	now := time.Now()
	query := `
		UPDATE sync_queue SET
			status = $2,
			processed_at = $3,
			error_message = $4,
			retry_count = retry_count + 1
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, id, status, now, errorMessage)
	return err
}

func (r *SyncRepository) DeleteProcessedItems(ctx context.Context, userID uuid.UUID) error {
	query := `DELETE FROM sync_queue WHERE user_id = $1 AND status = 'completed'`
	_, err := r.pool.Exec(ctx, query, userID)
	return err
}

func (r *SyncRepository) GetQueueStatus(ctx context.Context, userID uuid.UUID) (map[string]int, error) {
	query := `
		SELECT status, COUNT(*) as count
		FROM sync_queue
		WHERE user_id = $1
		GROUP BY status
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	status := make(map[string]int)
	for rows.Next() {
		var s string
		var count int
		if err := rows.Scan(&s, &count); err != nil {
			return nil, err
		}
		status[s] = count
	}

	return status, nil
}

func (r *SyncRepository) GetChangedSchemas(ctx context.Context, userID uuid.UUID, since time.Time) ([]*models.Schema, error) {
	query := `
		SELECT s.id, s.project_id, s.name, s.file_name, s.content, s.content_hash,
			   s.file_size, s.format_version, s.canvas_state,
			   s.created_at, s.updated_at, s.metadata
		FROM schemas s
		JOIN projects p ON s.project_id = p.id
		LEFT JOIN collaborators c ON p.id = c.project_id
		WHERE (p.owner_id = $1 OR c.user_id = $1)
		  AND s.updated_at > $2
		ORDER BY s.updated_at ASC
	`

	rows, err := r.pool.Query(ctx, query, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []*models.Schema
	for rows.Next() {
		var schema models.Schema
		var contentJSON, canvasStateJSON, metadataJSON []byte

		err := rows.Scan(
			&schema.ID,
			&schema.ProjectID,
			&schema.Name,
			&schema.FileName,
			&contentJSON,
			&schema.ContentHash,
			&schema.FileSize,
			&schema.FormatVersion,
			&canvasStateJSON,
			&schema.CreatedAt,
			&schema.UpdatedAt,
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

		schemas = append(schemas, &schema)
	}

	return schemas, nil
}

func (r *SyncRepository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	log.ID = uuid.New()
	log.CreatedAt = time.Now()

	oldValuesJSON, err := json.Marshal(log.OldValues)
	if err != nil {
		return err
	}

	newValuesJSON, err := json.Marshal(log.NewValues)
	if err != nil {
		return err
	}

	deviceInfoJSON, err := json.Marshal(log.DeviceInfo)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(log.Metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO audit_log (
			id, user_id, action, entity_type, entity_id, old_values, new_values,
			ip_address, user_agent, device_info, created_at, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err = r.pool.Exec(ctx, query,
		log.ID,
		log.UserID,
		log.Action,
		log.EntityType,
		log.EntityID,
		oldValuesJSON,
		newValuesJSON,
		log.IPAddress,
		log.UserAgent,
		deviceInfoJSON,
		log.CreatedAt,
		metadataJSON,
	)

	return err
}
