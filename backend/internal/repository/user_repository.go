package repository

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"diagram-app/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	if user.Role == "" {
		user.Role = "user"
	}

	settingsJSON, err := json.Marshal(user.Settings)
	if err != nil {
		settingsJSON = []byte("{}")
	}

	query := `
		INSERT INTO users (
			id, email, password_hash, name, avatar, role,
			settings, email_verified, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err = r.pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Name,
		user.Avatar,
		user.Role,
		settingsJSON,
		user.EmailVerified,
		user.CreatedAt,
		user.UpdatedAt,
	)

	return err
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, name, avatar, role,
			   settings, email_verified, last_login_at, created_at, updated_at
		FROM users WHERE id = $1 AND deleted_at IS NULL
	`

	var user models.User
	var settingsJSON []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Avatar,
		&user.Role,
		&settingsJSON,
		&user.EmailVerified,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
		user.Settings = make(map[string]interface{})
	}

	return &user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, name, avatar, role,
			   settings, email_verified, last_login_at, created_at, updated_at
		FROM users WHERE email = $1 AND deleted_at IS NULL
	`

	var user models.User
	var settingsJSON []byte

	err := r.pool.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Avatar,
		&user.Role,
		&settingsJSON,
		&user.EmailVerified,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
		user.Settings = make(map[string]interface{})
	}

	return &user, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	// Map username to name column
	query := `
		SELECT id, email, password_hash, name, avatar, role,
			   settings, email_verified, last_login_at, created_at, updated_at
		FROM users WHERE name = $1 AND deleted_at IS NULL
	`

	var user models.User
	var settingsJSON []byte

	err := r.pool.QueryRow(ctx, query, username).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Avatar,
		&user.Role,
		&settingsJSON,
		&user.EmailVerified,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
		user.Settings = make(map[string]interface{})
	}

	return &user, nil
}

func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	user.UpdatedAt = time.Now()

	settingsJSON, err := json.Marshal(user.Settings)
	if err != nil {
		settingsJSON = []byte("{}")
	}

	query := `
		UPDATE users SET
			email = $2,
			name = $3,
			avatar = $4,
			role = $5,
			settings = $6,
			email_verified = $7,
			password_hash = $8,
			updated_at = $9
		WHERE id = $1 AND deleted_at IS NULL
	`

	_, err = r.pool.Exec(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.Avatar,
		user.Role,
		settingsJSON,
		user.EmailVerified,
		user.PasswordHash,
		user.UpdatedAt,
	)

	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET last_login_at = $2 WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, userID, time.Now())
	return err
}

func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Soft delete
	query := `UPDATE users SET deleted_at = $2 WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, time.Now())
	return err
}

func (r *UserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL)`
	var exists bool
	err := r.pool.QueryRow(ctx, query, email).Scan(&exists)
	return exists, err
}

func (r *UserRepository) ExistsByUsername(ctx context.Context, username string) (bool, error) {
	// Map username to name column
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE name = $1 AND deleted_at IS NULL)`
	var exists bool
	err := r.pool.QueryRow(ctx, query, username).Scan(&exists)
	return exists, err
}

// Search searches for users by name or email
func (r *UserRepository) Search(ctx context.Context, query string, limit int) ([]*models.User, error) {
	if limit <= 0 {
		limit = 20
	}

	sqlQuery := `
		SELECT id, email, password_hash, name, avatar, role,
			   settings, email_verified, last_login_at, created_at, updated_at
		FROM users 
		WHERE deleted_at IS NULL 
			AND (LOWER(name) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1))
		ORDER BY name
		LIMIT $2
	`

	escapedQuery := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(query, "\\", "\\\\"), "%", "\\%"), "_", "\\_")
	rows, err := r.pool.Query(ctx, sqlQuery, "%"+escapedQuery+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var settingsJSON []byte

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Name,
			&user.Avatar,
			&user.Role,
			&settingsJSON,
			&user.EmailVerified,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
			user.Settings = make(map[string]interface{})
		}

		users = append(users, &user)
	}

	return users, rows.Err()
}

// GetFollowers returns users who follow the given user
func (r *UserRepository) GetFollowers(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.User, int, error) {
	if limit <= 0 {
		limit = 20
	}

	// Count total followers
	var total int
	countQuery := `SELECT COUNT(*) FROM user_followers WHERE following_id = $1`
	err := r.pool.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get follower users
	sqlQuery := `
		SELECT u.id, u.email, u.password_hash, u.name, u.avatar, u.role,
			   u.settings, u.email_verified, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		INNER JOIN user_followers uf ON u.id = uf.follower_id
		WHERE uf.following_id = $1 AND u.deleted_at IS NULL
		ORDER BY uf.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, sqlQuery, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var settingsJSON []byte

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Name,
			&user.Avatar,
			&user.Role,
			&settingsJSON,
			&user.EmailVerified,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
			user.Settings = make(map[string]interface{})
		}

		users = append(users, &user)
	}

	return users, total, rows.Err()
}

// GetFollowing returns users whom the given user follows
func (r *UserRepository) GetFollowing(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.User, int, error) {
	if limit <= 0 {
		limit = 20
	}

	// Count total following
	var total int
	countQuery := `SELECT COUNT(*) FROM user_followers WHERE follower_id = $1`
	err := r.pool.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get followed users
	sqlQuery := `
		SELECT u.id, u.email, u.password_hash, u.name, u.avatar, u.role,
			   u.settings, u.email_verified, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		INNER JOIN user_followers uf ON u.id = uf.following_id
		WHERE uf.follower_id = $1 AND u.deleted_at IS NULL
		ORDER BY uf.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, sqlQuery, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var settingsJSON []byte

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Name,
			&user.Avatar,
			&user.Role,
			&settingsJSON,
			&user.EmailVerified,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
			user.Settings = make(map[string]interface{})
		}

		users = append(users, &user)
	}

	return users, total, rows.Err()
}

// FollowUser creates a follow relationship
func (r *UserRepository) FollowUser(ctx context.Context, followerID, followingID uuid.UUID) error {
	query := `
		INSERT INTO user_followers (follower_id, following_id, created_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (follower_id, following_id) DO NOTHING
	`
	_, err := r.pool.Exec(ctx, query, followerID, followingID)
	return err
}

// UnfollowUser removes a follow relationship
func (r *UserRepository) UnfollowUser(ctx context.Context, followerID, followingID uuid.UUID) error {
	query := `DELETE FROM user_followers WHERE follower_id = $1 AND following_id = $2`
	_, err := r.pool.Exec(ctx, query, followerID, followingID)
	return err
}

// GetSuggested returns suggested users to follow
func (r *UserRepository) GetSuggested(ctx context.Context, userID uuid.UUID, limit int) ([]*models.User, error) {
	if limit <= 0 {
		limit = 10
	}

	// Get users that are not the current user, ordered by most recent activity
	sqlQuery := `
		SELECT id, email, password_hash, name, avatar, role,
			   settings, email_verified, last_login_at, created_at, updated_at
		FROM users 
		WHERE deleted_at IS NULL AND id != $1
		ORDER BY last_login_at DESC NULLS LAST, created_at DESC
		LIMIT $2
	`

	rows, err := r.pool.Query(ctx, sqlQuery, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var settingsJSON []byte

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Name,
			&user.Avatar,
			&user.Role,
			&settingsJSON,
			&user.EmailVerified,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(settingsJSON, &user.Settings); err != nil {
			user.Settings = make(map[string]interface{})
		}

		users = append(users, &user)
	}

	return users, rows.Err()
}

// GetFollowersCount returns the count of followers for a user
func (r *UserRepository) GetFollowersCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM user_followers WHERE following_id = $1`
	err := r.pool.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

// GetFollowingCount returns the count of users that the given user follows
func (r *UserRepository) GetFollowingCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM user_followers WHERE follower_id = $1`
	err := r.pool.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

// IsFollowing checks if followerID follows followingID
func (r *UserRepository) IsFollowing(ctx context.Context, followerID, followingID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM user_followers WHERE follower_id = $1 AND following_id = $2)`
	err := r.pool.QueryRow(ctx, query, followerID, followingID).Scan(&exists)
	return exists, err
}
