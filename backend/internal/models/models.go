package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	Email         string                 `json:"email" db:"email"`
	PasswordHash  string                 `json:"-" db:"password_hash"`
	Name          string                 `json:"name" db:"name"`
	Avatar        *string                `json:"avatar" db:"avatar"`
	Role          string                 `json:"role" db:"role"`
	Settings      map[string]interface{} `json:"settings" db:"settings"`
	EmailVerified bool                   `json:"emailVerified" db:"email_verified"`
	LastLoginAt   *time.Time             `json:"lastLoginAt" db:"last_login_at"`
	CreatedAt     time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time              `json:"updatedAt" db:"updated_at"`
	DeletedAt     *time.Time             `json:"deletedAt,omitempty" db:"deleted_at"`
}

// Alias fields for API compatibility
func (u *User) GetUsername() string {
	return u.Name
}

func (u *User) GetFullName() string {
	return u.Name
}

func (u *User) GetAvatarURL() *string {
	return u.Avatar
}

func (u *User) GetPreferences() map[string]interface{} {
	return u.Settings
}

type Project struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	OwnerID     uuid.UUID              `json:"ownerId" db:"owner_id"`
	Name        string                 `json:"name" db:"name"`
	Description string                 `json:"description" db:"description"`
	Settings    map[string]interface{} `json:"settings" db:"settings"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time              `json:"updatedAt" db:"updated_at"`
	IsArchived  bool                   `json:"isArchived" db:"is_archived"`
	IsPublic    bool                   `json:"isPublic" db:"is_public"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
}

type Schema struct {
	ID               uuid.UUID              `json:"id" db:"id"`
	ProjectID        uuid.UUID              `json:"projectId" db:"project_id"`
	Name             string                 `json:"name" db:"name"`
	FileName         string                 `json:"fileName" db:"file_name"`
	Content          map[string]interface{} `json:"content" db:"content"`
	ContentHash      string                 `json:"contentHash" db:"content_hash"`
	FileSize         int64                  `json:"fileSize" db:"file_size"`
	FormatVersion    string                 `json:"formatVersion" db:"format_version"`
	Thumbnail        []byte                 `json:"-" db:"thumbnail"`
	ThumbnailURL     *string                `json:"thumbnailUrl" db:"thumbnail_url"`
	CanvasState      map[string]interface{} `json:"canvasState" db:"canvas_state"`
	CreatedAt        time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time              `json:"updatedAt" db:"updated_at"`
	IsEncrypted      bool                   `json:"isEncrypted" db:"is_encrypted"`
	EncryptionMethod *string                `json:"encryptionMethod" db:"encryption_method"`
	Metadata         map[string]interface{} `json:"metadata" db:"metadata"`
}

type SchemaVersion struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	SchemaID      uuid.UUID              `json:"schemaId" db:"schema_id"`
	VersionNumber int                    `json:"versionNumber" db:"version_number"`
	Content       map[string]interface{} `json:"content" db:"content"`
	ContentHash   string                 `json:"contentHash" db:"content_hash"`
	CreatedBy     uuid.UUID              `json:"createdBy" db:"created_by"`
	CreatedAt     time.Time              `json:"createdAt" db:"created_at"`
	CommitMessage string                 `json:"commitMessage" db:"commit_message"`
	Diff          map[string]interface{} `json:"diff" db:"diff"`
	FileSize      int64                  `json:"fileSize" db:"file_size"`
	Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
}

type Asset struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	SchemaID    *uuid.UUID             `json:"schemaId" db:"schema_id"`
	FileName    string                 `json:"fileName" db:"file_name"`
	MimeType    string                 `json:"mimeType" db:"mime_type"`
	FileSize    int64                  `json:"fileSize" db:"file_size"`
	Data        []byte                 `json:"-" db:"data"`
	StorageURL  *string                `json:"storageUrl" db:"storage_url"`
	StorageType string                 `json:"storageType" db:"storage_type"`
	ContentHash string                 `json:"contentHash" db:"content_hash"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
}

type SyncQueueItem struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	UserID        uuid.UUID              `json:"userId" db:"user_id"`
	OperationType string                 `json:"operationType" db:"operation_type"`
	EntityType    string                 `json:"entityType" db:"entity_type"`
	EntityID      uuid.UUID              `json:"entityId" db:"entity_id"`
	OperationData map[string]interface{} `json:"operationData" db:"operation_data"`
	Status        string                 `json:"status" db:"status"`
	RetryCount    int                    `json:"retryCount" db:"retry_count"`
	MaxRetries    int                    `json:"maxRetries" db:"max_retries"`
	CreatedAt     time.Time              `json:"createdAt" db:"created_at"`
	ProcessedAt   *time.Time             `json:"processedAt" db:"processed_at"`
	ErrorMessage  *string                `json:"errorMessage" db:"error_message"`
	Priority      int                    `json:"priority" db:"priority"`
	Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
}

type AuditLog struct {
	ID         uuid.UUID              `json:"id" db:"id"`
	UserID     uuid.UUID              `json:"userId" db:"user_id"`
	Action     string                 `json:"action" db:"action"`
	EntityType string                 `json:"entityType" db:"entity_type"`
	EntityID   uuid.UUID              `json:"entityId" db:"entity_id"`
	OldValues  map[string]interface{} `json:"oldValues" db:"old_values"`
	NewValues  map[string]interface{} `json:"newValues" db:"new_values"`
	IPAddress  string                 `json:"ipAddress" db:"ip_address"`
	UserAgent  string                 `json:"userAgent" db:"user_agent"`
	DeviceInfo map[string]interface{} `json:"deviceInfo" db:"device_info"`
	CreatedAt  time.Time              `json:"createdAt" db:"created_at"`
	Metadata   map[string]interface{} `json:"metadata" db:"metadata"`
}

type Collaborator struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	ProjectID   uuid.UUID       `json:"projectId" db:"project_id"`
	UserID      uuid.UUID       `json:"userId" db:"user_id"`
	Role        string          `json:"role" db:"role"`
	Permissions map[string]bool `json:"permissions" db:"permissions"`
	CreatedAt   time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time       `json:"updatedAt" db:"updated_at"`
	InvitedBy   uuid.UUID       `json:"invitedBy" db:"invited_by"`
	AcceptedAt  *time.Time      `json:"acceptedAt" db:"accepted_at"`
}

type Session struct {
	ID             uuid.UUID              `json:"id" db:"id"`
	UserID         uuid.UUID              `json:"userId" db:"user_id"`
	Token          string                 `json:"token" db:"token"`
	RefreshToken   string                 `json:"refreshToken" db:"refresh_token"`
	DeviceInfo     map[string]interface{} `json:"deviceInfo" db:"device_info"`
	IPAddress      string                 `json:"ipAddress" db:"ip_address"`
	UserAgent      string                 `json:"userAgent" db:"user_agent"`
	CreatedAt      time.Time              `json:"createdAt" db:"created_at"`
	ExpiresAt      time.Time              `json:"expiresAt" db:"expires_at"`
	LastActivityAt time.Time              `json:"lastActivityAt" db:"last_activity_at"`
	IsActive       bool                   `json:"isActive" db:"is_active"`
	Metadata       map[string]interface{} `json:"metadata" db:"metadata"`
}

type RealtimeSession struct {
	ID               uuid.UUID              `json:"id" db:"id"`
	UserID           uuid.UUID              `json:"userId" db:"user_id"`
	SchemaID         *uuid.UUID             `json:"schemaId" db:"schema_id"`
	ConnectionID     string                 `json:"connectionId" db:"connection_id"`
	CursorPosition   map[string]interface{} `json:"cursorPosition" db:"cursor_position"`
	SelectedElements []string               `json:"selectedElements" db:"selected_elements"`
	Status           string                 `json:"status" db:"status"`
	ConnectedAt      time.Time              `json:"connectedAt" db:"connected_at"`
	LastHeartbeat    time.Time              `json:"lastHeartbeat" db:"last_heartbeat"`
	Metadata         map[string]interface{} `json:"metadata" db:"metadata"`
}

type SchemaLock struct {
	ID        uuid.UUID              `json:"id" db:"id"`
	SchemaID  uuid.UUID              `json:"schemaId" db:"schema_id"`
	ElementID string                 `json:"elementId" db:"element_id"`
	LockedBy  uuid.UUID              `json:"lockedBy" db:"locked_by"`
	LockType  string                 `json:"lockType" db:"lock_type"`
	LockedAt  time.Time              `json:"lockedAt" db:"locked_at"`
	ExpiresAt time.Time              `json:"expiresAt" db:"expires_at"`
	Metadata  map[string]interface{} `json:"metadata" db:"metadata"`
}
