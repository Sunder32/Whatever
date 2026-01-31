package config

import (
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	JWTExpiration     time.Duration
	RefreshExpiration time.Duration
	LogLevel          string
	MaxFileSize       int64
	SyncInterval      time.Duration
	PythonServiceURL  string
	RedisAddress      string
}

func Load() (*Config, error) {
	viper.SetDefault("PORT", "9000")
	viper.SetDefault("DATABASE_URL", "postgresql://diagram:diagram_secret@localhost:5432/diagram_db?sslmode=disable")
	viper.SetDefault("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
	viper.SetDefault("JWT_EXPIRATION", "15m")
	viper.SetDefault("REFRESH_TOKEN_EXPIRATION", "7d")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("MAX_FILE_SIZE", 52428800)
	viper.SetDefault("SYNC_INTERVAL", "30s")
	viper.SetDefault("PYTHON_SERVICE_URL", "http://localhost:5000")
	viper.SetDefault("REDIS_ADDRESS", "localhost:6379")

	viper.AutomaticEnv()

	jwtExp, err := time.ParseDuration(viper.GetString("JWT_EXPIRATION"))
	if err != nil {
		jwtExp = 15 * time.Minute
	}

	refreshExp, err := time.ParseDuration(viper.GetString("REFRESH_TOKEN_EXPIRATION"))
	if err != nil {
		refreshExp = 7 * 24 * time.Hour
	}

	syncInterval, err := time.ParseDuration(viper.GetString("SYNC_INTERVAL"))
	if err != nil {
		syncInterval = 30 * time.Second
	}

	return &Config{
		Port:              viper.GetString("PORT"),
		DatabaseURL:       viper.GetString("DATABASE_URL"),
		JWTSecret:         viper.GetString("JWT_SECRET"),
		JWTExpiration:     jwtExp,
		RefreshExpiration: refreshExp,
		LogLevel:          viper.GetString("LOG_LEVEL"),
		MaxFileSize:       viper.GetInt64("MAX_FILE_SIZE"),
		SyncInterval:      syncInterval,
		PythonServiceURL:  viper.GetString("PYTHON_SERVICE_URL"),
		RedisAddress:      viper.GetString("REDIS_ADDRESS"),
	}, nil
}
