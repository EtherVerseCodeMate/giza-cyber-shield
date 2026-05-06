// recorder.go — HTTP/SSE recorder that exposes ASAF events in real-time
//
// This implements the "security camera" live feed: any connected dashboard
// client receives signed action records as they happen via Server-Sent Events.

package asaf

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// ActionEvent is the JSON payload sent to SSE subscribers
type ActionEvent struct {
	Type      string    `json:"type"`       // "action", "session_start", "session_end", "drift"
	NodeID    string    `json:"node_id"`
	SessionID string    `json:"session_id"`
	AgentID   string    `json:"agent_id"`
	AgentType string    `json:"agent_type"`
	Tool      string    `json:"tool,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Details   string    `json:"details,omitempty"`
}

// Recorder broadcasts ASAF events to connected SSE clients
type Recorder struct {
	wrapper *ASAFWrapper

	mu          sync.RWMutex
	subscribers map[chan ActionEvent]struct{}
}

// NewRecorder creates a recorder that publishes events from the wrapper
func NewRecorder(wrapper *ASAFWrapper) *Recorder {
	return &Recorder{
		wrapper:     wrapper,
		subscribers: make(map[chan ActionEvent]struct{}),
	}
}

// Broadcast sends an event to all connected SSE subscribers
func (r *Recorder) Broadcast(event ActionEvent) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for ch := range r.subscribers {
		select {
		case ch <- event:
		default:
			// Subscriber too slow, skip (non-blocking)
		}
	}
}

// subscribe registers a new SSE client
func (r *Recorder) subscribe() chan ActionEvent {
	ch := make(chan ActionEvent, 64)
	r.mu.Lock()
	r.subscribers[ch] = struct{}{}
	r.mu.Unlock()
	return ch
}

// unsubscribe removes a client
func (r *Recorder) unsubscribe(ch chan ActionEvent) {
	r.mu.Lock()
	delete(r.subscribers, ch)
	r.mu.Unlock()
	close(ch)
}

// HandleSSE is the HTTP handler for /api/asaf/stream (Server-Sent Events)
// Dashboard clients connect here to see live AI agent activity
func (r *Recorder) HandleSSE(w http.ResponseWriter, req *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := r.subscribe()
	defer r.unsubscribe(ch)

	// Send initial connection event
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ok\",\"time\":\"%s\"}\n\n",
		time.Now().UTC().Format(time.RFC3339))
	flusher.Flush()

	ctx := req.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, _ := json.Marshal(event)
			fmt.Fprintf(w, "event: asaf_action\ndata: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// HandleSessions returns all active ASAF sessions as JSON
func (r *Recorder) HandleSessions(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	sessions := r.wrapper.ListSessions()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

// HandleHistory returns action history for a specific session
func (r *Recorder) HandleHistory(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	sessionID := req.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, `{"error":"session_id required"}`, http.StatusBadRequest)
		return
	}

	nodes, err := r.wrapper.GetActionHistory(sessionID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"session_id": sessionID,
		"actions":    nodes,
		"count":      len(nodes),
	})
}
