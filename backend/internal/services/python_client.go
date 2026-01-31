package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

type PythonServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewPythonServiceClient(baseURL string) *PythonServiceClient {
	return &PythonServiceClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// ExportRequest represents export parameters
type ExportRequest struct {
	Format      string                 `json:"format"` // png, svg, pdf
	Width       int                    `json:"width"`
	Height      int                    `json:"height"`
	DPI         int                    `json:"dpi"`
	Content     map[string]interface{} `json:"content"`
	CanvasState map[string]interface{} `json:"canvas_state"`
}

// ExportResponse represents export result
type ExportResponse struct {
	Success  bool   `json:"success"`
	Data     []byte `json:"data,omitempty"`
	MimeType string `json:"mime_type,omitempty"`
	Error    string `json:"error,omitempty"`
}

// LayoutRequest represents auto-layout parameters
type LayoutRequest struct {
	Algorithm string                 `json:"algorithm"` // force, hierarchical, circular, grid
	Nodes     []LayoutNode           `json:"nodes"`
	Edges     []LayoutEdge           `json:"edges"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

type LayoutNode struct {
	ID     string  `json:"id"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	X      float64 `json:"x,omitempty"`
	Y      float64 `json:"y,omitempty"`
}

type LayoutEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// LayoutResponse represents layout result
type LayoutResponse struct {
	Success bool               `json:"success"`
	Nodes   []LayoutNodeResult `json:"nodes,omitempty"`
	Error   string             `json:"error,omitempty"`
}

type LayoutNodeResult struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
}

// EncryptRequest represents encryption parameters
type EncryptRequest struct {
	Data     string `json:"data"`
	Password string `json:"password"`
}

// EncryptResponse represents encryption result
type EncryptResponse struct {
	Success       bool   `json:"success"`
	EncryptedData string `json:"encrypted_data,omitempty"`
	IV            string `json:"iv,omitempty"`
	Error         string `json:"error,omitempty"`
}

// DecryptRequest represents decryption parameters
type DecryptRequest struct {
	EncryptedData string `json:"encrypted_data"`
	Password      string `json:"password"`
	IV            string `json:"iv"`
}

// DecryptResponse represents decryption result
type DecryptResponse struct {
	Success bool   `json:"success"`
	Data    string `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

// Export exports diagram to specified format
func (c *PythonServiceClient) Export(ctx context.Context, req *ExportRequest) (*ExportResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/export/"+req.Format, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &ExportResponse{
			Success: false,
			Error:   fmt.Sprintf("export failed with status %d: %s", resp.StatusCode, string(body)),
		}, nil
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return &ExportResponse{
		Success:  true,
		Data:     data,
		MimeType: resp.Header.Get("Content-Type"),
	}, nil
}

// AutoLayout applies automatic layout to nodes
func (c *PythonServiceClient) AutoLayout(ctx context.Context, req *LayoutRequest) (*LayoutResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/layout/auto", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var result LayoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Encrypt encrypts data with password
func (c *PythonServiceClient) Encrypt(ctx context.Context, req *EncryptRequest) (*EncryptResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/encryption/encrypt", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var result EncryptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// Decrypt decrypts data with password
func (c *PythonServiceClient) Decrypt(ctx context.Context, req *DecryptRequest) (*DecryptResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/encryption/decrypt", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var result DecryptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// HealthCheck checks if Python service is available
func (c *PythonServiceClient) HealthCheck(ctx context.Context) error {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}

// UploadImage uploads image to Python service for processing
func (c *PythonServiceClient) UploadImage(ctx context.Context, filename string, data []byte) (string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := part.Write(data); err != nil {
		return "", fmt.Errorf("failed to write file data: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close writer: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/upload/image", body)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Success bool   `json:"success"`
		URL     string `json:"url"`
		Error   string `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if !result.Success {
		return "", fmt.Errorf("upload failed: %s", result.Error)
	}

	return result.URL, nil
}
