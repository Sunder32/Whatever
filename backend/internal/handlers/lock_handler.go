package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LockHandler struct {
	pool *pgxpool.Pool
}

func NewLockHandler(pool *pgxpool.Pool) *LockHandler {
	return &LockHandler{pool: pool}
}

type CreateLockRequest struct {
	ElementID string `json:"elementId" binding:"required"`
	LockType  string `json:"lockType"` // edit, move, delete
}

// GetLocks handles GET /api/v1/schemas/:id/locks — list active locks for a schema
func (h *LockHandler) GetLocks(c *gin.Context) {
	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid schema ID"})
		return
	}

	// Clean up expired locks first
	_, _ = h.pool.Exec(c.Request.Context(),
		`DELETE FROM schema_locks WHERE expires_at < NOW()`,
	)

	rows, err := h.pool.Query(c.Request.Context(),
		`SELECT sl.id, sl.schema_id, sl.element_id, sl.locked_by, sl.lock_type,
				sl.locked_at, sl.expires_at, u.name AS user_name
		FROM schema_locks sl
		LEFT JOIN users u ON u.id = sl.locked_by
		WHERE sl.schema_id = $1 AND sl.expires_at > NOW()
		ORDER BY sl.locked_at DESC`,
		schemaID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get locks"})
		return
	}
	defer rows.Close()

	type lockResponse struct {
		ID        uuid.UUID `json:"id"`
		SchemaID  uuid.UUID `json:"schemaId"`
		ElementID string    `json:"elementId"`
		LockedBy  uuid.UUID `json:"lockedBy"`
		LockType  string    `json:"lockType"`
		LockedAt  time.Time `json:"lockedAt"`
		ExpiresAt time.Time `json:"expiresAt"`
		UserName  string    `json:"userName"`
	}

	locks := []lockResponse{}
	for rows.Next() {
		var l lockResponse
		if err := rows.Scan(&l.ID, &l.SchemaID, &l.ElementID, &l.LockedBy,
			&l.LockType, &l.LockedAt, &l.ExpiresAt, &l.UserName); err != nil {
			continue
		}
		locks = append(locks, l)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"locks":   locks,
	})
}

// CreateLock handles POST /api/v1/schemas/:id/locks — lock an element
func (h *LockHandler) CreateLock(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid schema ID"})
		return
	}

	var req CreateLockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	lockType := req.LockType
	if lockType == "" {
		lockType = "edit"
	}

	// Clean expired locks
	_, _ = h.pool.Exec(c.Request.Context(),
		`DELETE FROM schema_locks WHERE expires_at < NOW()`,
	)

	// Check if element is already locked by another user
	var existingLockedBy uuid.UUID
	err = h.pool.QueryRow(c.Request.Context(),
		`SELECT locked_by FROM schema_locks
		WHERE schema_id = $1 AND element_id = $2 AND expires_at > NOW()`,
		schemaID, req.ElementID,
	).Scan(&existingLockedBy)

	if err == nil {
		// Lock exists
		if existingLockedBy != userID.(uuid.UUID) {
			c.JSON(http.StatusConflict, gin.H{
				"success":  false,
				"error":    "Element is already locked by another user",
				"lockedBy": existingLockedBy,
			})
			return
		}
		// Same user — extend the lock
		_, err = h.pool.Exec(c.Request.Context(),
			`UPDATE schema_locks SET expires_at = $1, lock_type = $2, updated_at = NOW()
			WHERE schema_id = $3 AND element_id = $4`,
			time.Now().Add(5*time.Minute), lockType, schemaID, req.ElementID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to extend lock"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Lock extended"})
		return
	}

	// Create new lock
	lockID := uuid.New()
	now := time.Now()
	expiresAt := now.Add(5 * time.Minute)

	_, err = h.pool.Exec(c.Request.Context(),
		`INSERT INTO schema_locks (id, schema_id, element_id, user_id, locked_by, lock_type, locked_at, expires_at, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', $9, $10)`,
		lockID, schemaID, req.ElementID, userID.(uuid.UUID), userID.(uuid.UUID),
		lockType, now, expiresAt, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create lock: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"lock": gin.H{
			"id":        lockID,
			"schemaId":  schemaID,
			"elementId": req.ElementID,
			"lockedBy":  userID,
			"lockType":  lockType,
			"lockedAt":  now,
			"expiresAt": expiresAt,
		},
	})
}

// DeleteLock handles DELETE /api/v1/schemas/:id/locks/:lockId — unlock an element
func (h *LockHandler) DeleteLock(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	lockIDStr := c.Param("lockId")
	lockID, err := uuid.Parse(lockIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid lock ID"})
		return
	}

	// Only the user who created the lock can delete it (or admin)
	var lockedBy uuid.UUID
	err = h.pool.QueryRow(c.Request.Context(),
		`SELECT locked_by FROM schema_locks WHERE id = $1`,
		lockID,
	).Scan(&lockedBy)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Lock not found"})
		return
	}

	if lockedBy != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Cannot unlock another user's lock"})
		return
	}

	_, err = h.pool.Exec(c.Request.Context(),
		`DELETE FROM schema_locks WHERE id = $1`,
		lockID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to delete lock"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
