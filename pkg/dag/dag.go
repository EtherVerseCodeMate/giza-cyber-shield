package dag

import (
	"errors"
	"sync"
)

type Node struct {
	ID      string   `json:"id"`
	Action  string   `json:"action"`
	Symbol  string   `json:"symbol"`
	Time    string   `json:"time"` // ISO8601
	Parents []string `json:"parents,omitempty"`
}

type Memory struct {
	mu    sync.RWMutex
	nodes map[string]*Node
}

func NewMemory() *Memory { return &Memory{nodes: make(map[string]*Node)} }

func (m *Memory) Add(n *Node, parents []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n.ID == "" {
		return errors.New("missing id")
	}
	if _, ok := m.nodes[n.ID]; ok {
		return errors.New("duplicate id")
	}
	// Check parents exist
	for _, pid := range parents {
		if _, exists := m.nodes[pid]; !exists {
			return errors.New("parent not found: " + pid)
		}
	}
	n.Parents = parents
	m.nodes[n.ID] = n
	return nil
}

func (m *Memory) All() []*Node {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Node, 0, len(m.nodes))
	for _, n := range m.nodes {
		out = append(out, n)
	}
	return out
}
