package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"diagram-app/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserHandler struct {
	userRepo *repository.UserRepository
}

func NewUserHandler(userRepo *repository.UserRepository) *UserHandler {
	return &UserHandler{
		userRepo: userRepo,
	}
}

type UserResponse struct {
	ID        string  `json:"id"`
	Username  string  `json:"username"`
	FullName  string  `json:"fullName"`
	Email     string  `json:"email,omitempty"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
	Bio       *string `json:"bio,omitempty"`
}

type UserProfileResponse struct {
	ID             string  `json:"id"`
	Username       string  `json:"username"`
	FullName       string  `json:"fullName"`
	Email          string  `json:"email,omitempty"`
	AvatarURL      *string `json:"avatarUrl,omitempty"`
	Bio            *string `json:"bio,omitempty"`
	ProjectsCount  int     `json:"projectsCount"`
	FollowersCount int     `json:"followersCount"`
	FollowingCount int     `json:"followingCount"`
	IsFollowing    bool    `json:"isFollowing,omitempty"`
}

// UpdateProfile godoc
// @Summary Update user profile
// @Description Update user profile including avatar upload
// @Tags users
// @Accept multipart/form-data
// @Produce json
// @Param avatar formData file false "Avatar image file"
// @Param fullName formData string false "Full name"
// @Success 200 {object} map[string]interface{}
// @Router /auth/profile [put]
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Unauthorized"})
		return
	}
	userID := userIDValue.(uuid.UUID)

	// Get current user
	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "User not found"})
		return
	}

	// Check content type - support both JSON and multipart
	contentType := c.ContentType()

	if contentType == "application/json" {
		// Handle JSON request (for non-avatar updates)
		var req struct {
			FullName    string                 `json:"fullName"`
			Preferences map[string]interface{} `json:"preferences"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			if req.FullName != "" {
				user.Name = req.FullName
			}
			if req.Preferences != nil {
				user.Settings = req.Preferences
			}
		}
	} else {
		// Handle multipart form (for avatar upload)
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
			// Not a multipart form, try to read form values anyway
		}

		if fullName := c.PostForm("fullName"); fullName != "" {
			user.Name = fullName
		}

		// Handle Avatar Upload
		file, header, err := c.Request.FormFile("avatar")
		if err == nil {
			defer file.Close()

			// Create uploads directory if not exists
			uploadDir := "./uploads/avatars"
			if err := os.MkdirAll(uploadDir, 0755); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create upload directory"})
				return
			}

			// Validate file type
			allowedTypes := map[string]bool{
				".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
			}
			ext := filepath.Ext(header.Filename)
			if ext == "" {
				ext = ".jpg"
			}
			if !allowedTypes[ext] {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid file type"})
				return
			}

			// Generate unique filename
			filename := fmt.Sprintf("%s_%d%s", userID.String(), time.Now().Unix(), ext)
			savePath := filepath.Join(uploadDir, filename)

			// Save file
			dst, err := os.Create(savePath)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save file"})
				return
			}
			defer dst.Close()

			if _, err := io.Copy(dst, file); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to write file"})
				return
			}

			// Set avatar URL
			avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)
			user.Avatar = &avatarURL
		}
	}

	// Update user in database
	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":          user.ID.String(),
			"username":    user.Name,
			"email":       user.Email,
			"fullName":    user.Name,
			"avatarUrl":   user.Avatar,
			"preferences": user.Settings,
			"updatedAt":   user.UpdatedAt,
		},
	})
}

// Search godoc
// @Summary Search users
// @Description Search for users by name or email
// @Tags users
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Param limit query int false "Maximum number of results"
// @Success 200 {object} map[string]interface{}
// @Router /users/search [get]
func (h *UserHandler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    []UserResponse{},
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	users, err := h.userRepo.Search(c.Request.Context(), query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to search users",
		})
		return
	}

	response := make([]UserResponse, 0, len(users))
	for _, user := range users {
		response = append(response, UserResponse{
			ID:        user.ID.String(),
			Username:  user.Name,
			FullName:  user.Name,
			AvatarURL: user.Avatar,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// GetSuggested godoc
// @Summary Get suggested users
// @Description Get a list of suggested users to follow
// @Tags users
// @Accept json
// @Produce json
// @Param limit query int false "Maximum number of results"
// @Success 200 {object} map[string]interface{}
// @Router /users/suggested [get]
func (h *UserHandler) GetSuggested(c *gin.Context) {
	// Get current user from context
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	// userID is already uuid.UUID from middleware
	userID, ok := userIDValue.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID",
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, _ := strconv.Atoi(limitStr)

	users, err := h.userRepo.GetSuggested(c.Request.Context(), userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get suggested users",
		})
		return
	}

	response := make([]UserResponse, 0, len(users))
	for _, user := range users {
		response = append(response, UserResponse{
			ID:        user.ID.String(),
			Username:  user.Name,
			FullName:  user.Name,
			AvatarURL: user.Avatar,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// GetByID godoc
// @Summary Get user by ID
// @Description Get a user by their ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} map[string]interface{}
// @Router /users/{id} [get]
func (h *UserHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID",
		})
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	// Get followers count
	followersCount, err := h.userRepo.GetFollowersCount(c.Request.Context(), userID)
	if err != nil {
		followersCount = 0
	}

	// Get following count
	followingCount, err := h.userRepo.GetFollowingCount(c.Request.Context(), userID)
	if err != nil {
		followingCount = 0
	}

	// Check if current user follows this user
	isFollowing := false
	if currentUserID, exists := c.Get("userID"); exists {
		isFollowing, _ = h.userRepo.IsFollowing(c.Request.Context(), currentUserID.(uuid.UUID), userID)
	}

	response := UserProfileResponse{
		ID:             user.ID.String(),
		Username:       user.Name,
		FullName:       user.Name,
		AvatarURL:      user.Avatar,
		ProjectsCount:  0, // TODO: Add project count
		FollowersCount: followersCount,
		FollowingCount: followingCount,
		IsFollowing:    isFollowing,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// Follow godoc
// @Summary Follow a user
// @Description Follow another user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID to follow"
// @Success 200 {object} map[string]interface{}
// @Router /users/{id}/follow [post]
func (h *UserHandler) Follow(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	targetUserIDStr := c.Param("id")
	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID",
		})
		return
	}

	// Prevent self-follow
	if currentUserID.(uuid.UUID) == targetUserID {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Cannot follow yourself",
		})
		return
	}

	err = h.userRepo.FollowUser(c.Request.Context(), currentUserID.(uuid.UUID), targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to follow user",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Followed successfully",
	})
}

// Unfollow godoc
// @Summary Unfollow a user
// @Description Unfollow a user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID to unfollow"
// @Success 200 {object} map[string]interface{}
// @Router /users/{id}/follow [delete]
func (h *UserHandler) Unfollow(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	targetUserIDStr := c.Param("id")
	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID",
		})
		return
	}

	err = h.userRepo.UnfollowUser(c.Request.Context(), currentUserID.(uuid.UUID), targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to unfollow user",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Unfollowed successfully",
	})
}

// GetUserProjects godoc
// @Summary Get user's public projects
// @Description Get a list of user's public projects
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} map[string]interface{}
// @Router /users/{id}/projects [get]
func (h *UserHandler) GetUserProjects(c *gin.Context) {
	// Return empty projects for now
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"projects": []interface{}{},
			"total":    0,
		},
	})
}

// GetFollowers godoc
// @Summary Get user's followers
// @Description Get a list of user's followers
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param page query int false "Page number"
// @Param limit query int false "Results per page"
// @Success 200 {object} map[string]interface{}
// @Router /users/{id}/followers [get]
func (h *UserHandler) GetFollowers(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	users, total, err := h.userRepo.GetFollowers(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get followers",
		})
		return
	}

	userResponses := make([]UserResponse, 0, len(users))
	for _, u := range users {
		userResponses = append(userResponses, UserResponse{
			ID:        u.ID.String(),
			Username:  u.Name,
			FullName:  u.Name,
			AvatarURL: u.Avatar,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"users": userResponses,
			"total": total,
		},
	})
}

// GetFollowing godoc
// @Summary Get users that user is following
// @Description Get a list of users that user is following
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param page query int false "Page number"
// @Param limit query int false "Results per page"
// @Success 200 {object} map[string]interface{}
// @Router /users/{id}/following [get]
func (h *UserHandler) GetFollowing(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	users, total, err := h.userRepo.GetFollowing(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get following",
		})
		return
	}

	userResponses := make([]UserResponse, 0, len(users))
	for _, u := range users {
		userResponses = append(userResponses, UserResponse{
			ID:        u.ID.String(),
			Username:  u.Name,
			FullName:  u.Name,
			AvatarURL: u.Avatar,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"users": userResponses,
			"total": total,
		},
	})
}
