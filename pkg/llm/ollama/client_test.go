package ollama

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewClient(t *testing.T) {
	client := NewClient("http://localhost:11434", "phi4", "")
	if client.BaseURL != "http://localhost:11434" {
		t.Errorf("Expected BaseURL http://localhost:11434, got %s", client.BaseURL)
	}
	if client.Model != "phi4" {
		t.Errorf("Expected Model phi4, got %s", client.Model)
	}
}

func TestCheckHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/version" {
			t.Errorf("Expected path /api/version, got %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"version": "0.1.0"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "phi4", "")
	if !client.CheckHealth() {
		t.Error("Expected CheckHealth to return true")
	}
}

func TestGenerate(t *testing.T) {
	expectedResponse := "This is a mock response"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/generate" {
			t.Errorf("Expected path /api/generate, got %s", r.URL.Path)
		}

		var req generateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}

		if req.Model != "phi4" {
			t.Errorf("Expected model phi4, got %s", req.Model)
		}
		if req.Prompt != "Test Prompt" {
			t.Errorf("Expected prompt 'Test Prompt', got '%s'", req.Prompt)
		}
		if req.System != "System Prompt" {
			t.Errorf("Expected system 'System Prompt', got '%s'", req.System)
		}

		resp := generateResponse{
			Response: expectedResponse,
			Done:     true,
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "phi4", "")
	response, err := client.Generate("Test Prompt", "System Prompt")
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if response != expectedResponse {
		t.Errorf("Expected response '%s', got '%s'", expectedResponse, response)
	}
}
