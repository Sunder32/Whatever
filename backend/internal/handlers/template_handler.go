package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TemplateHandler struct {
	pool *pgxpool.Pool
}

func NewTemplateHandler(pool *pgxpool.Pool) *TemplateHandler {
	return &TemplateHandler{pool: pool}
}

type Template struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Content     map[string]interface{} `json:"content"`
	Tags        []string               `json:"tags"`
	UsageCount  int                    `json:"usageCount"`
	IsPublic    bool                   `json:"isPublic"`
}

// List returns all public templates
func (h *TemplateHandler) List(c *gin.Context) {
	category := c.Query("category")

	query := `
		SELECT id, name, description, category, content, tags, usage_count, is_public
		FROM templates
		WHERE is_public = true
	`
	args := []interface{}{}

	if category != "" {
		query += " AND category = $1"
		args = append(args, category)
	}

	query += " ORDER BY usage_count DESC, name ASC"

	rows, err := h.pool.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch templates",
		})
		return
	}
	defer rows.Close()

	templates := []Template{}
	for rows.Next() {
		var t Template
		var id uuid.UUID
		if err := rows.Scan(&id, &t.Name, &t.Description, &t.Category, &t.Content, &t.Tags, &t.UsageCount, &t.IsPublic); err != nil {
			continue
		}
		t.ID = id.String()
		templates = append(templates, t)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    templates,
	})
}

// GetByID returns a specific template
func (h *TemplateHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid template ID",
		})
		return
	}

	var t Template
	err = h.pool.QueryRow(c.Request.Context(), `
		SELECT id, name, description, category, content, tags, usage_count, is_public
		FROM templates
		WHERE id = $1 AND is_public = true
	`, id).Scan(&id, &t.Name, &t.Description, &t.Category, &t.Content, &t.Tags, &t.UsageCount, &t.IsPublic)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Template not found",
		})
		return
	}

	t.ID = id.String()

	// Increment usage count
	_, _ = h.pool.Exec(c.Request.Context(), `
		UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1
	`, id)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    t,
	})
}

// GetCategories returns all available template categories
func (h *TemplateHandler) GetCategories(c *gin.Context) {
	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT DISTINCT category FROM templates WHERE is_public = true ORDER BY category
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch categories",
		})
		return
	}
	defer rows.Close()

	categories := []string{}
	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err != nil {
			continue
		}
		categories = append(categories, cat)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    categories,
	})
}
