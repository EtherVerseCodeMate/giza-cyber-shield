package osint

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ShodanClient is a native Go implementation (No External Dependency)
type ShodanClient struct {
	apiKey []byte
	client *http.Client
}

// HostData maps the essential fields from Shodan's Host IP response
type HostData struct {
	IP         string   `json:"ip_str"`
	Ports      []int    `json:"ports"`
	Vulns      []string `json:"vulns"`
	Hostnames  []string `json:"hostnames"`
	Org        string   `json:"org"`
	OS         string   `json:"os"`
	LastUpdate string   `json:"last_update"`
}

func NewShodanClient(apiKey []byte) *ShodanClient {
	return &ShodanClient{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetHostInfo fetches IP intelligence directly
func (s *ShodanClient) GetHostInfo(ip string) (*HostData, error) {
	if len(s.apiKey) == 0 {
		return nil, fmt.Errorf("shodan api key not configured")
	}

	url := fmt.Sprintf("https://api.shodan.io/shodan/host/%s?key=%s", ip, string(s.apiKey))

	resp, err := s.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("ip not found in shodan")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("shodan API error: %d", resp.StatusCode)
	}

	var data HostData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &data, nil
}
