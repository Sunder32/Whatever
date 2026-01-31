package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type LogEntry struct {
	ID           string                 `json:"id"`
	Timestamp    time.Time              `json:"timestamp"`
	Method       string                 `json:"method"`
	Path         string                 `json:"path"`
	Query        string                 `json:"query,omitempty"`
	StatusCode   int                    `json:"statusCode"`
	Duration     float64                `json:"duration"`
	ClientIP     string                 `json:"clientIP"`
	UserAgent    string                 `json:"userAgent"`
	UserID       string                 `json:"userId,omitempty"`
	RequestBody  map[string]interface{} `json:"requestBody,omitempty"`
	ResponseSize int                    `json:"responseSize"`
	Error        string                 `json:"error,omitempty"`
	RequestID    string                 `json:"requestId"`
	ContentType  string                 `json:"contentType,omitempty"`
	Referer      string                 `json:"referer,omitempty"`
}

type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
	size int
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	n, err := w.ResponseWriter.Write(b)
	w.size += n
	return n, err
}

type LoggerConfig struct {
	SkipPaths       []string
	LogRequestBody  bool
	LogResponseBody bool
	MaxBodySize     int
	Output          io.Writer
	CustomFields    map[string]interface{}
}

func DefaultLoggerConfig() LoggerConfig {
	return LoggerConfig{
		SkipPaths:       []string{"/health", "/metrics"},
		LogRequestBody:  false,
		LogResponseBody: false,
		MaxBodySize:     4096,
	}
}

func Logger() gin.HandlerFunc {
	return LoggerWithConfig(DefaultLoggerConfig())
}

func LoggerWithConfig(config LoggerConfig) gin.HandlerFunc {
	skipPaths := make(map[string]bool)
	for _, path := range config.SkipPaths {
		skipPaths[path] = true
	}

	return func(c *gin.Context) {
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("requestID", requestID)
		c.Header("X-Request-ID", requestID)

		start := time.Now()

		var requestBody map[string]interface{}
		if config.LogRequestBody && c.Request.Body != nil && c.Request.ContentLength > 0 {
			bodyBytes, err := io.ReadAll(c.Request.Body)
			if err == nil && len(bodyBytes) <= config.MaxBodySize {
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				json.Unmarshal(bodyBytes, &requestBody)

				if requestBody != nil {
					sanitizeBody(requestBody)
				}
			} else {
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}
		}

		writer := &responseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBuffer(nil),
		}
		c.Writer = writer

		c.Next()

		duration := time.Since(start)

		entry := LogEntry{
			ID:           uuid.New().String(),
			Timestamp:    start,
			Method:       c.Request.Method,
			Path:         c.Request.URL.Path,
			Query:        c.Request.URL.RawQuery,
			StatusCode:   c.Writer.Status(),
			Duration:     float64(duration.Milliseconds()),
			ClientIP:     c.ClientIP(),
			UserAgent:    c.Request.UserAgent(),
			RequestID:    requestID,
			ResponseSize: writer.size,
			ContentType:  c.ContentType(),
			Referer:      c.Request.Referer(),
		}

		if userID, exists := c.Get("userID"); exists {
			entry.UserID = userID.(uuid.UUID).String()
		}

		if config.LogRequestBody && requestBody != nil {
			entry.RequestBody = requestBody
		}

		if len(c.Errors) > 0 {
			entry.Error = c.Errors.String()
		}

		logJSON, _ := json.Marshal(entry)

		if config.Output != nil {
			config.Output.Write(logJSON)
			config.Output.Write([]byte("\n"))
		}
	}
}

func sanitizeBody(body map[string]interface{}) {
	sensitiveFields := []string{
		"password",
		"oldPassword",
		"newPassword",
		"token",
		"accessToken",
		"refreshToken",
		"secret",
		"apiKey",
		"authorization",
		"creditCard",
		"ssn",
	}

	for key, value := range body {
		lowerKey := key
		for _, sensitive := range sensitiveFields {
			if lowerKey == sensitive {
				body[key] = "[REDACTED]"
				break
			}
		}

		if nested, ok := value.(map[string]interface{}); ok {
			sanitizeBody(nested)
		}
	}
}

func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		c.Set("requestID", requestID)
		c.Header("X-Request-ID", requestID)

		c.Next()
	}
}

type AccessLogEntry struct {
	Timestamp    time.Time `json:"timestamp"`
	ClientIP     string    `json:"clientIP"`
	UserID       string    `json:"userId,omitempty"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
	StatusCode   int       `json:"statusCode"`
	Duration     int64     `json:"duration"`
	ResponseSize int       `json:"responseSize"`
}

func AccessLogger(output io.Writer) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		entry := AccessLogEntry{
			Timestamp:    start,
			ClientIP:     c.ClientIP(),
			Method:       c.Request.Method,
			Path:         c.Request.URL.Path,
			StatusCode:   c.Writer.Status(),
			Duration:     time.Since(start).Milliseconds(),
			ResponseSize: c.Writer.Size(),
		}

		if userID, exists := c.Get("userID"); exists {
			entry.UserID = userID.(uuid.UUID).String()
		}

		logJSON, _ := json.Marshal(entry)
		output.Write(logJSON)
		output.Write([]byte("\n"))
	}
}

func RecoveryWithLogger(output io.Writer) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				entry := map[string]interface{}{
					"timestamp": time.Now(),
					"level":     "error",
					"type":      "panic",
					"error":     err,
					"path":      c.Request.URL.Path,
					"method":    c.Request.Method,
					"clientIP":  c.ClientIP(),
				}

				if requestID, exists := c.Get("requestID"); exists {
					entry["requestId"] = requestID
				}

				logJSON, _ := json.Marshal(entry)
				output.Write(logJSON)
				output.Write([]byte("\n"))

				c.AbortWithStatusJSON(500, gin.H{
					"success": false,
					"error":   "Internal server error",
				})
			}
		}()

		c.Next()
	}
}

func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	originMap := make(map[string]bool)
	allowAll := false

	for _, origin := range allowedOrigins {
		if origin == "*" {
			allowAll = true
			break
		}
		originMap[origin] = true
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if allowAll {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if originMap[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")
		c.Header("Access-Control-Expose-Headers", "Content-Length, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		c.Next()
	}
}

func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		done := make(chan struct{})

		go func() {
			c.Next()
			close(done)
		}()

		select {
		case <-done:
			return
		case <-time.After(timeout):
			c.AbortWithStatusJSON(504, gin.H{
				"success": false,
				"error":   "Request timeout",
			})
		}
	}
}
