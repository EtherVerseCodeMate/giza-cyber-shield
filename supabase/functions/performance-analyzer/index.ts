import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PerformanceAnalysisRequest {
  organization_id: string;
  analysis_type: 'real_time' | 'historical' | 'predictive' | 'optimization';
  time_range?: {
    start: string;
    end: string;
  };
  metrics_filter?: string[];
  optimization_level?: 'conservative' | 'moderate' | 'aggressive';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const analysisRequest: PerformanceAnalysisRequest = await req.json();
    const { organization_id, analysis_type } = analysisRequest;

    console.log(`Performance Analysis: ${analysis_type} for org ${organization_id}`);

    let analysisResults;

    switch (analysis_type) {
      case 'real_time':
        analysisResults = await performRealTimeAnalysis(supabase, organization_id);
        break;
      case 'historical':
        analysisResults = await performHistoricalAnalysis(supabase, organization_id, analysisRequest.time_range);
        break;
      case 'predictive':
        analysisResults = await performPredictiveAnalysis(supabase, organization_id);
        break;
      case 'optimization':
        analysisResults = await performOptimizationAnalysis(supabase, organization_id, analysisRequest.optimization_level);
        break;
      default:
        throw new Error(`Unknown analysis type: ${analysis_type}`);
    }

    // Store analysis results
    await supabase
      .from('enterprise_performance_analytics')
      .insert({
        organization_id,
        analytics_type: analysis_type,
        time_period_start: analysisRequest.time_range?.start || new Date().toISOString(),
        time_period_end: analysisRequest.time_range?.end || new Date().toISOString(),
        performance_data: analysisResults,
        generated_at: new Date().toISOString()
      });

    // Record performance metrics
    await supabase
      .from('open_controls_performance_metrics')
      .insert({
        organization_id,
        metric_type: 'performance_analysis',
        metric_name: `analysis_${analysis_type}_${Date.now()}`,
        metric_value: analysisResults.summary?.overall_score || 0,
        metric_metadata: {
          analysis_type,
          analysis_results: analysisResults
        }
      });

    console.log(`Performance Analysis completed: ${analysis_type}`);

    return new Response(JSON.stringify({
      success: true,
      analysis_type,
      results: analysisResults,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Performance Analysis Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Performance analysis encountered an error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performRealTimeAnalysis(supabase: any, organizationId: string) {
  console.log('Performing real-time performance analysis...');
  
  // Mock real-time metrics collection
  const currentMetrics = {
    timestamp: new Date().toISOString(),
    cpu_utilization: Math.random() * 100,
    memory_usage: Math.random() * 100,
    disk_io: Math.random() * 1000,
    network_throughput: Math.random() * 10000,
    response_time_ms: Math.random() * 500 + 50,
    error_rate: Math.random() * 5,
    concurrent_users: Math.floor(Math.random() * 1000) + 100,
    database_connections: Math.floor(Math.random() * 200) + 50
  };

  // Analyze current performance
  const analysis = {
    current_metrics: currentMetrics,
    health_status: getHealthStatus(currentMetrics),
    alerts: generateAlerts(currentMetrics),
    trends: {
      cpu_trend: Math.random() > 0.5 ? 'increasing' : 'stable',
      memory_trend: Math.random() > 0.5 ? 'increasing' : 'stable',
      response_time_trend: Math.random() > 0.5 ? 'improving' : 'stable'
    },
    recommendations: generateRealTimeRecommendations(currentMetrics)
  };

  return analysis;
}

async function performHistoricalAnalysis(supabase: any, organizationId: string, timeRange?: any) {
  console.log('Performing historical performance analysis...');
  
  const defaultTimeRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    end: new Date().toISOString()
  };
  
  const range = timeRange || defaultTimeRange;
  
  // Fetch historical metrics
  const { data: metrics } = await supabase
    .from('open_controls_performance_metrics')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('measurement_timestamp', range.start)
    .lte('measurement_timestamp', range.end)
    .order('measurement_timestamp');

  // Generate mock historical analysis
  const analysis = {
    time_range: range,
    summary: {
      total_data_points: metrics?.length || 0,
      average_response_time: 150 + Math.random() * 100,
      peak_cpu_usage: 60 + Math.random() * 30,
      uptime_percentage: 99.0 + Math.random() * 1.0,
      error_rate_avg: Math.random() * 2
    },
    trends: {
      performance_trend: Math.random() > 0.6 ? 'improving' : 'stable',
      usage_growth: Math.random() * 15 - 5, // -5% to +10% growth
      efficiency_score: 75 + Math.random() * 20
    },
    pattern_analysis: {
      peak_hours: ['09:00-11:00', '14:00-16:00'],
      low_usage_periods: ['02:00-06:00'],
      seasonal_patterns: ['Higher usage on weekdays', 'Lower weekend traffic']
    },
    bottlenecks_identified: [
      {
        type: 'database',
        frequency: 'moderate',
        impact: 'medium',
        recommendation: 'Optimize slow queries and consider read replicas'
      }
    ]
  };

  return analysis;
}

async function performPredictiveAnalysis(supabase: any, organizationId: string) {
  console.log('Performing predictive performance analysis...');
  
  // Mock predictive analysis using historical patterns
  const predictions = {
    forecast_period: '30_days',
    predictions: [
      {
        metric: 'cpu_utilization',
        predicted_trend: 'increasing',
        confidence: 0.82,
        predicted_values: generatePredictionSeries(45, 0.05, 30), // Base 45%, 5% growth, 30 days
        threshold_breach_probability: 0.15
      },
      {
        metric: 'response_time',
        predicted_trend: 'stable',
        confidence: 0.76,
        predicted_values: generatePredictionSeries(180, 0.02, 30), // Base 180ms, 2% growth, 30 days
        threshold_breach_probability: 0.08
      },
      {
        metric: 'concurrent_users',
        predicted_trend: 'increasing',
        confidence: 0.89,
        predicted_values: generatePredictionSeries(300, 0.08, 30), // Base 300, 8% growth, 30 days
        threshold_breach_probability: 0.25
      }
    ],
    risk_assessment: {
      overall_risk: 'medium',
      capacity_exhaustion_risk: 0.20,
      performance_degradation_risk: 0.15,
      recommended_actions: [
        'Monitor CPU usage closely over next 2 weeks',
        'Prepare scaling plan for user growth',
        'Review and optimize resource allocation'
      ]
    },
    recommended_interventions: [
      {
        intervention: 'scale_up_compute',
        trigger_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        expected_benefit: 'Prevent CPU bottlenecks',
        cost_impact: 'moderate'
      }
    ]
  };

  return predictions;
}

async function performOptimizationAnalysis(supabase: any, organizationId: string, optimizationLevel = 'moderate') {
  console.log(`Performing optimization analysis at ${optimizationLevel} level...`);
  
  // Mock optimization analysis
  const optimizations = {
    optimization_level: optimizationLevel,
    analysis_results: {
      current_efficiency_score: 72 + Math.random() * 18,
      potential_improvement: getOptimizationPotential(optimizationLevel),
      cost_benefit_ratio: 2.5 + Math.random() * 1.5
    },
    recommended_optimizations: [
      {
        category: 'resource_rightsizing',
        priority: 'high',
        description: 'Optimize compute resource allocation based on usage patterns',
        implementation_effort: 'low',
        expected_savings: 15,
        performance_impact: 'minimal',
        implementation_steps: [
          'Analyze resource utilization patterns',
          'Identify over-provisioned instances',
          'Gradually reduce resource allocation',
          'Monitor performance impact'
        ]
      },
      {
        category: 'caching_optimization',
        priority: 'medium',
        description: 'Implement intelligent caching strategies',
        implementation_effort: 'medium',
        expected_savings: 8,
        performance_impact: 'positive',
        implementation_steps: [
          'Analyze cache hit rates',
          'Implement tiered caching',
          'Optimize cache TTL settings',
          'Monitor cache performance'
        ]
      },
      {
        category: 'database_tuning',
        priority: 'high',
        description: 'Optimize database queries and indexing',
        implementation_effort: 'high',
        expected_savings: 20,
        performance_impact: 'significant',
        implementation_steps: [
          'Identify slow queries',
          'Create appropriate indexes',
          'Optimize query execution plans',
          'Implement query result caching'
        ]
      }
    ],
    auto_optimization_available: [
      {
        optimization: 'cache_tuning',
        can_auto_apply: true,
        confidence: 0.95,
        rollback_available: true
      },
      {
        optimization: 'resource_scaling',
        can_auto_apply: optimizationLevel === 'aggressive',
        confidence: 0.78,
        rollback_available: true
      }
    ],
    estimated_timeline: {
      quick_wins: '1-3 days',
      medium_impact: '1-2 weeks',
      major_optimizations: '3-4 weeks'
    }
  };

  return optimizations;
}

// Helper functions

function getHealthStatus(metrics: any) {
  const score = calculateHealthScore(metrics);
  
  if (score >= 90) return { status: 'excellent', score };
  if (score >= 75) return { status: 'good', score };
  if (score >= 60) return { status: 'fair', score };
  if (score >= 40) return { status: 'poor', score };
  return { status: 'critical', score };
}

function calculateHealthScore(metrics: any) {
  const cpuScore = Math.max(0, 100 - metrics.cpu_utilization);
  const memoryScore = Math.max(0, 100 - metrics.memory_usage);
  const responseScore = Math.max(0, 100 - (metrics.response_time_ms / 10));
  const errorScore = Math.max(0, 100 - (metrics.error_rate * 20));
  
  return (cpuScore + memoryScore + responseScore + errorScore) / 4;
}

function generateAlerts(metrics: any) {
  const alerts = [];
  
  if (metrics.cpu_utilization > 80) {
    alerts.push({
      type: 'warning',
      message: 'High CPU utilization detected',
      threshold: 80,
      current_value: metrics.cpu_utilization
    });
  }
  
  if (metrics.response_time_ms > 400) {
    alerts.push({
      type: 'warning',
      message: 'Response time above acceptable threshold',
      threshold: 400,
      current_value: metrics.response_time_ms
    });
  }
  
  if (metrics.error_rate > 3) {
    alerts.push({
      type: 'critical',
      message: 'Error rate exceeds maximum threshold',
      threshold: 3,
      current_value: metrics.error_rate
    });
  }
  
  return alerts;
}

function generateRealTimeRecommendations(metrics: any) {
  const recommendations = [];
  
  if (metrics.cpu_utilization > 70) {
    recommendations.push({
      type: 'scaling',
      priority: 'medium',
      message: 'Consider scaling up compute resources',
      impact: 'Improved performance and user experience'
    });
  }
  
  if (metrics.response_time_ms > 300) {
    recommendations.push({
      type: 'optimization',
      priority: 'high',
      message: 'Investigate and optimize slow operations',
      impact: 'Reduced response times and better user satisfaction'
    });
  }
  
  return recommendations;
}

function generatePredictionSeries(baseValue: number, growthRate: number, days: number) {
  const series = [];
  for (let i = 0; i < days; i++) {
    const trend = baseValue * Math.pow(1 + growthRate / 30, i); // Daily growth
    const noise = (Math.random() - 0.5) * baseValue * 0.1; // ±10% noise
    series.push(Math.max(0, trend + noise));
  }
  return series;
}

function getOptimizationPotential(level: string) {
  switch (level) {
    case 'conservative': return { min: 5, max: 15 };
    case 'moderate': return { min: 10, max: 25 };
    case 'aggressive': return { min: 20, max: 40 };
    default: return { min: 10, max: 25 };
  }
}