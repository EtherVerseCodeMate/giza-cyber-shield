package llm

// Provider defines the interface for interacting with Large Language Models.
type Provider interface {
	// Generate sends a prompt to the LLM and returns the generated text response.
	Generate(prompt string, systemPrompt string) (string, error)

	// CheckHealth returns true if the LLM service is reachable.
	CheckHealth() bool
}
