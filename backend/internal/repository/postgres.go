package repository

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool interface for dependency injection (allows mocking in tests)
type Pool interface {
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
	Exec(ctx context.Context, sql string, args ...interface{}) (interface{}, error)
	Close()
}

// PoolAdapter wraps pgxpool.Pool to implement Pool interface
type PoolAdapter struct {
	pool *pgxpool.Pool
}

func (p *PoolAdapter) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return p.pool.Query(ctx, sql, args...)
}

func (p *PoolAdapter) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return p.pool.QueryRow(ctx, sql, args...)
}

func (p *PoolAdapter) Exec(ctx context.Context, sql string, args ...interface{}) (interface{}, error) {
	return p.pool.Exec(ctx, sql, args...)
}

func (p *PoolAdapter) Close() {
	p.pool.Close()
}

func NewPostgresPool(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	config.MinConns = 10
	config.MaxConns = 100

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(context.Background()); err != nil {
		return nil, err
	}

	return pool, nil
}

// RunMigrations runs all SQL migration files in order.
// Only files matching the pattern NNN_*.sql are executed (e.g. 001_init.sql).
// Legacy granular migrations (001_initial_schema … 008_delete_seed_data) are
// automatically skipped when the consolidated 001_init.sql is present.
func RunMigrations(pool *pgxpool.Pool, migrationsDir string) error {
	ctx := context.Background()

	// Create migrations tracking table if not exists
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get list of applied migrations
	appliedMigrations := make(map[string]bool)
	rows, err := pool.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("failed to query migrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return fmt.Errorf("failed to scan migration version: %w", err)
		}
		appliedMigrations[version] = true
	}

	// Read migration files
	var migrationFiles []string
	err = filepath.WalkDir(migrationsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(d.Name(), ".sql") {
			migrationFiles = append(migrationFiles, d.Name())
		}
		return nil
	})
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("Migrations directory not found, skipping migrations")
			return nil
		}
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	sort.Strings(migrationFiles)

	// Legacy migration filenames superseded by the consolidated 001_init.sql.
	// If any of them were already applied the DB has the old schema; if
	// 001_init.sql is about to run on a fresh DB we mark them after it runs.
	oldMigrations := []string{
		"001_initial_schema.sql",
		"002_seed_templates.sql",
		"003_seed_users_projects.sql",
		"004_add_schema_fields.sql",
		"005_optimize_and_fix.sql",
		"006_schema_unique_name.sql",
		"007_tz_missing_columns.sql",
		"008_delete_seed_data.sql",
	}
	oldSet := make(map[string]bool, len(oldMigrations))
	for _, o := range oldMigrations {
		oldSet[o] = true
	}

	// Detect existing DB with old migrations
	hasAnyOld := false
	for _, o := range oldMigrations {
		if appliedMigrations[o] {
			hasAnyOld = true
			break
		}
	}
	if hasAnyOld && !appliedMigrations["001_init.sql"] {
		// Old DB — mark the consolidated migration as already applied
		_, err := pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", "001_init.sql")
		if err != nil {
			return fmt.Errorf("failed to record consolidated migration: %w", err)
		}
		appliedMigrations["001_init.sql"] = true
		log.Println("Existing database detected — marked 001_init.sql as applied")
	}

	// Apply pending migrations (skip legacy filenames)
	for _, filename := range migrationFiles {
		if oldSet[filename] {
			log.Printf("Legacy migration %s — skipping (superseded by 001_init.sql)", filename)
			continue
		}
		if appliedMigrations[filename] {
			log.Printf("Migration %s already applied, skipping", filename)
			continue
		}

		migrationPath := filepath.Join(migrationsDir, filename)
		content, err := os.ReadFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		log.Printf("Applying migration: %s", filename)

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %s: %w", filename, err)
		}

		_, err = tx.Exec(ctx, string(content))
		if err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}

		_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", filename)
		if err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", filename, err)
		}

		log.Printf("Migration %s applied successfully", filename)

		// After fresh 001_init.sql, mark all legacy names as applied
		if filename == "001_init.sql" {
			for _, old := range oldMigrations {
				pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", old)
				appliedMigrations[old] = true
			}
			log.Println("Fresh database — marked legacy migration filenames as applied")
		}
	}

	return nil
}
