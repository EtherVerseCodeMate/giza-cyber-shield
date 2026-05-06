// pkg/g0dm0d3/server.go
// G0DM0D3 local brain — NO Ollama required.
// Works in 3 modes, in priority order:
//   1. Anthropic API (if ANTHROPIC_API_KEY set — or from Khepra License)
//   2. OpenRouter (if OPENROUTER_API_KEY set — cheapest fallback)
//   3. Offline mode (static responses only, no LLM)
//
// The user NEVER needs to install Ollama.
// The Khepra License includes an API key budget (tracked by telemetry).

package g0dm0d3

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "strings"
    "time"
)

// ── AI Provider Abstraction ──────────────────────────────

type AIProvider interface {
    Chat(messages []Message, stream bool) (string, error)
    StreamChat(messages []Message, w io.Writer) error
    Name() string
}

type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

// ── Provider 1: Anthropic (Claude) ─────────────────────

type AnthropicProvider struct {
    APIKey string
    Model  string // "claude-sonnet-4-6" (default)
}

func (p *AnthropicProvider) Name() string { return "Anthropic Claude" }

func (p *AnthropicProvider) Chat(messages []Message, stream bool) (string, error) {
    reqBody := map[string]interface{}{
        "model":      p.Model,
        "max_tokens": 4096,
        "messages":   messages,
        "system": `You are the AdinKhepra AI — a cybersecurity intelligence 
assistant specialized in CMMC, STIG, NIST 800-171, PQC migration, and 
zero-trust architecture. You have direct access to the AdinKhepra ASAF 
engine running on this system. When users ask about their compliance status, 
scan results, or security posture, you answer based on real data from the 
local DAG audit trail. You are concise, technically precise, and DoD-aware.`,
    }

    body, _ := json.Marshal(reqBody)
    req, _ := http.NewRequest("POST",
        "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
    req.Header.Set("x-api-key", p.APIKey)
    req.Header.Set("anthropic-version", "2023-06-01")
    req.Header.Set("content-type", "application/json")

    client := &http.Client{Timeout: 60 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return "", fmt.Errorf("anthropic request failed: %w", err)
    }
    defer resp.Body.Close()

    var result struct {
        Content []struct {
            Text string `json:"text"`
        } `json:"content"`
        Error struct {
            Message string `json:"message"`
        } `json:"error"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    if resp.StatusCode != 200 {
        return "", fmt.Errorf("anthropic error: %s", result.Error.Message)
    }
    if len(result.Content) == 0 {
        return "", fmt.Errorf("empty response from Anthropic")
    }
    return result.Content[0].Text, nil
}

func (p *AnthropicProvider) StreamChat(messages []Message, w io.Writer) error {
    // Streaming implementation for real-time token display in browser
    reqBody := map[string]interface{}{
        "model":      p.Model,
        "max_tokens": 4096,
        "messages":   messages,
        "stream":     true,
    }
    body, _ := json.Marshal(reqBody)
    req, _ := http.NewRequest("POST",
        "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
    req.Header.Set("x-api-key", p.APIKey)
    req.Header.Set("anthropic-version", "2023-06-01")
    req.Header.Set("content-type", "application/json")

    client := &http.Client{Timeout: 120 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    // Stream SSE events to the browser
    buf := make([]byte, 4096)
    for {
        n, err := resp.Body.Read(buf)
        if n > 0 {
            chunk := string(buf[:n])
            // Parse SSE and extract text deltas
            for _, line := range strings.Split(chunk, "\n") {
                if strings.HasPrefix(line, "data: ") {
                    data := strings.TrimPrefix(line, "data: ")
                    var event map[string]interface{}
                    if json.Unmarshal([]byte(data), &event) == nil {
                        if delta, ok := event["delta"].(map[string]interface{}); ok {
                            if text, ok := delta["text"].(string); ok {
                                fmt.Fprintf(w, "data: %s\n\n", text)
                            }
                        }
                    }
                }
            }
        }
        if err == io.EOF {
            break
        }
        if err != nil {
            return err
        }
    }
    return nil
}

// ── Provider 2: OpenRouter (50+ models, cheapest) ───────

type OpenRouterProvider struct {
    APIKey string
    Model  string // Default: "anthropic/claude-3.5-sonnet" or "mistralai/mistral-7b-instruct:free"
}

func (p *OpenRouterProvider) Name() string { return "OpenRouter" }

func (p *OpenRouterProvider) Chat(messages []Message, stream bool) (string, error) {
    reqBody := map[string]interface{}{
        "model":    p.Model,
        "messages": messages,
    }
    body, _ := json.Marshal(reqBody)
    req, _ := http.NewRequest("POST",
        "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
    req.Header.Set("Authorization", "Bearer "+p.APIKey)
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("HTTP-Referer", "https://adinkhepra.nouchix.com")

    client := &http.Client{Timeout: 60 * time.Second}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    var result struct {
        Choices []struct {
            Message struct {
                Content string `json:"content"`
            } `json:"message"`
        } `json:"choices"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    if len(result.Choices) == 0 {
        return "", fmt.Errorf("empty response from OpenRouter")
    }
    return result.Choices[0].Message.Content, nil
}

func (p *OpenRouterProvider) StreamChat(messages []Message, w io.Writer) error {
    return fmt.Errorf("streaming not yet implemented for OpenRouter")
}

// ── Provider 3: Offline (no LLM, rule-based) ────────────

type OfflineProvider struct{}

func (p *OfflineProvider) Name() string { return "Offline (Rule-Based)" }

func (p *OfflineProvider) Chat(messages []Message, stream bool) (string, error) {
    if len(messages) == 0 {
        return "AdinKhepra offline mode. No AI provider configured.", nil
    }
    last := strings.ToLower(messages[len(messages)-1].Content)

    switch {
    case strings.Contains(last, "stig") || strings.Contains(last, "scan"):
        return "Run `adinkhepra scan` to start a STIG assessment. Results will appear in the DAG viewer.", nil
    case strings.Contains(last, "license"):
        return "Check your license status with `adinkhepra license status`.", nil
    case strings.Contains(last, "pqc") || strings.Contains(last, "quantum"):
        return "Run `adinkhepra pqc inventory` to enumerate quantum-vulnerable assets.", nil
    case strings.Contains(last, "help"):
        return "Available commands: scan, harden, forensics, license, keygen, serve, dag, report", nil
    default:
        return "Offline mode: configure ANTHROPIC_API_KEY or OPENROUTER_API_KEY for full AI capabilities.", nil
    }
}

func (p *OfflineProvider) StreamChat(messages []Message, w io.Writer) error {
    resp, _ := p.Chat(messages, false)
    fmt.Fprintf(w, "data: %s\n\n", resp)
    return nil
}

// ── Factory: Auto-detect best available provider ────────

func NewBestAvailableProvider() AIProvider {
    // Priority 1: Anthropic (from env or Khepra license key)
    if key := getAnthropicKey(); key != "" {
        return &AnthropicProvider{
            APIKey: key,
            Model:  "claude-sonnet-4-6",
        }
    }
    // Priority 2: OpenRouter
    if key := os.Getenv("OPENROUTER_API_KEY"); key != "" {
        return &OpenRouterProvider{
            APIKey: key,
            Model:  "anthropic/claude-3.5-sonnet",
        }
    }
    // Priority 3: Offline — always works, no dependencies
    return &OfflineProvider{}
}

// getAnthropicKey checks env, then license file, then ~/.khepra/keys/
func getAnthropicKey() string {
    if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
        return key
    }
    // Check license-embedded key (for enterprise tier)
    // License capsule can include an API budget allocation
    if key := loadKeyFromLicense("anthropic_api_key"); key != "" {
        return key
    }
    return ""
}

func loadKeyFromLicense(field string) string {
    // Reads from ~/.khepra/license.json (decrypted by license layer)
    // This is how enterprise users get AI without managing their own API keys
    home, _ := os.UserHomeDir()
    data, err := os.ReadFile(home + "/.khepra/license_claims.json")
    if err != nil {
        return ""
    }
    var claims map[string]string
    if err := json.Unmarshal(data, &claims); err != nil {
        return ""
    }
    return claims[field]
}

// ── HTTP Handler: Chat endpoint ──────────────────────────

type G0DM0D3Server struct {
    Provider AIProvider
    History  []Message // In-memory session history
}

func (s *G0DM0D3Server) HandleChat(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Message string `json:"message"`
        Stream  bool   `json:"stream"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // Inject live system context into conversation
    systemContext := s.getSystemContext()
    userMsg := Message{Role: "user", Content: systemContext + req.Message}
    s.History = append(s.History, userMsg)

    if req.Stream {
        w.Header().Set("Content-Type", "text/event-stream")
        w.Header().Set("Cache-Control", "no-cache")
        w.Header().Set("Connection", "keep-alive")
        s.Provider.StreamChat(s.History, w)
        return
    }

    resp, err := s.Provider.Chat(s.History, false)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    s.History = append(s.History, Message{Role: "assistant", Content: resp})
    json.NewEncoder(w).Encode(map[string]string{
        "response": resp,
        "provider": s.Provider.Name(),
    })
}

// getSystemContext fetches live ASAF data to inject into AI prompt
func (s *G0DM0D3Server) getSystemContext() string {
    // TODO: pull from DAG, last scan results, license status
    // For now returns basic context
    return "[SYSTEM CONTEXT: AdinKhepra ASAF Engine running. " +
        "Last scan: available via /api/scan/latest. " +
        "License: valid. " +
        "DAG nodes: see /api/dag/state]\n\nUser query: "
}
