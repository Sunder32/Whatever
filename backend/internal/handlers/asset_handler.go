package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AssetHandler struct {
	pool *pgxpool.Pool
}

func NewAssetHandler(pool *pgxpool.Pool) *AssetHandler {
	return &AssetHandler{pool: pool}
}

// Upload handles POST /api/v1/assets — upload a new asset
func (h *AssetHandler) Upload(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}
	_ = userID

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "File is required"})
		return
	}
	defer file.Close()

	schemaIDStr := c.PostForm("schemaId")
	var schemaID *uuid.UUID
	if schemaIDStr != "" {
		parsed, err := uuid.Parse(schemaIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid schemaId"})
			return
		}
		schemaID = &parsed
	}

	// Limit reading to 10MB + 1 byte to detect oversized uploads without exhausting memory
	const maxSize = 10 * 1024 * 1024
	limitedReader := io.LimitReader(file, maxSize+1)
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to read file"})
		return
	}

	// Validate size (max 10MB)
	if len(data) > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "File too large (max 10MB)"})
		return
	}

	// Validate MIME type — use server-side detection only, never trust client header
	mimeType := http.DetectContentType(data)
	allowedMIME := map[string]bool{
		"image/png":     true,
		"image/jpeg":    true,
		"image/gif":     true,
		"image/webp":    true,
		"image/svg+xml": true,
	}
	// SVG is detected as text/xml by http.DetectContentType, check file extension
	if mimeType == "text/xml" || mimeType == "text/plain" {
		if strings.HasSuffix(strings.ToLower(header.Filename), ".svg") {
			mimeType = "image/svg+xml"
		}
	}
	if !allowedMIME[mimeType] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Unsupported file type: " + mimeType})
		return
	}

	// Compute content hash for dedup
	hashBytes := sha256.Sum256(data)
	contentHash := hex.EncodeToString(hashBytes[:])

	// Check for duplicate by hash
	var existingID uuid.UUID
	err = h.pool.QueryRow(c.Request.Context(),
		`SELECT id FROM assets WHERE content_hash = $1 AND deleted_at IS NULL LIMIT 1`,
		contentHash,
	).Scan(&existingID)
	if err == nil {
		// Already exists — return existing
		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"id":           existingID,
			"deduplicated": true,
		})
		return
	}

	id := uuid.New()
	now := time.Now()

	// Sanitize file name to prevent header injection
	safeFileName := strings.Map(func(r rune) rune {
		if r == '"' || r == '\\' || r == '\n' || r == '\r' {
			return '_'
		}
		return r
	}, header.Filename)

	_, err = h.pool.Exec(c.Request.Context(),
		`INSERT INTO assets (id, schema_id, name, file_name, file_path, file_type, file_size,
			mime_type, data, storage_type, content_hash, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		id,
		schemaID,
		safeFileName,
		safeFileName,
		"", // file_path empty for DB storage
		mimeType,
		len(data),
		mimeType,
		data,
		"database",
		contentHash,
		"{}",
		now,
		now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save asset"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"asset": gin.H{
			"id":          id,
			"fileName":    safeFileName,
			"mimeType":    mimeType,
			"fileSize":    len(data),
			"contentHash": contentHash,
			"storageType": "database",
			"createdAt":   now,
		},
	})
}

// GetByID handles GET /api/v1/assets/:id — return asset data
func (h *AssetHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid asset ID"})
		return
	}

	var fileName, mimeType string
	var data []byte
	var storageURL *string

	err = h.pool.QueryRow(c.Request.Context(),
		`SELECT name, mime_type, data, storage_url FROM assets WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&fileName, &mimeType, &data, &storageURL)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Asset not found"})
		return
	}

	// If stored externally, redirect
	if storageURL != nil && *storageURL != "" {
		c.Redirect(http.StatusFound, *storageURL)
		return
	}

	if data == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Asset data not available"})
		return
	}

	// Sanitize filename for Content-Disposition header
	safeName := strings.Map(func(r rune) rune {
		if r == '"' || r == '\\' || r == '\n' || r == '\r' {
			return '_'
		}
		return r
	}, fileName)
	c.Header("Content-Disposition", "inline; filename=\""+safeName+"\"")
	c.Data(http.StatusOK, mimeType, data)
}

// Delete handles DELETE /api/v1/assets/:id — soft-delete an asset
func (h *AssetHandler) Delete(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid asset ID"})
		return
	}

	// Only the uploader can delete their asset
	var uploadedBy uuid.UUID
	err = h.pool.QueryRow(c.Request.Context(),
		`SELECT uploaded_by FROM assets WHERE id = $1 AND deleted_at IS NULL`, id,
	).Scan(&uploadedBy)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Asset not found"})
		return
	}
	if fmt.Sprint(userID) != uploadedBy.String() {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "You can only delete your own assets"})
		return
	}

	tag, err := h.pool.Exec(c.Request.Context(),
		`UPDATE assets SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to delete asset"})
		return
	}

	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Asset not found or already deleted"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
