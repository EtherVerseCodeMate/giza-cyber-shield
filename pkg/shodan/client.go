package shodan

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const baseURL = "https://api.shodan.io"

type Client struct {
	apiKey string
	client *http.Client
}

type HostInfo struct {
	IP        string   `json:"ip_str"`
	Ports     []int    `json:"ports"`
	Hostnames []string `json:"hostnames"`
	OS        string   `json:"os"`
	Data      []struct {
		Port      int    `json:"port"`
		Transport string `json:"transport"`
		Product   string `json:"product"`
	} `json:"data"`
}

func New(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetHost returns information about an IP address
func (c *Client) GetHost(ip string) (*HostInfo, error) {
	url := fmt.Sprintf("%s/shodan/host/%s?key=%s", baseURL, ip, c.apiKey)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("host not found in shodan")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("shodan API error: %s", resp.Status)
	}

	var host HostInfo
	if err := json.NewDecoder(resp.Body).Decode(&host); err != nil {
		return nil, err
	}

	return &host, nil
}
