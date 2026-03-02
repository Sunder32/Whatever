package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type RateLimiter struct {
	requests map[string]*RequestCounter
	mutex    sync.RWMutex
	limit    int
	window   time.Duration
}

type RequestCounter struct {
	Count     int
	FirstSeen time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*RequestCounter),
		limit:    limit,
		window:   window,
	}

	go rl.cleanup()

	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()

	for range ticker.C {
		rl.mutex.Lock()
		now := time.Now()
		for key, counter := range rl.requests {
			if now.Sub(counter.FirstSeen) > rl.window {
				delete(rl.requests, key)
			}
		}
		rl.mutex.Unlock()
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	counter, exists := rl.requests[key]

	if !exists {
		rl.requests[key] = &RequestCounter{
			Count:     1,
			FirstSeen: now,
		}
		return true
	}

	if now.Sub(counter.FirstSeen) > rl.window {
		counter.Count = 1
		counter.FirstSeen = now
		return true
	}

	if counter.Count >= rl.limit {
		return false
	}

	counter.Count++
	return true
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		if userID, exists := c.Get("userID"); exists {
			switch v := userID.(type) {
			case string:
				key = v
			case fmt.Stringer:
				key = v.String()
			default:
				key = fmt.Sprintf("%v", v)
			}
		}

		if !rl.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "Rate limit exceeded",
				"retryAfter": rl.window.Seconds(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

type EndpointRateLimiter struct {
	limiters map[string]*RateLimiter
	mutex    sync.RWMutex
	defaults *RateLimiter
}

type EndpointConfig struct {
	Path   string
	Method string
	Limit  int
	Window time.Duration
}

func NewEndpointRateLimiter(defaultLimit int, defaultWindow time.Duration) *EndpointRateLimiter {
	return &EndpointRateLimiter{
		limiters: make(map[string]*RateLimiter),
		defaults: NewRateLimiter(defaultLimit, defaultWindow),
	}
}

func (erl *EndpointRateLimiter) Configure(configs []EndpointConfig) {
	erl.mutex.Lock()
	defer erl.mutex.Unlock()

	for _, config := range configs {
		key := config.Method + ":" + config.Path
		erl.limiters[key] = NewRateLimiter(config.Limit, config.Window)
	}
}

func (erl *EndpointRateLimiter) getLimiter(method, path string) *RateLimiter {
	erl.mutex.RLock()
	defer erl.mutex.RUnlock()

	key := method + ":" + path
	if limiter, exists := erl.limiters[key]; exists {
		return limiter
	}

	return erl.defaults
}

func (erl *EndpointRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		limiter := erl.getLimiter(c.Request.Method, c.FullPath())

		key := c.ClientIP()
		if userID, exists := c.Get("userID"); exists {
			switch v := userID.(type) {
			case string:
				key = v
			case fmt.Stringer:
				key = v.String()
			default:
				key = fmt.Sprintf("%v", v)
			}
		}

		if !limiter.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "Rate limit exceeded",
				"retryAfter": limiter.window.Seconds(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

type SlidingWindowRateLimiter struct {
	requests map[string][]time.Time
	mutex    sync.RWMutex
	limit    int
	window   time.Duration
}

func NewSlidingWindowRateLimiter(limit int, window time.Duration) *SlidingWindowRateLimiter {
	swrl := &SlidingWindowRateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}

	go swrl.cleanup()

	return swrl
}

func (swrl *SlidingWindowRateLimiter) cleanup() {
	ticker := time.NewTicker(swrl.window / 2)
	defer ticker.Stop()

	for range ticker.C {
		swrl.mutex.Lock()
		now := time.Now()
		cutoff := now.Add(-swrl.window)

		for key, timestamps := range swrl.requests {
			var validTimestamps []time.Time
			for _, ts := range timestamps {
				if ts.After(cutoff) {
					validTimestamps = append(validTimestamps, ts)
				}
			}

			if len(validTimestamps) == 0 {
				delete(swrl.requests, key)
			} else {
				swrl.requests[key] = validTimestamps
			}
		}
		swrl.mutex.Unlock()
	}
}

func (swrl *SlidingWindowRateLimiter) Allow(key string) bool {
	swrl.mutex.Lock()
	defer swrl.mutex.Unlock()

	now := time.Now()
	cutoff := now.Add(-swrl.window)

	timestamps, exists := swrl.requests[key]
	if !exists {
		swrl.requests[key] = []time.Time{now}
		return true
	}

	var validTimestamps []time.Time
	for _, ts := range timestamps {
		if ts.After(cutoff) {
			validTimestamps = append(validTimestamps, ts)
		}
	}

	if len(validTimestamps) >= swrl.limit {
		swrl.requests[key] = validTimestamps
		return false
	}

	validTimestamps = append(validTimestamps, now)
	swrl.requests[key] = validTimestamps
	return true
}

func (swrl *SlidingWindowRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		if userID, exists := c.Get("userID"); exists {
			switch v := userID.(type) {
			case string:
				key = v
			case fmt.Stringer:
				key = v.String()
			default:
				key = fmt.Sprintf("%v", v)
			}
		}

		if !swrl.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "Rate limit exceeded",
				"retryAfter": swrl.window.Seconds(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

type TokenBucketRateLimiter struct {
	buckets    map[string]*TokenBucket
	mutex      sync.RWMutex
	capacity   int
	refillRate float64
}

type TokenBucket struct {
	Tokens     float64
	LastRefill time.Time
}

func NewTokenBucketRateLimiter(capacity int, refillRate float64) *TokenBucketRateLimiter {
	return &TokenBucketRateLimiter{
		buckets:    make(map[string]*TokenBucket),
		capacity:   capacity,
		refillRate: refillRate,
	}
}

func (tbrl *TokenBucketRateLimiter) Allow(key string) bool {
	tbrl.mutex.Lock()
	defer tbrl.mutex.Unlock()

	now := time.Now()

	bucket, exists := tbrl.buckets[key]
	if !exists {
		tbrl.buckets[key] = &TokenBucket{
			Tokens:     float64(tbrl.capacity) - 1,
			LastRefill: now,
		}
		return true
	}

	elapsed := now.Sub(bucket.LastRefill).Seconds()
	bucket.Tokens += elapsed * tbrl.refillRate
	if bucket.Tokens > float64(tbrl.capacity) {
		bucket.Tokens = float64(tbrl.capacity)
	}
	bucket.LastRefill = now

	if bucket.Tokens < 1 {
		return false
	}

	bucket.Tokens--
	return true
}

func (tbrl *TokenBucketRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		if userID, exists := c.Get("userID"); exists {
			switch v := userID.(type) {
			case string:
				key = v
			case fmt.Stringer:
				key = v.String()
			default:
				key = fmt.Sprintf("%v", v)
			}
		}

		if !tbrl.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "Rate limit exceeded",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
