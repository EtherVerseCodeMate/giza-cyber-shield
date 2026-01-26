import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API Types
export interface ScanRequest {
  target_url: string;
  scan_type: 'crypto' | 'stig' | 'full';
  priority?: number;
  metadata?: Record<string, string>;
  callback_url?: string;
}

export interface ScanResponse {
  scan_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  target_url: string;
  scan_type: string;
  queued_at: string;
  estimated_completion?: string;
  websocket_url: string;
}

export interface ScanStatus {
  scan_id: string;
  status: string;
  progress: number;
  started_at?: string;
  completed_at?: string;
  results?: {
    vulnerabilities_found?: number;
    crypto_issues?: number;
    stig_violations?: number;
  };
  errors?: string[];
  artifacts_url?: string;
}

export interface DAGNode {
  node_id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  parents: string[];
  children: string[];
  pqc_signature: string;
  verified: boolean;
}

export interface DAGGraph {
  nodes: DAGNode[];
  total_nodes: number;
  root_nodes: string[];
  latest_node: string;
  last_updated: string;
}

export interface STIGValidationRequest {
  stig_version: string;
  target_host: string;
  credentials?: Record<string, string>;
  controls?: string[];
}

export interface STIGCheckResult {
  control_id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pass' | 'fail' | 'not_applicable';
  finding?: string;
  remediation?: string;
}

export interface STIGValidationResponse {
  validation_id: string;
  stig_version: string;
  target_host: string;
  total_checks: number;
  passed: number;
  failed: number;
  not_applicable: number;
  score: number;
  results: STIGCheckResult[];
  timestamp: string;
}

export interface CMMCAuditFinding {
  ID: string;
  Title: string;
  Description: string;
  Severity: string;
  Status: string;
  Expected: string;
  Actual: string;
  Remediation: string;
  References: string[];
  CheckedAt: string;
}

export interface CMMCAuditResponse {
  Framework: string;
  Version: string;
  StartTime: string;
  EndTime: string;
  Duration: number;
  Passed: number;
  Failed: number;
  NotApplicable: number;
  ManualReview: number;
  TotalControls: number;
  Findings: CMMCAuditFinding[];
}

export interface STIGRemediationRequest {
  control_ids: string[];
  target_host: string;
}

export interface RemediationResult {
  control_id: string;
  status: 'success' | 'failed' | 'requires_manual';
  command: string;
  output: string;
  timestamp: string;
}

export interface STIGRemediationResponse {
  batch_id: string;
  results: RemediationResult[];
  summary: string;
  status: 'completed' | 'partial' | 'failed';
  timestamp: string;
}

export interface LicenseStatus {
  machine_id: string;
  organization: string;
  license_tier: string;
  features: string[];
  issued_at: string;
  expires_at: string;
  is_valid: boolean;
  days_remaining: number;
  revoked: boolean;
  last_heartbeat?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  dag_nodes: number;
  license_status: string;
  components: Record<string, string>;
  timestamp: string;
}

interface KhepraAPIConfig {
  baseUrl: string;
  apiKey: string;
}

// API Client class
class KhepraAPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: KhepraAPIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  // Scans
  async triggerScan(request: ScanRequest): Promise<ScanResponse> {
    return this.request<ScanResponse>('/api/v1/scans/trigger', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getScanStatus(scanId: string): Promise<ScanStatus> {
    return this.request<ScanStatus>(`/api/v1/scans/${scanId}`);
  }

  async listScans(page = 1, pageSize = 20, status?: string): Promise<{ scans: ScanResponse[]; total: number }> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) params.append('status', status);
    return this.request(`/api/v1/scans?${params}`);
  }

  // DAG
  async getDAGNodes(type?: string, limit = 100): Promise<DAGGraph> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) params.append('type', type);
    return this.request<DAGGraph>(`/api/v1/dag/nodes?${params}`);
  }

  // STIG
  async validateSTIG(request: STIGValidationRequest): Promise<STIGValidationResponse> {
    return this.request<STIGValidationResponse>('/api/v1/stig/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // License
  async getLicenseStatus(): Promise<LicenseStatus> {
    return this.request<LicenseStatus>('/api/v1/license/status');
  }

  // CMMC
  async getCMMCAudit(): Promise<CMMCAuditResponse> {
    return this.request<CMMCAuditResponse>('/api/v1/compliance/cmmc-audit');
  }

  // Remediation
  async remediateSTIG(request: STIGRemediationRequest): Promise<STIGRemediationResponse> {
    return this.request<STIGRemediationResponse>('/api/v1/stig/remediate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

// Hook for Khepra API
export function useKhepraAPI(baseUrl: string, apiKey: string) {
  const [client] = useState(() => new KhepraAPIClient({ baseUrl, apiKey }));
  const queryClient = useQueryClient();

  // Health query
  const healthQuery = useQuery({
    queryKey: ['khepra', 'health', baseUrl],
    queryFn: () => client.getHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // License status query
  const licenseQuery = useQuery({
    queryKey: ['khepra', 'license', baseUrl],
    queryFn: () => client.getLicenseStatus(),
    refetchInterval: 60000, // Refresh every minute
  });

  // DAG nodes query
  const dagQuery = useQuery({
    queryKey: ['khepra', 'dag', baseUrl],
    queryFn: () => client.getDAGNodes(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // CMMC Audit query
  const cmmcQuery = useQuery({
    queryKey: ['khepra', 'cmmc', baseUrl],
    queryFn: () => client.getCMMCAudit(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Trigger scan mutation
  const triggerScanMutation = useMutation({
    mutationFn: (request: ScanRequest) => client.triggerScan(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['khepra', 'scans', baseUrl] });
    },
  });

  // STIG validation mutation
  const validateSTIGMutation = useMutation({
    mutationFn: (request: STIGValidationRequest) => client.validateSTIG(request),
  });

  // STIG remediation mutation
  const remediateSTIGMutation = useMutation({
    mutationFn: (request: STIGRemediationRequest) => client.remediateSTIG(request),
    onSuccess: () => {
      // Refresh CMMC status after remediation
      queryClient.invalidateQueries({ queryKey: ['khepra', 'cmmc', baseUrl] });
    },
  });

  // Get scan status
  const getScanStatus = useCallback(
    (scanId: string) => client.getScanStatus(scanId),
    [client]
  );

  // List scans
  const listScans = useCallback(
    (page?: number, pageSize?: number, status?: string) =>
      client.listScans(page, pageSize, status),
    [client]
  );

  return {
    // Queries
    health: healthQuery,
    license: licenseQuery,
    dag: dagQuery,
    cmmc: cmmcQuery,

    // Mutations
    triggerScan: triggerScanMutation,
    validateSTIG: validateSTIGMutation,
    remediateSTIG: remediateSTIGMutation,

    // Methods
    getScanStatus,
    listScans,

    // Loading states
    isLoading: healthQuery.isLoading || licenseQuery.isLoading,
    isError: healthQuery.isError || licenseQuery.isError,
  };
}

// Hook for individual scan tracking
export function useKhepraScan(baseUrl: string, apiKey: string, scanId: string) {
  const [client] = useState(() => new KhepraAPIClient({ baseUrl, apiKey }));

  return useQuery({
    queryKey: ['khepra', 'scan', scanId, baseUrl],
    queryFn: () => client.getScanStatus(scanId),
    refetchInterval: 2000, // Poll every 2 seconds while scan is running
    enabled: !!scanId,
  });
}
