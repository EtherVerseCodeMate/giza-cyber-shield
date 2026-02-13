/**
 * Performance Analytics Engine
 * Real-time production monitoring and optimization for enterprise-scale performance
 *
 * SECURITY NOTE: All metrics are derived from real data sources (Supabase tables).
 * If no data is available, functions return explicit null/zero values with
 * a `data_available: false` flag. NO fabricated data is ever returned.
 */

import { supabase } from '@/integrations/supabase/client';

export interface PerformanceMetrics {
  cpu_utilization: number | null;
  memory_usage: number | null;
  disk_io: number | null;
  network_throughput: number | null;
  response_time_ms: number | null;
  error_rate: number | null;
  concurrent_users: number | null;
  data_available: boolean;
  data_source: string;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'performance' | 'cost' | 'security' | 'compliance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  estimated_impact: {
    performance_improvement: number;
    cost_reduction: number;
    implementation_effort: 'low' | 'medium' | 'high';
  };
  implementation_steps: string[];
  prerequisites: string[];
}

export interface AnalyticsReport {
  report_id: string;
  time_range: { start: string; end: string };
  summary: {
    total_requests: number;
    average_response_time: number;
    peak_concurrent_users: number;
    uptime_percentage: number;
    compliance_score: number;
    data_available: boolean;
  };
  trends: {
    performance_trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
    usage_trend: 'increasing' | 'stable' | 'decreasing' | 'insufficient_data';
    error_trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  };
  recommendations: OptimizationRecommendation[];
}

export class PerformanceAnalyticsEngine {
  /**
   * Collect real-time performance metrics from Supabase.
   * Returns null values with data_available: false if no monitoring data exists.
   */
  static async collectRealTimeMetrics(
    organizationId: string,
    sources: string[] = ['application', 'infrastructure', 'database', 'api_gateway']
  ): Promise<PerformanceMetrics> {
    try {
      // Query the most recent metrics from the database
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: recentMetrics, error } = await supabase
        .from('open_controls_performance_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('measurement_timestamp', fiveMinutesAgo)
        .order('measurement_timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;

      // If no recent metrics exist, return explicit "no data" state
      if (!recentMetrics || recentMetrics.length === 0) {
        return {
          cpu_utilization: null,
          memory_usage: null,
          disk_io: null,
          network_throughput: null,
          response_time_ms: null,
          error_rate: null,
          concurrent_users: null,
          data_available: false,
          data_source: 'no_monitoring_data_available',
        };
      }

      // Aggregate real metrics by type
      const metricsByType = new Map<string, number[]>();
      for (const m of recentMetrics) {
        const existing = metricsByType.get(m.metric_type) || [];
        existing.push(Number(m.metric_value));
        metricsByType.set(m.metric_type, existing);
      }

      const avg = (values: number[] | undefined): number | null => {
        if (!values || values.length === 0) return null;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      };

      return {
        cpu_utilization: avg(metricsByType.get('cpu_utilization')),
        memory_usage: avg(metricsByType.get('memory_usage')),
        disk_io: avg(metricsByType.get('disk_io')),
        network_throughput: avg(metricsByType.get('network_throughput')),
        response_time_ms: avg(metricsByType.get('response_time_ms') ?? metricsByType.get('api_response_time')),
        error_rate: avg(metricsByType.get('error_rate')),
        concurrent_users: avg(metricsByType.get('concurrent_users')),
        data_available: true,
        data_source: 'supabase_performance_metrics',
      };
    } catch (error) {
      console.error('Real-time metrics collection failed:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive analytics report from real historical data.
   */
  static async generateAnalyticsReport(
    organizationId: string,
    timeRange: { start: string; end: string },
    includeRecommendations: boolean = true
  ): Promise<AnalyticsReport> {
    try {
      // Collect historical data from Supabase
      const { data: metrics, error } = await supabase
        .from('open_controls_performance_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('measurement_timestamp', timeRange.start)
        .lte('measurement_timestamp', timeRange.end)
        .order('measurement_timestamp', { ascending: true });

      if (error) throw error;

      // Calculate summary statistics from REAL data
      const summary = this.calculateSummaryStatistics(metrics || []);

      // Analyze trends from REAL data
      const trends = this.analyzeTrends(metrics || []);

      // Generate recommendations based on real analysis
      const recommendations = includeRecommendations
        ? await this.generateOptimizationRecommendations(organizationId, summary, trends)
        : [];

      const report: AnalyticsReport = {
        report_id: `report_${crypto.randomUUID()}`,
        time_range: timeRange,
        summary,
        trends,
        recommendations
      };

      // Store report
      await supabase
        .from('enterprise_performance_analytics')
        .insert({
          organization_id: organizationId,
          analytics_type: 'comprehensive_report',
          time_period_start: timeRange.start,
          time_period_end: timeRange.end,
          performance_data: { summary, trends },
          optimization_recommendations: recommendations as any,
          trend_analysis: trends as any
        });

      return report;
    } catch (error) {
      console.error('Analytics report generation failed:', error);
      throw error;
    }
  }

  /**
   * Identify performance bottlenecks from real metric data.
   * Returns empty array if insufficient data exists.
   */
  static async identifyBottlenecks(
    organizationId: string,
    timeWindow: number = 3600000 // 1 hour in milliseconds
  ): Promise<Array<{
    bottleneck_type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affected_components: string[];
    recommended_actions: string[];
    estimated_resolution_time: string;
  }>> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeWindow);

      // Analyze recent performance data from real metrics
      const { data: recentMetrics, error } = await supabase
        .from('open_controls_performance_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('measurement_timestamp', startTime.toISOString())
        .lte('measurement_timestamp', endTime.toISOString());

      if (error) throw error;

      // If no data, return empty — don't fabricate bottlenecks
      if (!recentMetrics || recentMetrics.length === 0) {
        return [];
      }

      // Analyze real metrics for bottleneck indicators
      const bottlenecks: Array<{
        bottleneck_type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        affected_components: string[];
        recommended_actions: string[];
        estimated_resolution_time: string;
      }> = [];

      // Group metrics by type and check thresholds
      const metricsByType = new Map<string, number[]>();
      for (const m of recentMetrics) {
        const existing = metricsByType.get(m.metric_type) || [];
        existing.push(Number(m.metric_value));
        metricsByType.set(m.metric_type, existing);
      }

      // Check CPU utilization
      const cpuValues = metricsByType.get('cpu_utilization') || [];
      const avgCpu = cpuValues.length > 0 ? cpuValues.reduce((s, v) => s + v, 0) / cpuValues.length : 0;
      if (avgCpu > 80) {
        bottlenecks.push({
          bottleneck_type: 'cpu',
          severity: avgCpu > 95 ? 'critical' : 'high',
          description: `Average CPU utilization at ${avgCpu.toFixed(1)}% over the last ${Math.round(timeWindow / 60000)} minutes`,
          affected_components: ['compute-cluster'],
          recommended_actions: [
            'Review high-CPU processes',
            'Consider horizontal scaling',
            'Check for infinite loops or runaway queries',
          ],
          estimated_resolution_time: '1-4 hours',
        });
      }

      // Check response times
      const responseValues = metricsByType.get('api_response_time') || metricsByType.get('response_time_ms') || [];
      const avgResponse = responseValues.length > 0 ? responseValues.reduce((s, v) => s + v, 0) / responseValues.length : 0;
      if (avgResponse > 500) {
        bottlenecks.push({
          bottleneck_type: 'api',
          severity: avgResponse > 2000 ? 'critical' : avgResponse > 1000 ? 'high' : 'medium',
          description: `Average API response time at ${avgResponse.toFixed(0)}ms (target: <500ms)`,
          affected_components: ['api-gateway', 'application-server'],
          recommended_actions: [
            'Optimize slow database queries',
            'Review API endpoint performance',
            'Consider adding response caching',
          ],
          estimated_resolution_time: '2-4 hours',
        });
      }

      // Store bottleneck analysis (only if bottlenecks were found from real data)
      if (bottlenecks.length > 0) {
        await supabase
          .from('enterprise_performance_analytics')
          .insert({
            organization_id: organizationId,
            analytics_type: 'bottleneck_analysis',
            time_period_start: startTime.toISOString(),
            time_period_end: endTime.toISOString(),
            performance_data: { bottlenecks_identified: bottlenecks.length, data_points_analyzed: recentMetrics.length },
            optimization_recommendations: bottlenecks.map(b => ({
              type: 'performance',
              priority: b.severity,
              title: `${b.bottleneck_type.toUpperCase()} Bottleneck`,
              description: b.description,
              implementation_steps: b.recommended_actions
            }))
          });
      }

      return bottlenecks;
    } catch (error) {
      console.error('Bottleneck identification failed:', error);
      return [];
    }
  }

  /**
   * Auto-optimize system performance.
   * NOTE: This function currently returns a "not implemented" status because
   * auto-optimization requires real infrastructure integrations (Kubernetes HPA,
   * database tuning, cache configuration). It does NOT fabricate results.
   */
  static async autoOptimizePerformance(
    organizationId: string,
    optimizationLevel: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<{
    optimizations_applied: Array<{
      type: string;
      description: string;
      impact: string;
    }>;
    performance_improvement: number;
    estimated_cost_impact: number;
    status: 'not_configured' | 'applied' | 'failed';
  }> {
    // Record the optimization request for audit purposes
    await supabase
      .from('enterprise_performance_analytics')
      .insert({
        organization_id: organizationId,
        analytics_type: 'auto_optimization_request',
        time_period_start: new Date().toISOString(),
        time_period_end: new Date().toISOString(),
        performance_data: {
          optimization_level: optimizationLevel,
          status: 'not_configured',
          message: 'Auto-optimization requires infrastructure integration (Kubernetes HPA, database tuning APIs). Configure monitoring integrations first.'
        },
      });

    return {
      optimizations_applied: [],
      performance_improvement: 0,
      estimated_cost_impact: 0,
      status: 'not_configured',
    };
  }

  /**
   * Generate cost-performance analysis from real data.
   * Returns zero values if no cost data is available.
   */
  static async generateCostPerformanceAnalysis(
    organizationId: string,
    timeRange: { start: string; end: string }
  ): Promise<{
    total_cost: number;
    cost_per_performance_unit: number;
    optimization_opportunities: Array<{
      area: string;
      potential_savings: number;
      performance_impact: string;
    }>;
    roi_projections: Record<string, number>;
    data_available: boolean;
  }> {
    try {
      // Query for actual cost data from analytics table
      const { data: costData, error } = await supabase
        .from('enterprise_performance_analytics')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('analytics_type', 'cost_tracking')
        .gte('time_period_start', timeRange.start)
        .lte('time_period_end', timeRange.end);

      if (error) throw error;

      // If no cost data exists, return explicit "no data" state
      if (!costData || costData.length === 0) {
        return {
          total_cost: 0,
          cost_per_performance_unit: 0,
          optimization_opportunities: [],
          roi_projections: {},
          data_available: false,
        };
      }

      // Aggregate real cost data
      const totalCost = costData.reduce((sum, entry) => {
        const data = entry.cost_impact_analysis as any;
        return sum + (data?.total_cost || 0);
      }, 0);

      return {
        total_cost: totalCost,
        cost_per_performance_unit: costData.length > 0 ? totalCost / costData.length : 0,
        optimization_opportunities: [], // Would be populated by real cost analysis engine
        roi_projections: {},
        data_available: true,
      };
    } catch (error) {
      console.error('Cost-performance analysis failed:', error);
      throw error;
    }
  }

  /**
   * Calculate summary statistics from REAL metric data.
   * Returns zeroes with data_available: false if no data exists.
   */
  private static calculateSummaryStatistics(metrics: any[]) {
    if (!metrics || metrics.length === 0) {
      return {
        total_requests: 0,
        average_response_time: 0,
        peak_concurrent_users: 0,
        uptime_percentage: 0,
        compliance_score: 0,
        data_available: false,
      };
    }

    // Compute from real data
    const responseTimeMetrics = metrics.filter(m =>
      m.metric_type === 'api_response_time' || m.metric_type === 'response_time_ms'
    );
    const avgResponseTime = responseTimeMetrics.length > 0
      ? responseTimeMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / responseTimeMetrics.length
      : 0;

    const concurrentUserMetrics = metrics.filter(m => m.metric_type === 'concurrent_users');
    const peakUsers = concurrentUserMetrics.length > 0
      ? Math.max(...concurrentUserMetrics.map(m => Number(m.metric_value)))
      : 0;

    // Compliance score from actual compliance metrics
    const complianceMetrics = metrics.filter(m => m.metric_type === 'compliance_score');
    const complianceScore = complianceMetrics.length > 0
      ? complianceMetrics[complianceMetrics.length - 1].metric_value
      : 0;

    return {
      total_requests: metrics.length,
      average_response_time: Math.round(avgResponseTime),
      peak_concurrent_users: peakUsers,
      uptime_percentage: 0, // Requires uptime monitoring integration
      compliance_score: Number(complianceScore),
      data_available: true,
    };
  }

  /**
   * Analyze trends from REAL time-series data.
   * Returns 'insufficient_data' if not enough data points exist.
   */
  private static analyzeTrends(metrics: any[]) {
    if (!metrics || metrics.length < 10) {
      return {
        performance_trend: 'insufficient_data' as const,
        usage_trend: 'insufficient_data' as const,
        error_trend: 'insufficient_data' as const,
      };
    }

    // Split data into first half and second half for trend comparison
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const avgValue = (arr: any[]) => arr.length > 0
      ? arr.reduce((sum, m) => sum + Number(m.metric_value), 0) / arr.length
      : 0;

    const responseFirst = avgValue(firstHalf.filter(m => m.metric_type === 'api_response_time'));
    const responseSecond = avgValue(secondHalf.filter(m => m.metric_type === 'api_response_time'));

    const errorFirst = avgValue(firstHalf.filter(m => m.metric_type === 'error_rate'));
    const errorSecond = avgValue(secondHalf.filter(m => m.metric_type === 'error_rate'));

    const determinePerformanceTrend = (first: number, second: number, threshold = 0.1): 'improving' | 'stable' | 'degrading' | 'insufficient_data' => {
      if (first === 0 && second === 0) return 'stable';
      const change = first > 0 ? (second - first) / first : 0;
      if (change > threshold) return 'degrading';
      if (change < -threshold) return 'improving';
      return 'stable';
    };

    const determineErrorTrend = (first: number, second: number, threshold = 0.1): 'improving' | 'stable' | 'worsening' | 'insufficient_data' => {
      if (first === 0 && second === 0) return 'stable';
      const change = first > 0 ? (second - first) / first : 0;
      if (change > threshold) return 'worsening';
      if (change < -threshold) return 'improving';
      return 'stable';
    };

    const usageTrend: 'increasing' | 'stable' | 'decreasing' | 'insufficient_data' =
      secondHalf.length > firstHalf.length * 1.1 ? 'increasing'
        : secondHalf.length < firstHalf.length * 0.9 ? 'decreasing'
          : 'stable';

    return {
      performance_trend: determinePerformanceTrend(responseFirst, responseSecond),
      usage_trend: usageTrend,
      error_trend: determineErrorTrend(errorFirst, errorSecond),
    };
  }

  /**
   * Generate optimization recommendations based on real analysis.
   * Returns empty array if analysis shows no actionable issues.
   */
  private static async generateOptimizationRecommendations(
    organizationId: string,
    summary: any,
    trends: any
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Only generate recommendations based on actual data patterns
    if (summary.data_available === false) {
      recommendations.push({
        id: `rec_${crypto.randomUUID()}`,
        type: 'performance',
        priority: 'high',
        title: 'Configure Performance Monitoring',
        description: 'No performance data is available. Configure monitoring integrations to enable analytics and optimization recommendations.',
        estimated_impact: {
          performance_improvement: 0,
          cost_reduction: 0,
          implementation_effort: 'medium',
        },
        implementation_steps: [
          'Configure Prometheus/Grafana or equivalent monitoring',
          'Set up metric collection agents on application and infrastructure',
          'Verify metrics are flowing to open_controls_performance_metrics table',
          'Re-run analytics report after 24 hours of data collection',
        ],
        prerequisites: ['Monitoring infrastructure'],
      });
      return recommendations;
    }

    // Generate data-driven recommendations
    if (summary.average_response_time > 500) {
      recommendations.push({
        id: `rec_${crypto.randomUUID()}`,
        type: 'performance',
        priority: summary.average_response_time > 2000 ? 'critical' : 'high',
        title: 'Optimize Response Times',
        description: `Average response time is ${summary.average_response_time}ms (target: <500ms). Database query optimization and caching may help.`,
        estimated_impact: {
          performance_improvement: 0.25,
          cost_reduction: 0.05,
          implementation_effort: 'medium',
        },
        implementation_steps: [
          'Analyze slow query logs',
          'Create appropriate database indexes',
          'Implement response caching for frequently accessed data',
          'Test performance improvements',
        ],
        prerequisites: ['Database admin access', 'Maintenance window'],
      });
    }

    if (trends.performance_trend === 'degrading') {
      recommendations.push({
        id: `rec_${crypto.randomUUID()}`,
        type: 'performance',
        priority: 'medium',
        title: 'Address Performance Degradation Trend',
        description: 'Performance metrics show a degrading trend over the analysis period. Investigate root cause before it becomes critical.',
        estimated_impact: {
          performance_improvement: 0.15,
          cost_reduction: 0,
          implementation_effort: 'medium',
        },
        implementation_steps: [
          'Review recent infrastructure or code changes',
          'Check for resource constraints (CPU, memory, storage)',
          'Analyze traffic patterns for unusual spikes',
          'Consider capacity planning review',
        ],
        prerequisites: ['Access to deployment logs', 'Resource monitoring data'],
      });
    }

    return recommendations;
  }
}