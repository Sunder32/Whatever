package handlers

import (
	"net/http"
	"os"
	"strings"

	"diagram-app/backend/internal/repository"
	"diagram-app/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Cookie configuration
const (
	refreshTokenCookieName = "refresh_token"
	refreshTokenMaxAge     = 7 * 24 * 60 * 60 // 7 days in seconds
)

type AuthHandler struct {
	authService *services.AuthService
	userRepo    *repository.UserRepository
	projectRepo *repository.ProjectRepository
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"fullName" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=8"`
}

type UpdateProfileRequest struct {
	FullName    string                 `json:"fullName"`
	AvatarURL   string                 `json:"avatarUrl"`
	Preferences map[string]interface{} `json:"preferences"`
}

func NewAuthHandler(authService *services.AuthService, userRepo *repository.UserRepository, projectRepo *repository.ProjectRepository) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		userRepo:    userRepo,
		projectRepo: projectRepo,
	}
}

// setRefreshTokenCookie sets the refresh token as an HttpOnly cookie
func setRefreshTokenCookie(c *gin.Context, refreshToken string) {
	// Determine if we're in production (use Secure flag)
	secure := os.Getenv("ENVIRONMENT") == "production" || strings.HasPrefix(c.Request.Host, "https")

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		refreshTokenCookieName,
		refreshToken,
		refreshTokenMaxAge,
		"/api/v1/auth", // Path restricted to auth endpoints
		"",             // Domain (empty = current domain)
		secure,         // Secure (HTTPS only in production)
		true,           // HttpOnly
	)
}

// clearRefreshTokenCookie clears the refresh token cookie
func clearRefreshTokenCookie(c *gin.Context) {
	secure := os.Getenv("ENVIRONMENT") == "production" || strings.HasPrefix(c.Request.Host, "https")

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		refreshTokenCookieName,
		"",
		-1, // Negative MaxAge = delete cookie
		"/api/v1/auth",
		"",
		secure,
		true,
	)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	user, tokens, err := h.authService.Register(c.Request.Context(), req.Username, req.Email, req.Password, req.FullName)
	if err != nil {
		status := http.StatusBadRequest
		if err == services.ErrUserExists {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Set refresh token as HttpOnly cookie BEFORE writing response body
	setRefreshTokenCookie(c, tokens.RefreshToken)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"user": gin.H{
				"id":       user.ID,
				"username": user.Name,
				"email":    user.Email,
				"fullName": user.Name,
			},
			"tokens": gin.H{
				"accessToken": tokens.AccessToken,
				"expiresAt":   tokens.ExpiresAt,
			},
		},
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	user, tokens, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid credentials",
		})
		return
	}

	// Set refresh token as HttpOnly cookie BEFORE writing response body
	setRefreshTokenCookie(c, tokens.RefreshToken)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user": gin.H{
				"id":          user.ID,
				"username":    user.Name,
				"email":       user.Email,
				"fullName":    user.Name,
				"avatarUrl":   user.Avatar,
				"preferences": user.Settings,
				"createdAt":   user.CreatedAt,
			},
			"tokens": gin.H{
				"accessToken": tokens.AccessToken,
				"expiresAt":   tokens.ExpiresAt,
			},
		},
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Clear the refresh token cookie
	clearRefreshTokenCookie(c)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Successfully logged out",
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	// Try to get refresh token from HttpOnly cookie first
	refreshToken, err := c.Cookie(refreshTokenCookieName)
	if err != nil || refreshToken == "" {
		// Fallback to JSON body for backward compatibility
		var req RefreshRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "No refresh token provided",
			})
			return
		}
		refreshToken = req.RefreshToken
	}

	tokens, err := h.authService.RefreshToken(c.Request.Context(), refreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid refresh token",
		})
		return
	}

	// Set new refresh token as HttpOnly cookie
	setRefreshTokenCookie(c, tokens.RefreshToken)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"tokens": gin.H{
				"accessToken": tokens.AccessToken,
				"expiresAt":   tokens.ExpiresAt,
			},
		},
	})
}

func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	// Get followers count
	followersCount := 0
	if h.userRepo != nil {
		followersCount, _ = h.userRepo.GetFollowersCount(c.Request.Context(), userID.(uuid.UUID))
	}

	// Get following count
	followingCount := 0
	if h.userRepo != nil {
		followingCount, _ = h.userRepo.GetFollowingCount(c.Request.Context(), userID.(uuid.UUID))
	}

	// Get projects count
	projectsCount := 0
	if h.projectRepo != nil {
		projectsCount, _ = h.projectRepo.Count(c.Request.Context(), userID.(uuid.UUID))
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":             user.ID,
			"username":       user.Name,
			"email":          user.Email,
			"fullName":       user.Name,
			"avatarUrl":      user.Avatar,
			"preferences":    user.Settings,
			"followersCount": followersCount,
			"followingCount": followingCount,
			"projectsCount":  projectsCount,
			"createdAt":      user.CreatedAt,
			"updatedAt":      user.UpdatedAt,
		},
	})
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	// Apply updates
	if req.FullName != "" {
		user.Name = req.FullName
	}
	if req.AvatarURL != "" {
		user.Avatar = &req.AvatarURL
	}
	if req.Preferences != nil {
		user.Settings = req.Preferences
	}

	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update profile",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":          user.ID,
			"username":    user.Name,
			"email":       user.Email,
			"fullName":    user.Name,
			"avatarUrl":   user.Avatar,
			"preferences": user.Settings,
			"updatedAt":   user.UpdatedAt,
		},
	})
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Current password is incorrect",
		})
		return
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process new password",
		})
		return
	}

	user.PasswordHash = string(newHash)
	if err := h.userRepo.Update(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update password",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password changed successfully",
	})
}

func (h *AuthHandler) ValidateToken(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"valid":   false,
			"error":   "Authorization header required",
		})
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"valid":   false,
			"error":   "Invalid authorization header format",
		})
		return
	}

	claims, err := h.authService.ValidateToken(parts[1])
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"valid":   false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"valid":   true,
		"data": gin.H{
			"userId":   claims.UserID,
			"username": claims.Username,
			"email":    claims.Email,
		},
	})
}
