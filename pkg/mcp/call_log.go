package mcp

import (
	"sync"
	"time"
)

// MCPToolCall is an immutable record of a single MCP tool invocation.
type MCPToolCall struct {
	ToolName  string
	CallerID  string // agent/session identifier from JWT subject
	Timestamp time.Time
	ParamsLen int // byte length of raw params (content not stored for privacy)
	IsError   bool
}

// CallLog is a fixed-capacity ring buffer of MCPToolCall records.
// It is goroutine-safe and non-blocking: the oldest entry is silently
// overwritten when capacity is reached.
type CallLog struct {
	mu   sync.RWMutex
	buf  []MCPToolCall
	cap  int
	head int
	size int
}

// NewCallLog creates a CallLog with the given capacity (default 512 if ≤ 0).
func NewCallLog(capacity int) *CallLog {
	if capacity <= 0 {
		capacity = 512
	}
	return &CallLog{buf: make([]MCPToolCall, capacity), cap: capacity}
}

// Push records a tool call. Non-blocking; overwrites oldest on overflow.
func (l *CallLog) Push(c MCPToolCall) {
	l.mu.Lock()
	l.buf[l.head] = c
	l.head = (l.head + 1) % l.cap
	if l.size < l.cap {
		l.size++
	}
	l.mu.Unlock()
}

// Recent returns up to n most-recent calls in reverse-chronological order.
func (l *CallLog) Recent(n int) []MCPToolCall {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if n > l.size {
		n = l.size
	}
	out := make([]MCPToolCall, n)
	for i := 0; i < n; i++ {
		idx := (l.head - 1 - i + l.cap) % l.cap
		out[i] = l.buf[idx]
	}
	return out
}

// CountSince returns the number of calls made by callerID at or after t.
// Stops scanning backward once it reaches a call older than t.
func (l *CallLog) CountSince(callerID string, t time.Time) int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	count := 0
	for i := 0; i < l.size; i++ {
		idx := (l.head - 1 - i + l.cap) % l.cap
		c := l.buf[idx]
		if c.Timestamp.Before(t) {
			break
		}
		if c.CallerID == callerID {
			count++
		}
	}
	return count
}
