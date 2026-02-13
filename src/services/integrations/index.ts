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
 *
 * Planned Connectors:
 *   - Datadog Metrics API (INT-001)
 *   - Tenable.io / ACAS (INT-002)
 *   - AWS Cost Explorer (INT-004)
 *   - Microsoft Defender TI (INT-012, INT-014)
 *   - HashiCorp Vault (INT-009)
 */

export { IntegrationKeyService } from './IntegrationKeyService';
export type { IntegrationProvider, IntegrationCredential } from './IntegrationKeyService';

export { VirusTotalConnector } from './VirusTotalConnector';
export type {
    VTFileReport,
    VTUrlReport,
    VTDomainReport,
    VTIPReport,
    VulnerabilityFeedResult,
} from './VirusTotalConnector';
