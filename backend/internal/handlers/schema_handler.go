package handlers

import (
	"net/http"
	"strconv"

	"diagram-app/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SchemaHandler struct {
	schemaService  *services.SchemaService
	projectService *services.ProjectService
}

type CreateSchemaRequest struct {
	ProjectID     string                 `json:"projectId" binding:"required"`
	Name          string                 `json:"name" binding:"required"`
	FileName      string                 `json:"fileName"`
	Content       map[string]interface{} `json:"content"`
	CanvasState   map[string]interface{} `json:"canvasState"`
	FormatVersion string                 `json:"formatVersion"`
}

type UpdateSchemaRequest struct {
	Name        *string                `json:"name"`
	FileName    *string                `json:"fileName"`
	Content     map[string]interface{} `json:"content"`
	CanvasState map[string]interface{} `json:"canvasState"`
}

type CreateVersionRequest struct {
	CommitMessage string `json:"commitMessage" binding:"required"`
}

func NewSchemaHandler(schemaService *services.SchemaService, projectService *services.ProjectService) *SchemaHandler {
	return &SchemaHandler{
		schemaService:  schemaService,
		projectService: projectService,
	}
}

func (h *SchemaHandler) Create(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req CreateSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid project ID",
		})
		return
	}

	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), projectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	if req.FormatVersion == "" {
		req.FormatVersion = "1.0.0"
	}
	if req.FileName == "" {
		req.FileName = req.Name + ".wtv"
	}
	if req.Content == nil {
		req.Content = make(map[string]interface{})
	}
	if req.CanvasState == nil {
		req.CanvasState = make(map[string]interface{})
	}

	schema, err := h.schemaService.Create(
		c.Request.Context(),
		projectID,
		req.Name,
		req.FileName,
		req.Content,
		req.CanvasState,
		req.FormatVersion,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create schema: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    schema,
	})
}

func (h *SchemaHandler) GetByID(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	schema, err := h.schemaService.Get(c.Request.Context(), schemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Schema not found",
		})
		return
	}

	// Check project access
	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), schema.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    schema,
	})
}

func (h *SchemaHandler) List(c *gin.Context) {
	projectIDStr := c.Query("projectId")
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "projectId is required",
		})
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid project ID",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	schemas, err := h.schemaService.ListByProject(c.Request.Context(), projectID, pageSize, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list schemas",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    schemas,
		"meta": gin.H{
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func (h *SchemaHandler) Update(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	// Check access via schema's project
	existing, err := h.schemaService.Get(c.Request.Context(), schemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Schema not found",
		})
		return
	}

	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), existing.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	var req UpdateSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	schema, err := h.schemaService.Update(
		c.Request.Context(),
		schemaID,
		req.Name,
		req.FileName,
		req.Content,
		req.CanvasState,
	)
	if err != nil {
		status := http.StatusInternalServerError
		if err == services.ErrSchemaNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    schema,
	})
}

func (h *SchemaHandler) Delete(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	// Check access via schema's project
	existing, err := h.schemaService.Get(c.Request.Context(), schemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Schema not found",
		})
		return
	}

	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), existing.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	err = h.schemaService.Delete(c.Request.Context(), schemaID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == services.ErrSchemaNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Schema deleted successfully",
	})
}

func (h *SchemaHandler) Duplicate(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	sourceSchema, err := h.schemaService.Get(c.Request.Context(), schemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Schema not found",
		})
		return
	}

	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), sourceSchema.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	newSchema, err := h.schemaService.Create(
		c.Request.Context(),
		sourceSchema.ProjectID,
		sourceSchema.Name+" (Copy)",
		sourceSchema.FileName,
		sourceSchema.Content,
		sourceSchema.CanvasState,
		sourceSchema.FormatVersion,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to duplicate schema",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    newSchema,
	})
}

func (h *SchemaHandler) GetVersions(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	// Check access via schema's project
	schema, err := h.schemaService.Get(c.Request.Context(), schemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Schema not found",
		})
		return
	}

	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), schema.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	versions, err := h.schemaService.ListVersions(c.Request.Context(), schemaID, pageSize, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get versions",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    versions,
		"meta": gin.H{
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func (h *SchemaHandler) GetVersion(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	versionIDStr := c.Param("versionId")
	versionID, err := uuid.Parse(versionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid version ID",
		})
		return
	}

	version, err := h.schemaService.GetVersion(c.Request.Context(), versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Version not found",
		})
		return
	}

	// Check access via schema's project
	schema, err := h.schemaService.Get(c.Request.Context(), version.SchemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Schema not found"})
		return
	}
	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), schema.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    version,
	})
}

func (h *SchemaHandler) CreateVersion(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	schemaIDStr := c.Param("id")
	schemaID, err := uuid.Parse(schemaIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid schema ID",
		})
		return
	}

	var req CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	version, err := h.schemaService.CreateVersion(c.Request.Context(), schemaID, userID.(uuid.UUID), req.CommitMessage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create version: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    version,
	})
}

func (h *SchemaHandler) RestoreVersion(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	versionIDStr := c.Param("versionId")
	versionID, err := uuid.Parse(versionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid version ID",
		})
		return
	}

	version, err := h.schemaService.GetVersion(c.Request.Context(), versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Version not found",
		})
		return
	}

	// Check access via schema's project
	schemaForAccess, err := h.schemaService.Get(c.Request.Context(), version.SchemaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Schema not found"})
		return
	}
	hasAccess, err := h.projectService.HasAccess(c.Request.Context(), schemaForAccess.ProjectID, userID.(uuid.UUID))
	if err != nil || !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Access denied"})
		return
	}

	schema, err := h.schemaService.Update(
		c.Request.Context(),
		version.SchemaID,
		nil,
		nil,
		version.Content,
		nil,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to restore version",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    schema,
	})
}

func (h *SchemaHandler) Search(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Search query is required",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	schemas, err := h.schemaService.Search(c.Request.Context(), userID.(uuid.UUID), query, pageSize, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Search failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    schemas,
		"meta": gin.H{
			"page":     page,
			"pageSize": pageSize,
		},
	})
}
