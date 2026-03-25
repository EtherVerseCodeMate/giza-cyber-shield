package ollama

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client implements the llm.Provider interface for Ollama.
type Client struct {
	BaseURL string
	Model   string
	ApiKey  string // Optional API Key
	Client  *http.Client
}

// NewClient creates a new Ollama client.
func NewClient(url, model, apiKey string) *Client {
	return &Client{
		BaseURL: url,
		Model:   model,
		ApiKey:  apiKey,
		Client:  &http.Client{Timeout: 60 * time.Second},
	}
}

type generateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	System string `json:"system,omitempty"` // System prompt (crucial for setting persona)
	Stream bool   `json:"stream"`
}

type generateResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

// Generate sends a prompt to the Ollama API.
func (c *Client) Generate(prompt string, systemPrompt string) (string, error) {
	reqBody := generateRequest{
		Model:  c.Model,
		Prompt: prompt,
		System: systemPrompt,
		Stream: false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/api/generate", c.BaseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.ApiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.ApiKey)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama API error: %s", resp.Status)
	}

	var genResp generateResponse
	if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
		return "", err
	}

	return genResp.Response, nil
}

// CheckHealth attempts to connect to the Ollama version endpoint.
func (c *Client) CheckHealth() bool {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/version", c.BaseURL), nil)
	if err != nil {
		return false
	}
	if c.ApiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.ApiKey)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
