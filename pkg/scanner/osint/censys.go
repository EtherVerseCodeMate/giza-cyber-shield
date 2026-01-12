package osint

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type CensysClient struct {
	apiID     []byte
	apiSecret []byte
	client    *http.Client
}

type CensysHostResponse struct {
	Code   int            `json:"code"`
	Status string         `json:"status"`
	Result CensysHostData `json:"result"`
}

type CensysHostData struct {
	IP       string `json:"ip"`
	Services []struct {
		Port      int    `json:"port"`
		Service   string `json:"service_name"`
		Transport string `json:"transport_protocol"`
	} `json:"services"`
	DNS struct {
		Names []string `json:"names"`
	} `json:"dns"`
	Location struct {
		Country string `json:"country"`
		City    string `json:"city"`
	} `json:"location"`
}

func NewCensysClient(apiID, apiSecret []byte) *CensysClient {
	return &CensysClient{
		apiID:     apiID,
		apiSecret: apiSecret,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *CensysClient) GetHostInfo(ip string) (*CensysHostData, error) {
	if len(c.apiID) == 0 || len(c.apiSecret) == 0 {
		return nil, fmt.Errorf("censys api credentials not configured")
	}

	url := fmt.Sprintf("https://search.censys.io/api/v2/hosts/%s", ip)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Basic Auth
	auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", c.apiID, c.apiSecret)))
	req.Header.Add("Authorization", "Basic "+auth)
	req.Header.Add("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("ip not found in censys")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("censys API error: %d", resp.StatusCode)
	}

	var parsed CensysHostResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	return &parsed.Result, nil
}
