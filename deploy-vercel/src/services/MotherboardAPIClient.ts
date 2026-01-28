/**
 * MotherboardAPIClient - Client for Khepra Protocol Backend API Server
 *
 * Connects to the Go-based Motherboard API server for:
 * - Environment Discovery (POST /api/v1/cc/discover)
 * - Compliance Assessment (POST /api/v1/cc/assess)
 * - Attestation/Proof (POST /api/v1/cc/prove/attest)
 * - Real-time Scan Updates (WebSocket /ws/scans)
 * - Rollback Management (POST /api/v1/cc/rollback/*)
 */

// API Response Types
export interface DiscoverOptions {
  mode: 'auto' | 'manual';
  profile?: 'linux' | 'windows' | 'container';
  cloud_provider?: 'aws' | 'azure' | 'gcp' | 'on-premises';
  endpoint_ids?: string[];
}

export interface DiscoverResponse {
  success: boolean;
  discovery_id: string;
  endpoints: DiscoveredEndpoint[];
  summary: {
    total_discovered: number;
    by_platform: Record<string, number>;
    by_provider: Record<string, number>;
  };
}

export interface DiscoveredEndpoint {
  id: string;
  hostname: string;
  platform: string;
  os_version: string;
  cloud_provider?: string;
  region?: string;
  discovered_at: string;
  stig_applicable: string[];
}

export interface AssessOptions {
  framework: 'STIG' | 'CMMC' | 'NIST-800-171' | 'NIST-800-172';
  endpoint_ids: string[];
  deep_scan?: boolean;
  stig_ids?: string[];
  profile?: string;
}

export interface AssessResponse {
  success: boolean;
  scan_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  results?: ComplianceResult[];
  summary?: {
    total_checks: number;
    passed: number;
    failed: number;
    not_applicable: number;
    score: number;
  };
}

export interface ComplianceResult {
  endpoint_id: string;
  stig_id: string;
  rule_id: string;
  status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_CHECKED';
  severity: 'CAT_I' | 'CAT_II' | 'CAT_III';
  finding?: string;
  remediation?: string;
}

export interface AttestationData {
  scan_id: string;
  organization_id: string;
  attester_id: string;
  attestation_type: 'compliance_scan' | 'remediation' | 'configuration_baseline';
  evidence_hashes: string[];
  metadata?: Record<string, any>;
}

export interface AttestationResponse {
  success: boolean;
  attestation_id: string;
  signature: string;
  timestamp: string;
  dag_node_id: string;
  verification_url: string;
}

export interface RollbackSnapshot {
  snapshot_id: string;
  endpoint_id: string;
  created_at: string;
  config_hash: string;
  size_bytes: number;
}

// WebSocket Event Types
export interface ScanProgressEvent {
  type: 'progress' | 'finding' | 'complete' | 'error';
  scan_id: string;
  data: {
    progress?: number;
    current_endpoint?: string;
    current_check?: string;
    finding?: ComplianceResult;
    error?: string;
  };
}

// API Error
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'MotherboardAPIError';
  }
}

// Main Client Class
export class MotherboardAPIClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private wsConnection: WebSocket | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ||
      import.meta.env.VITE_MOTHERBOARD_API_URL ||
      import.meta.env.NEXT_PUBLIC_API_URL ||
      'https://souhimbou-ai.fly.dev';
  }

  /**
   * Set API key (machine_id from license manager)
   */
  setApiKey(machineId: string): void {
    this.apiKey = machineId;
  }

  /**
   * Check if client is configured with API key
   */
  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  // ============================================
  // DISCOVERY ENDPOINTS
  // ============================================

  /**
   * Discover endpoints in the environment
   * POST /api/v1/cc/discover
   */
  async discover(options: DiscoverOptions): Promise<DiscoverResponse> {
    return this.post<DiscoverResponse>('/api/v1/cc/discover', options);
  }

  /**
   * Get discovery status
   * GET /api/v1/cc/discover/status?discovery_id=xxx
   */
  async getDiscoveryStatus(discoveryId: string): Promise<{ status: string; progress: number }> {
    return this.get(`/api/v1/cc/discover/status?discovery_id=${discoveryId}`);
  }

  /**
   * Register discovered endpoints
   * POST /api/v1/cc/discover/endpoints
   */
  async registerEndpoints(endpoints: Partial<DiscoveredEndpoint>[]): Promise<{ registered: number }> {
    return this.post('/api/v1/cc/discover/endpoints', { endpoints });
  }

  // ============================================
  // ASSESSMENT ENDPOINTS
  // ============================================

  /**
   * Start compliance assessment
   * POST /api/v1/cc/assess
   */
  async assess(options: AssessOptions): Promise<AssessResponse> {
    return this.post<AssessResponse>('/api/v1/cc/assess', options);
  }

  /**
   * Get assessment status
   * GET /api/v1/cc/assess/status?scan_id=xxx
   */
  async getAssessmentStatus(scanId: string): Promise<AssessResponse> {
    return this.get(`/api/v1/cc/assess/status?scan_id=${scanId}`);
  }

  /**
   * Get assessment results
   * GET /api/v1/cc/assess/results?scan_id=xxx
   */
  async getAssessmentResults(scanId: string): Promise<ComplianceResult[]> {
    const response = await this.get<{ results: ComplianceResult[] }>(
      `/api/v1/cc/assess/results?scan_id=${scanId}`
    );
    return response.results;
  }

  // ============================================
  // ATTESTATION/PROOF ENDPOINTS
  // ============================================

  /**
   * Create attestation for compliance proof
   * POST /api/v1/cc/prove/attest
   */
  async createAttestation(data: AttestationData): Promise<AttestationResponse> {
    return this.post<AttestationResponse>('/api/v1/cc/prove/attest', data);
  }

  /**
   * Verify attestation
   * GET /api/v1/cc/prove/verify?id=xxx
   */
  async verifyAttestation(attestationId: string): Promise<{
    valid: boolean;
    attestation: AttestationResponse;
    chain_verified: boolean;
  }> {
    return this.get(`/api/v1/cc/prove/verify?id=${attestationId}`);
  }

  /**
   * Export evidence package
   * POST /api/v1/cc/prove/export
   */
  async exportEvidence(options: {
    attestation_ids: string[];
    format: 'zip' | 'json' | 'oscal';
    include_raw_data?: boolean;
  }): Promise<{ download_url: string; expires_at: string }> {
    return this.post('/api/v1/cc/prove/export', options);
  }

  // ============================================
  // ROLLBACK ENDPOINTS
  // ============================================

  /**
   * Create configuration snapshot before changes
   * POST /api/v1/cc/rollback/snapshot
   */
  async createSnapshot(endpointId: string): Promise<RollbackSnapshot> {
    return this.post('/api/v1/cc/rollback/snapshot', { endpoint_id: endpointId });
  }

  /**
   * List available snapshots
   * GET /api/v1/cc/rollback/snapshots?endpoint_id=xxx
   */
  async listSnapshots(endpointId: string): Promise<RollbackSnapshot[]> {
    const response = await this.get<{ snapshots: RollbackSnapshot[] }>(
      `/api/v1/cc/rollback/snapshots?endpoint_id=${endpointId}`
    );
    return response.snapshots;
  }

  /**
   * Restore from snapshot
   * POST /api/v1/cc/rollback/restore
   */
  async restoreSnapshot(snapshotId: string): Promise<{ success: boolean; restored_at: string }> {
    return this.post('/api/v1/cc/rollback/restore', { snapshot_id: snapshotId });
  }

  // ============================================
  // WEBSOCKET CONNECTION
  // ============================================

  /**
   * Connect to real-time scan updates
   */
  connectToScanUpdates(
    scanId: string,
    onEvent: (event: ScanProgressEvent) => void,
    onError?: (error: Event) => void
  ): () => void {
    const wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const url = `${wsUrl}/ws/scans?scan_id=${scanId}&api_key=${this.apiKey}`;

    this.wsConnection = new WebSocket(url);

    this.wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ScanProgressEvent;
        onEvent(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.wsConnection.onerror = (event) => {
      if (onError) onError(event);
    };

    this.wsConnection.onclose = () => {
      this.wsConnection = null;
    };

    // Return cleanup function
    return () => {
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = null;
      }
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse<T>(response);
  }

  private async post<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    return this.handleResponse<T>(response);
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorCode: string | undefined;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
      } catch {
        // Use default error message
      }

      throw new APIError(errorMessage, response.status, errorCode);
    }

    return response.json();
  }
}

// Singleton instance for app-wide use
let clientInstance: MotherboardAPIClient | null = null;

export function getMotherboardClient(): MotherboardAPIClient {
  if (!clientInstance) {
    clientInstance = new MotherboardAPIClient();
  }
  return clientInstance;
}

export default MotherboardAPIClient;
