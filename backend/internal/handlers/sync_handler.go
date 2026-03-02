package handlers

import (
	"net/http"
	"time"

	"diagram-app/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SyncHandler struct {
	syncService *services.SyncService
}

type PullRequest struct {
	Since time.Time `json:"since"`
}

type PushRequest struct {
	Operations []map[string]interface{} `json:"operations" binding:"required"`
}

type QueueOperationRequest struct {
	Type       string                 `json:"type" binding:"required,oneof=create update delete"`
	EntityType string                 `json:"entityType" binding:"required"`
	EntityID   string                 `json:"entityId" binding:"required"`
	Data       map[string]interface{} `json:"data"`
	Priority   int                    `json:"priority"`
}

type DetectConflictsRequest struct {
	Hashes map[string]string `json:"hashes" binding:"required"`
}

type ResolveConflictRequest struct {
	SchemaID      string                 `json:"schemaId"`
	EntityID      string                 `json:"entityId"` // Frontend sends entityId
	Resolution    string                 `json:"resolution" binding:"required,oneof=keep_local keep_remote merge client server"`
	MergedContent map[string]interface{} `json:"mergedContent"`
	MergedData    map[string]interface{} `json:"mergedData"` // Frontend sends mergedData
}

func NewSyncHandler(syncService *services.SyncService) *SyncHandler {
	return &SyncHandler{
		syncService: syncService,
	}
}

func (h *SyncHandler) Pull(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req PullRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Since = time.Time{}
	}

	result, err := h.syncService.Pull(c.Request.Context(), userID.(uuid.UUID), req.Since)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to pull changes: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func (h *SyncHandler) Push(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req PushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	result, err := h.syncService.Push(c.Request.Context(), userID.(uuid.UUID), req.Operations)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to push changes: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func (h *SyncHandler) GetStatus(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	status, err := h.syncService.GetStatus(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get sync status",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

func (h *SyncHandler) QueueOperation(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req QueueOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	entityID, err := uuid.Parse(req.EntityID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid entity ID",
		})
		return
	}

	priority := req.Priority
	if priority == 0 {
		priority = 5
	}

	err = h.syncService.QueueOperation(
		c.Request.Context(),
		userID.(uuid.UUID),
		req.Type,
		req.EntityType,
		entityID,
		req.Data,
		priority,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to queue operation",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Operation queued successfully",
	})
}

func (h *SyncHandler) ProcessQueue(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	batchSize := 50

	result, err := h.syncService.ProcessQueue(c.Request.Context(), userID.(uuid.UUID), batchSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process queue",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func (h *SyncHandler) DetectConflicts(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req DetectConflictsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	conflicts, err := h.syncService.DetectConflicts(c.Request.Context(), userID.(uuid.UUID), req.Hashes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to detect conflicts",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"hasConflicts": len(conflicts) > 0,
		"data":         conflicts,
	})
}

func (h *SyncHandler) ResolveConflict(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req ResolveConflictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	schemaIDStr := req.SchemaID
	if schemaIDStr == "" {
		schemaIDStr = req.EntityID // Support frontend field name
	}
	if schemaIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "schemaId or entityId is required",
		})
		return
	}

	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	// Map frontend resolution values to backend ones
	resolution := req.Resolution
	switch resolution {
	case "client":
		resolution = "keep_local"
	case "server":
		resolution = "keep_remote"
	}

	mergedContent := req.MergedContent
	if mergedContent == nil {
		mergedContent = req.MergedData // Support frontend field name
	}

	err = h.syncService.ResolveConflict(c.Request.Context(), schemaID, resolution, mergedContent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to resolve conflict",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Conflict resolved successfully",
	})
}

func (h *SyncHandler) FullSync(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	pullResult, err := h.syncService.Pull(c.Request.Context(), userID.(uuid.UUID), time.Time{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to pull changes",
		})
		return
	}

	pushResult, err := h.syncService.ProcessQueue(c.Request.Context(), userID.(uuid.UUID), 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to push changes",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"pulled": pullResult,
			"pushed": pushResult,
		},
	})
}
