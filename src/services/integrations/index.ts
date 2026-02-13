/**
 * Enterprise Integration Connectors
 * ══════════════════════════════════
 *
 * Centralized exports for all external API integrations.
 * Each connector follows the same pattern:
 *   1. Retrieve API key via IntegrationKeyService
 *   2. Make authenticated API call with rate limiting
 *   3. Return typed results or explicit failure state
 *   4. Track cost via ExternalApiCostTracker
 *
 * Active Connectors:
 *   - VirusTotal Enterprise (Alpha Connector) ✅
 *   - Datadog Metrics API ✅
 *   - STIGViewer API (replaces Tenable.io) ✅
 *
 * Planned Connectors:
 *   - AWS Cost Explorer (INT-004)
 *   - Microsoft Defender TI (INT-012, INT-014)
 *   - HashiCorp Vault (INT-009)
 */

// ─── Key Management ──────────────────────────────────────────────────────────
export { IntegrationKeyService } from './IntegrationKeyService';
export type { IntegrationProvider, IntegrationCredential } from './IntegrationKeyService';

// ─── Threat Intelligence ─────────────────────────────────────────────────────
export { VirusTotalConnector } from './VirusTotalConnector';
export type {
    VTFileReport,
    VTUrlReport,
    VTDomainReport,
    VTIPReport,
    VulnerabilityFeedResult,
} from './VirusTotalConnector';

// ─── Observability / Metrics ─────────────────────────────────────────────────
export { DatadogConnector } from './DatadogConnector';
export type {
    DatadogMetricPoint,
    DatadogTimeseriesResult,
    RealTimeMetricsResult,
    RequestVolumeResult,
} from './DatadogConnector';

// ─── Compliance / STIGs ──────────────────────────────────────────────────────
export { STIGViewerConnector } from './STIGViewerConnector';
export type {
    STIGViewerRule,
    STIGCatalogResult,
    ComplianceScoreResult,
    STIGQueryOptions,
} from './STIGViewerConnector';
