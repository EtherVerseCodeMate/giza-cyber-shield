// Package mcp — input validation and security hardening for tool arguments.
//
// Implements: path traversal prevention, command injection detection,
// argument size limits, loop/mistake detection, rate limiting, concurrency limiting.
package mcp

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	ErrCodePathTraversal    = "PATH_TRAVERSAL"
	ErrCodeCommandInjection = "COMMAND_INJECTION"
	ErrCodeInputTooLarge    = "INPUT_TOO_LARGE"
	ErrCodeInvalidArg       = "INVALID_ARG"
	ErrCodeLoopDetected     = "LOOP_DETECTED"
	ErrCodeMistakeLimit     = "MISTAKE_LIMIT"
	ErrCodeRateLimit        = "RATE_LIMIT"
	ErrCodeTimeout          = "TIMEOUT"
	ErrCodeConcurrencyLimit = "CONCURRENCY_LIMIT"
)

type ValidationError struct {
	Code    string `json:"code"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("[%s] %s: %s", e.Code, e.Field, e.Message)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

const MaxArgSize = 1 << 20 // 1MB

var dangerousPatterns = regexp.MustCompile(
	`(?i)` +
		`(\$\(.*\))` +
		`|(\x60.*\x60)` +
		`|(;\s*(rm|dd|mkfs|wget|curl|nc|bash|sh|python|perl|ruby|php)\b)` +
		`|(\|\s*(bash|sh|nc|python)\b)` +
		`|(&&\s*(rm|dd|wget|curl)\b)` +
		`|(\beval\s*\()` +
		`|(__import__|exec\s*\(|os\.system)`,
)

func ValidateToolArgs(args map[string]any) *ValidationError {
	for key, val := range args {
		if err := validateArgValue(key, val, 0); err != nil {
			return err
		}
	}
	return nil
}

func validateArgValue(key string, val any, depth int) *ValidationError {
	if depth > 10 {
		return &ValidationError{Code: ErrCodeInvalidArg, Field: key, Message: "nested too deep"}
	}
	switch v := val.(type) {
	case string:
		return validateStringArg(key, v)
	case []any:
		for i, item := range v {
			if err := validateArgValue(fmt.Sprintf("%s[%d]", key, i), item, depth+1); err != nil {
				return err
			}
		}
	case map[string]any:
		for k, item := range v {
			if err := validateArgValue(key+"."+k, item, depth+1); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateStringArg(key, val string) *ValidationError {
	if len(val) > MaxArgSize {
		return &ValidationError{Code: ErrCodeInputTooLarge, Field: key,
			Message: fmt.Sprintf("value exceeds %d bytes", MaxArgSize)}
	}
	if !utf8.ValidString(val) {
		return &ValidationError{Code: ErrCodeInvalidArg, Field: key, Message: "invalid UTF-8 encoding"}
	}
	if isPathField(key) {
		if err := validatePath(key, val); err != nil {
			return err
		}
	}
	if dangerousPatterns.MatchString(val) {
		return &ValidationError{Code: ErrCodeCommandInjection, Field: key,
			Message: "potential command injection detected"}
	}
	return nil
}

func isPathField(key string) bool {
	lower := strings.ToLower(key)
	return strings.Contains(lower, "path") || strings.Contains(lower, "file") ||
		strings.Contains(lower, "dir") || strings.Contains(lower, "directory") ||
		strings.Contains(lower, "target")
}

func validatePath(key, val string) *ValidationError {
	cleaned := filepath.Clean(val)
	if filepath.IsAbs(cleaned) && cleaned != "." && cleaned != "/" {
		return &ValidationError{Code: ErrCodePathTraversal, Field: key,
			Message: "absolute paths are not allowed"}
	}
	if strings.Contains(cleaned, "..") {
		return &ValidationError{Code: ErrCodePathTraversal, Field: key,
			Message: "path traversal (..) blocked"}
	}
	for _, prefix := range []string{"/etc/", "/proc/", "/sys/", "/dev/", "/root/", "/var/run/"} {
		if strings.HasPrefix(cleaned, prefix) {
			return &ValidationError{Code: ErrCodePathTraversal, Field: key,
				Message: fmt.Sprintf("access to %s is blocked", prefix)}
		}
	}
	return nil
}

// ─── Mistake / Loop Detection ──────────────────────────────────────────────────

type MistakeTracker struct {
	mu              sync.Mutex
	consecutiveErrs map[string]int
	recentCalls     map[string][]callRecord
	maxConsecutive  int
	loopWindow      int
	loopThreshold   int
}

type callRecord struct {
	toolName string
	argsHash string
	at       time.Time
}

type MistakeTrackerConfig struct {
	MaxConsecutiveErrors int
	LoopWindow           int
	LoopThreshold        int
}

func NewMistakeTracker(cfg MistakeTrackerConfig) *MistakeTracker {
	if cfg.MaxConsecutiveErrors <= 0 {
		cfg.MaxConsecutiveErrors = 5
	}
	if cfg.LoopWindow <= 0 {
		cfg.LoopWindow = 10
	}
	if cfg.LoopThreshold <= 0 {
		cfg.LoopThreshold = 3
	}
	return &MistakeTracker{
		consecutiveErrs: make(map[string]int),
		recentCalls:     make(map[string][]callRecord),
		maxConsecutive:  cfg.MaxConsecutiveErrors,
		loopWindow:      cfg.LoopWindow,
		loopThreshold:   cfg.LoopThreshold,
	}
}

func (mt *MistakeTracker) RecordSuccess(agentID string) {
	mt.mu.Lock()
	defer mt.mu.Unlock()
	mt.consecutiveErrs[agentID] = 0
}

func (mt *MistakeTracker) RecordError(agentID string) *ValidationError {
	mt.mu.Lock()
	defer mt.mu.Unlock()
	mt.consecutiveErrs[agentID]++
	count := mt.consecutiveErrs[agentID]
	if count >= mt.maxConsecutive {
		return &ValidationError{Code: ErrCodeMistakeLimit,
			Message: fmt.Sprintf("agent %s has %d consecutive errors — session paused", agentID, count)}
	}
	return nil
}

func (mt *MistakeTracker) CheckLoop(agentID, toolName, argsFingerprint string) *ValidationError {
	mt.mu.Lock()
	defer mt.mu.Unlock()

	rec := callRecord{toolName: toolName, argsHash: argsFingerprint, at: time.Now()}
	history := mt.recentCalls[agentID]
	history = append(history, rec)
	if len(history) > mt.loopWindow {
		history = history[len(history)-mt.loopWindow:]
	}
	mt.recentCalls[agentID] = history

	identical := 0
	for _, h := range history {
		if h.toolName == toolName && h.argsHash == argsFingerprint {
			identical++
		}
	}
	if identical >= mt.loopThreshold {
		return &ValidationError{Code: ErrCodeLoopDetected,
			Message: fmt.Sprintf("loop detected: tool %s called %d times with same args", toolName, identical)}
	}
	return nil
}

func (mt *MistakeTracker) ResetAgent(agentID string) {
	mt.mu.Lock()
	defer mt.mu.Unlock()
	delete(mt.consecutiveErrs, agentID)
	delete(mt.recentCalls, agentID)
}

// ─── Rate Limiter ──────────────────────────────────────────────────────────────

type RateLimiter struct {
	mu          sync.Mutex
	windowMs    int64
	maxRequests int
	windows     map[string][]int64
}

func NewRateLimiter(windowMs int64, maxRequests int) *RateLimiter {
	return &RateLimiter{
		windowMs:    windowMs,
		maxRequests: maxRequests,
		windows:     make(map[string][]int64),
	}
}

func (rl *RateLimiter) Allow(agentID string) *ValidationError {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now().UnixMilli()
	cutoff := now - rl.windowMs
	existing := rl.windows[agentID]
	pruned := make([]int64, 0, len(existing))
	for _, ts := range existing {
		if ts > cutoff {
			pruned = append(pruned, ts)
		}
	}
	if len(pruned) >= rl.maxRequests {
		return &ValidationError{Code: ErrCodeRateLimit,
			Message: fmt.Sprintf("rate limit exceeded: %d requests in %dms window", rl.maxRequests, rl.windowMs)}
	}
	pruned = append(pruned, now)
	rl.windows[agentID] = pruned
	return nil
}

// ─── Concurrency Limiter ───────────────────────────────────────────────────────

// ConcurrencyLimiter caps simultaneous tool calls per agent (NSA prompt-storm defense).
type ConcurrencyLimiter struct {
	mu            sync.Mutex
	active        map[string]int
	maxConcurrent int
}

func NewConcurrencyLimiter(maxConcurrent int) *ConcurrencyLimiter {
	if maxConcurrent <= 0 {
		maxConcurrent = 5
	}
	return &ConcurrencyLimiter{active: make(map[string]int), maxConcurrent: maxConcurrent}
}

func (cl *ConcurrencyLimiter) Acquire(agentID string) *ValidationError {
	cl.mu.Lock()
	defer cl.mu.Unlock()
	if cl.active[agentID] >= cl.maxConcurrent {
		return &ValidationError{Code: ErrCodeConcurrencyLimit,
			Message: fmt.Sprintf("concurrency limit: agent %q has %d active calls (max %d)",
				agentID, cl.active[agentID], cl.maxConcurrent)}
	}
	cl.active[agentID]++
	return nil
}

func (cl *ConcurrencyLimiter) Release(agentID string) {
	cl.mu.Lock()
	defer cl.mu.Unlock()
	if cl.active[agentID] > 0 {
		cl.active[agentID]--
	}
	if cl.active[agentID] == 0 {
		delete(cl.active, agentID)
	}
}

func (cl *ConcurrencyLimiter) ActiveCalls(agentID string) int {
	cl.mu.Lock()
	defer cl.mu.Unlock()
	return cl.active[agentID]
}
