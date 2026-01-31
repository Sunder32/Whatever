package handlers

import (
	"net/http"

	"diagram-app/backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ExportHandler struct {
	pythonClient *services.PythonServiceClient
}

func NewExportHandler(pythonClient *services.PythonServiceClient) *ExportHandler {
	return &ExportHandler{pythonClient: pythonClient}
}

type ExportRequest struct {
	Format      string                 `json:"format" binding:"required,oneof=png svg pdf"`
	Width       int                    `json:"width"`
	Height      int                    `json:"height"`
	DPI         int                    `json:"dpi"`
	Content     map[string]interface{} `json:"content" binding:"required"`
	CanvasState map[string]interface{} `json:"canvas_state"`
}

// Export handles diagram export requests
func (h *ExportHandler) Export(c *gin.Context) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Set defaults
	if req.Width == 0 {
		req.Width = 1920
	}
	if req.Height == 0 {
		req.Height = 1080
	}
	if req.DPI == 0 {
		req.DPI = 150
	}

	result, err := h.pythonClient.Export(c.Request.Context(), &services.ExportRequest{
		Format:      req.Format,
		Width:       req.Width,
		Height:      req.Height,
		DPI:         req.DPI,
		Content:     req.Content,
		CanvasState: req.CanvasState,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	if !result.Success {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   result.Error,
		})
		return
	}

	// Return binary data with appropriate content type
	c.Header("Content-Disposition", "attachment")
	c.Data(http.StatusOK, result.MimeType, result.Data)
}

type LayoutRequest struct {
	Algorithm string                 `json:"algorithm" binding:"required,oneof=force hierarchical circular grid"`
	Nodes     []services.LayoutNode  `json:"nodes" binding:"required"`
	Edges     []services.LayoutEdge  `json:"edges"`
	Options   map[string]interface{} `json:"options"`
}

// AutoLayout handles automatic layout requests
func (h *ExportHandler) AutoLayout(c *gin.Context) {
	var req LayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	result, err := h.pythonClient.AutoLayout(c.Request.Context(), &services.LayoutRequest{
		Algorithm: req.Algorithm,
		Nodes:     req.Nodes,
		Edges:     req.Edges,
		Options:   req.Options,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

type EncryptRequest struct {
	Data     string `json:"data" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

// Encrypt handles encryption requests
func (h *ExportHandler) Encrypt(c *gin.Context) {
	var req EncryptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	result, err := h.pythonClient.Encrypt(c.Request.Context(), &services.EncryptRequest{
		Data:     req.Data,
		Password: req.Password,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

type DecryptRequest struct {
	EncryptedData string `json:"encrypted_data" binding:"required"`
	Password      string `json:"password" binding:"required"`
	IV            string `json:"iv" binding:"required"`
}

// Decrypt handles decryption requests
func (h *ExportHandler) Decrypt(c *gin.Context) {
	var req DecryptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	result, err := h.pythonClient.Decrypt(c.Request.Context(), &services.DecryptRequest{
		EncryptedData: req.EncryptedData,
		Password:      req.Password,
		IV:            req.IV,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// PythonServiceHealth checks Python service availability
func (h *ExportHandler) PythonServiceHealth(c *gin.Context) {
	if err := h.pythonClient.HealthCheck(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"status":  "unavailable",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  "healthy",
	})
}
