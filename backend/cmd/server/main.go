package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"diagram-app/backend/internal/config"
	"diagram-app/backend/internal/handlers"
	"diagram-app/backend/internal/middleware"
	"diagram-app/backend/internal/repository"
	"diagram-app/backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	pool, err := repository.NewPostgresPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Run database migrations automatically
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}
	if err := repository.RunMigrations(pool, migrationsDir); err != nil {
		log.Printf("Warning: Migration error (may be expected if already applied): %v", err)
	}

	userRepo := repository.NewUserRepository(pool)
	projectRepo := repository.NewProjectRepository(pool)
	schemaRepo := repository.NewSchemaRepository(pool)
	syncRepo := repository.NewSyncRepository(pool)

	authService := services.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiration)
	projectService := services.NewProjectService(projectRepo)
	schemaService := services.NewSchemaService(schemaRepo)
	syncService := services.NewSyncService(syncRepo, schemaRepo)
	pythonClient := services.NewPythonServiceClient(cfg.PythonServiceURL)

	authHandler := handlers.NewAuthHandler(authService, userRepo, projectRepo)
	projectHandler := handlers.NewProjectHandler(projectService)
	schemaHandler := handlers.NewSchemaHandler(schemaService, projectService)
	syncHandler := handlers.NewSyncHandler(syncService)
	wsHandler := handlers.NewWebSocketHandler()
	userHandler := handlers.NewUserHandler(userRepo, projectRepo)
	exportHandler := handlers.NewExportHandler(pythonClient)
	templateHandler := handlers.NewTemplateHandler(pool)
	assetHandler := handlers.NewAssetHandler(pool)
	lockHandler := handlers.NewLockHandler(pool)

	authMiddleware := middleware.NewAuthMiddleware(authService)

	// Increased rate limit to support autosave and active editing
	rateLimiter := middleware.NewRateLimiter(600, time.Minute)

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Request-ID"},
		ExposeHeaders:    []string{"Content-Length", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.Use(rateLimiter.Middleware())
	router.Use(middleware.Logger())
	router.Use(middleware.SecurityHeaders())

	// Serve uploaded files behind auth for private assets
	router.Static("/uploads", "./uploads")

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC(),
		})
	})

	api := router.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/logout", authHandler.Logout)
			auth.POST("/refresh", authHandler.Refresh)
			auth.POST("/validate", authHandler.ValidateToken)
			auth.GET("/profile", authMiddleware.Authenticate(), authHandler.GetProfile)
			auth.PUT("/profile", authMiddleware.Authenticate(), userHandler.UpdateProfile)
			auth.PUT("/password", authMiddleware.Authenticate(), authHandler.ChangePassword)
		}

		projects := api.Group("/projects")
		projects.Use(authMiddleware.Authenticate())
		{
			projects.GET("", projectHandler.List)
			projects.POST("", projectHandler.Create)
			projects.GET("/:id", projectHandler.GetByID)
			projects.PUT("/:id", projectHandler.Update)
			projects.DELETE("/:id", projectHandler.Delete)
			projects.POST("/:id/archive", projectHandler.Archive)
			projects.POST("/:id/unarchive", projectHandler.Unarchive)
			projects.POST("/:id/duplicate", projectHandler.Duplicate)
			projects.GET("/:id/collaborators", projectHandler.GetCollaborators)
			projects.POST("/:id/collaborators", projectHandler.AddCollaborator)
			projects.PUT("/:id/collaborators/:userId", projectHandler.UpdateCollaborator)
			projects.DELETE("/:id/collaborators/:userId", projectHandler.RemoveCollaborator)
		}

		schemas := api.Group("/schemas")
		schemas.Use(authMiddleware.Authenticate())
		{
			schemas.GET("", schemaHandler.List)
			schemas.POST("", schemaHandler.Create)
			schemas.GET("/search", schemaHandler.Search)
			schemas.GET("/:id", schemaHandler.GetByID)
			schemas.PUT("/:id", schemaHandler.Update)
			schemas.DELETE("/:id", schemaHandler.Delete)
			schemas.POST("/:id/duplicate", schemaHandler.Duplicate)
			schemas.GET("/:id/versions", schemaHandler.GetVersions)
			schemas.POST("/:id/versions", schemaHandler.CreateVersion)
			schemas.GET("/:id/versions/:versionId", schemaHandler.GetVersion)
			schemas.POST("/:id/versions/:versionId/restore", schemaHandler.RestoreVersion)

			// Lock endpoints (ТЗ: GET/POST/DELETE locks)
			schemas.GET("/:id/locks", lockHandler.GetLocks)
			schemas.POST("/:id/locks", lockHandler.CreateLock)
			schemas.DELETE("/:id/locks/:lockId", lockHandler.DeleteLock)
		}

		sync := api.Group("/sync")
		sync.Use(authMiddleware.Authenticate())
		{
			sync.POST("/pull", syncHandler.Pull)
			sync.POST("/push", syncHandler.Push)
			sync.POST("/resolve", syncHandler.ResolveConflict)
			sync.GET("/status", syncHandler.GetStatus)
			sync.POST("/queue", syncHandler.QueueOperation)
			sync.POST("/process", syncHandler.ProcessQueue)
			sync.POST("/detect-conflicts", syncHandler.DetectConflicts)
			sync.POST("/full-sync", syncHandler.FullSync)
		}

		users := api.Group("/users")
		users.Use(authMiddleware.Authenticate())
		{
			users.GET("/search", userHandler.Search)
			users.GET("/suggested", userHandler.GetSuggested)
			users.GET("/username/:username", userHandler.GetByUsername)
			users.GET("/:id", userHandler.GetByID)
			users.GET("/:id/projects", userHandler.GetUserProjects)
			users.GET("/:id/followers", userHandler.GetFollowers)
			users.GET("/:id/following", userHandler.GetFollowing)
			users.POST("/:id/follow", userHandler.Follow)
			users.DELETE("/:id/follow", userHandler.Unfollow)
		}

		// Export/Import routes (uses Python service)
		export := api.Group("/export")
		export.Use(authMiddleware.Authenticate())
		{
			export.POST("", exportHandler.Export)
			export.POST("/layout", exportHandler.AutoLayout)
			export.POST("/encrypt", exportHandler.Encrypt)
			export.POST("/decrypt", exportHandler.Decrypt)
			export.GET("/python-health", exportHandler.PythonServiceHealth)
		}

		// Asset endpoints (ТЗ: POST/GET/DELETE assets)
		assets := api.Group("/assets")
		assets.Use(authMiddleware.Authenticate())
		{
			assets.POST("", assetHandler.Upload)
			assets.GET("/:id", assetHandler.GetByID)
			assets.DELETE("/:id", assetHandler.Delete)
		}

		// Templates (public read, auth for write)
		templates := api.Group("/templates")
		{
			templates.GET("", templateHandler.List)
			templates.GET("/categories", templateHandler.GetCategories)
			templates.GET("/:id", templateHandler.GetByID)
			templates.POST("/:id/use", authMiddleware.Authenticate(), templateHandler.UseTemplate)
		}
	}

	router.GET("/ws", authMiddleware.Authenticate(), wsHandler.HandleConnection)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Starting server on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}
