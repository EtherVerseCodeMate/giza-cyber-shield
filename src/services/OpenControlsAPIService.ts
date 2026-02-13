/**
 * Open Controls API Service
 * Enterprise-grade DISA STIGs API connector with intelligent caching and performance monitoring
 */

import { supabase } from '@/integrations/supabase/client';
import { VirusTotalConnector } from './integrations/VirusTotalConnector';

export interface DISASTIGsAPIResponse {
  data: any;
  metadata: {
    response_time_ms: number;
    cached: boolean;
    api_version: string;
    data_freshness: string;
  };
}

export interface PerformanceMetrics {
  average_response_time: number;
  cache_hit_rate: number;
  error_rate: number;
  throughput_requests_per_minute: number;
}

export class OpenControlsAPIService {
  private static baseUrl = 'https://api.disa.mil/stigs'; // Mock URL - will be updated when actual API is available
  private static cacheTimeout = 3600000; // 1 hour in milliseconds

  /**
   * Connect to DISA STIGs API with authentication and rate limiting
   */
  static async authenticateWithDISA(organizationId: string, apiCredentials: {
    api_key?: string;
    client_id?: string;
    client_secret?: string;
  }): Promise<{ success: boolean; message: string; expires_at?: string }> {
    try {
      // Validate that real credentials were provided
      if (!apiCredentials.api_key && !(apiCredentials.client_id && apiCredentials.client_secret)) {
        return {
          success: false,
          message: 'DISA API credentials not configured. Provide api_key or client_id/client_secret pair.',
        };
      }

      // TODO: Replace with actual DISA STIGs API OAuth2 flow
      // For now, record the configuration attempt and return not-configured status
      await supabase
        .from('enhanced_open_controls_integrations')
        .upsert({
          organization_id: organizationId,
          integration_name: 'DISA STIGs API',
          api_endpoint: this.baseUrl,
          authentication_method: 'oauth2',
          sync_status: 'pending_configuration',
          performance_metrics: {
            last_auth_attempt: new Date().toISOString(),
            status: 'awaiting_disa_api_endpoint'
          },
          is_active: false
        });

      return {
        success: false,
        message: 'DISA STIGs API integration pending. Actual API endpoint and OAuth2 flow not yet configured.',
      };
    } catch (error) {
      console.error('DISA authentication failed:', error);
      throw error;
    }
  }

  /**
   * Fetch STIG catalog with intelligent caching
   */
  static async fetchSTIGCatalog(organizationId: string, filters?: {
    platform?: string;
    version?: string;
    severity?: string;
    updated_since?: string;
  }): Promise<DISASTIGsAPIResponse> {
    try {
      const cacheKey = `stig_catalog_${JSON.stringify(filters || {})}`;
      const endpoint = '/catalog';

      // Check cache first
      const cached = await this.getCachedData(organizationId, endpoint, cacheKey);
      if (cached) {
        return {
          data: cached.cached_data,
          metadata: {
            response_time_ms: 5, // Cache hit is very fast
            cached: true,
            api_version: '1.0',
            data_freshness: cached.created_at
          }
        };
      }

      // Mock API response - ready for real DISA API integration
      const startTime = Date.now();
      const mockData = {
        stigs: [
          {
            stig_id: 'RHEL_8_STIG',
            title: 'Red Hat Enterprise Linux 8 Security Technical Implementation Guide',
            version: 'V1R12',
            release_date: '2024-01-26',
            platform: 'RHEL 8',
            severity_levels: ['CAT I', 'CAT II', 'CAT III'],
            total_controls: 232
          },
          {
            stig_id: 'WIN_SERVER_2022_STIG',
            title: 'Microsoft Windows Server 2022 Security Technical Implementation Guide',
            version: 'V1R4',
            release_date: '2024-01-26',
            platform: 'Windows Server 2022',
            severity_levels: ['CAT I', 'CAT II', 'CAT III'],
            total_controls: 267
          }
        ],
        pagination: {
          total: 45,
          page: 1,
          per_page: 10
        }
      };

      const responseTime = Date.now() - startTime;

      // Cache the response
      await this.cacheData(organizationId, endpoint, cacheKey, mockData);

      // Record performance metrics
      await this.recordPerformanceMetric(organizationId, 'api_response_time', responseTime, {
        endpoint,
        cached: false
      });

      return {
        data: mockData,
        metadata: {
          response_time_ms: responseTime,
          cached: false,
          api_version: '1.0',
          data_freshness: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('STIG catalog fetch failed:', error);
      throw error;
    }
  }

  /**
   * Real-time vulnerability feed ingestion.
   *
   * Integration Priority:
   *   1. VirusTotal Enterprise (Alpha Connector) — if API key configured
   *   2. Legacy NVD/MITRE/DISA feeds — if feed integrations configured
   *   3. Explicit not_configured state — no integrations found
   */
  static async ingestVulnerabilityFeed(
    organizationId: string,
    feedSources: string[] = ['NVD', 'MITRE', 'DISA'],
    options?: {
      hashes?: string[];
      domains?: string[];
      ips?: string[];
      limit?: number;
    }
  ): Promise<{
    vulnerabilities_processed: number;
    threat_correlations: number;
    high_priority_alerts: number;
    feed_status: 'active' | 'not_configured' | 'rate_limited' | 'error';
    error_message?: string;
    items?: Array<{
      hash: string;
      type: string;
      detection_ratio: string;
      threat_label: string | null;
      severity: string;
      first_seen: string;
      last_analyzed: string;
      tags: string[];
    }>;
  }> {
    try {
      // ── Priority 1: VirusTotal Enterprise (Alpha Connector) ────────────
      const vtResult = await VirusTotalConnector.ingestThreatFeed(
        organizationId,
        options
      );

      // If VT is configured (even if it returned 0 results), use its response
      if (vtResult.feed_status !== 'not_configured') {
        return vtResult;
      }

      // ── Priority 2: Legacy feed integrations (NVD/MITRE/DISA) ─────────
      const { data: integrations, error: intError } = await supabase
        .from('enhanced_open_controls_integrations')
        .select('integration_name, is_active, sync_status')
        .eq('organization_id', organizationId)
        .in('integration_name', feedSources.map(s => `${s} Feed`))
        .eq('is_active', true);

      if (intError) throw intError;

      if (!integrations || integrations.length === 0) {
        return {
          vulnerabilities_processed: 0,
          threat_correlations: 0,
          high_priority_alerts: 0,
          feed_status: 'not_configured',
          error_message: 'No threat intelligence integrations configured. Add a VirusTotal API key in Settings > Integrations.',
          items: [],
        };
      }

      // Legacy feeds configured but not yet integrated with live API endpoints
      await this.recordPerformanceMetric(organizationId, 'vulnerability_ingestion', 0, {
        feed_sources: feedSources,
        status: 'legacy_feeds_configured_awaiting_api_integration',
        configured_feeds: integrations.length,
      });

      return {
        vulnerabilities_processed: 0,
        threat_correlations: 0,
        high_priority_alerts: 0,
        feed_status: 'not_configured',
        error_message: `Legacy feeds (${integrations.map(i => i.integration_name).join(', ')}) configured but API integration pending. Consider adding VirusTotal for immediate results.`,
        items: [],
      };
    } catch (error) {
      console.error('Vulnerability feed ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Get real-time performance metrics
   */
  static async getPerformanceMetrics(organizationId: string, timeRange: {
    start: string;
    end: string;
  }): Promise<PerformanceMetrics> {
    try {
      const { data, error } = await supabase
        .from('open_controls_performance_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('measurement_timestamp', timeRange.start)
        .lte('measurement_timestamp', timeRange.end);

      if (error) throw error;

      // Calculate aggregated metrics
      const responseTimeMetrics = data.filter(m => m.metric_type === 'api_response_time');
      const averageResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / responseTimeMetrics.length
        : 0;

      const cacheMetrics = data.filter(m => m.metric_type === 'cache_hit_rate');
      const cacheHitRate = cacheMetrics.length > 0
        ? cacheMetrics[cacheMetrics.length - 1].metric_value
        : 0;

      // Compute error_rate from actual error metrics
      const errorMetrics = data.filter(m => m.metric_type === 'error_rate');
      const errorRate = errorMetrics.length > 0
        ? errorMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / errorMetrics.length
        : 0;

      // Compute throughput from actual request count in the time range
      const startMs = new Date(timeRange.start).getTime();
      const endMs = new Date(timeRange.end).getTime();
      const durationMinutes = Math.max((endMs - startMs) / 60000, 1);
      const throughput = data.length / durationMinutes;

      return {
        average_response_time: Math.round(averageResponseTime),
        cache_hit_rate: Number(cacheHitRate),
        error_rate: errorRate,
        throughput_requests_per_minute: Math.round(throughput)
      };
    } catch (error) {
      console.error('Performance metrics fetch failed:', error);
      return {
        average_response_time: 0,
        cache_hit_rate: 0,
        error_rate: 0,
        throughput_requests_per_minute: 0
      };
    }
  }

  /**
   * Sync with Open Controls intelligence.
   * Returns not_configured status if the integration is not set up.
   */
  static async syncOpenControlsIntelligence(organizationId: string): Promise<{
    sync_status: 'success' | 'partial' | 'failed' | 'not_configured';
    intelligence_updates: number;
    configuration_recommendations: any[];
  }> {
    try {
      // Check if Open Controls integration is actually configured
      const { data: integration, error: intError } = await supabase
        .from('enhanced_open_controls_integrations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('integration_name', 'Open Controls Intelligence')
        .eq('is_active', true)
        .maybeSingle();

      if (intError) throw intError;

      if (!integration) {
        return {
          sync_status: 'not_configured',
          intelligence_updates: 0,
          configuration_recommendations: [],
        };
      }

      // TODO: Implement actual Open Controls API sync
      // For now, record that integration exists but API sync is pending
      await supabase
        .from('enhanced_open_controls_integrations')
        .update({
          last_sync_timestamp: new Date().toISOString(),
          sync_status: 'pending_api_integration',
          performance_metrics: {
            last_sync_attempt: new Date().toISOString(),
            status: 'api_endpoint_not_implemented'
          }
        })
        .eq('organization_id', organizationId)
        .eq('integration_name', 'Open Controls Intelligence');

      return {
        sync_status: 'not_configured',
        intelligence_updates: 0,
        configuration_recommendations: [],
      };
    } catch (error) {
      console.error('Open Controls sync failed:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private static async getCachedData(organizationId: string, endpoint: string, cacheKey: string) {
    const { data } = await supabase
      .from('disa_stigs_api_cache')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('api_endpoint', endpoint)
      .eq('cache_key', cacheKey)
      .gt('cache_expires_at', new Date().toISOString())
      .single();

    return data;
  }

  private static async cacheData(organizationId: string, endpoint: string, cacheKey: string, data: any) {
    const expiresAt = new Date(Date.now() + this.cacheTimeout).toISOString();

    await supabase
      .from('disa_stigs_api_cache')
      .upsert({
        organization_id: organizationId,
        api_endpoint: endpoint,
        cache_key: cacheKey,
        cached_data: data,
        cache_expires_at: expiresAt
      });
  }

  private static async recordPerformanceMetric(organizationId: string, metricType: string, value: number, metadata: any = {}) {
    await supabase
      .from('open_controls_performance_metrics')
      .insert({
        organization_id: organizationId,
        metric_type: metricType,
        metric_name: `${metricType}_${Date.now()}`,
        metric_value: value,
        metric_metadata: metadata
      });
  }
}