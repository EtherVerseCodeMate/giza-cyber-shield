/**
 * ml-inference-proxy Edge Function
 *
 * Bridges the TypeScript frontend to the Python SouHimBou ML anomaly service.
 * Fetches real compliance/performance data for an organization, builds a
 * 32-dimensional feature vector, posts it to the ML service /predict endpoint,
 * and maps the anomaly score to PredictiveInsight objects.
 *
 * Environment variables required:
 *   ML_SERVICE_URL          — Base URL of the Python anomaly service (e.g. http://ml-service:8080)
 *   ML_SERVICE_API_KEY      — Internal API key for the ML service (ADINKHEPRA_ML_internal_api_key)
 *   SUPABASE_URL            — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS for internal aggregation)
 *   SUPABASE_ANON_KEY       — Anon key for user-scoped queries
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InferenceRequest {
  organization_id: string;
  model_id: string;
  input_data: {
    current_compliance_state?: Record<string, unknown>;
    recent_performance_metrics?: Record<string, unknown>;
    threat_intelligence?: Record<string, unknown>;
    configuration_changes?: Record<string, unknown>;
  };
}

interface PredictiveInsight {
  insight_id: string;
  type: 'compliance_risk' | 'performance_degradation' | 'security_threat' | 'optimization_opportunity';
  confidence_score: number;
  predicted_timeline: string;
  recommended_actions: string[];
  potential_impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affected_assets: string[];
    compliance_impact: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const mlServiceUrl = Deno.env.get('ML_SERVICE_URL');
    const mlApiKey = Deno.env.get('ML_SERVICE_API_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    if (!mlServiceUrl) {
      throw new Error('ML_SERVICE_URL must be set');
    }

    // Validate the requesting user.
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse ─────────────────────────────────────────────────────────────────
    const body: InferenceRequest = await req.json();
    if (!body.organization_id || !body.model_id) {
      return new Response(JSON.stringify({ error: 'organization_id and model_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch compliance telemetry (service role — internal aggregation) ──────
    const adminClient = createClient(supabaseUrl, serviceKey);

    const [assetsResult, metricsResult] = await Promise.all([
      adminClient
        .from('discovered_assets')
        .select('compliance_status, risk_score')
        .eq('organization_id', body.organization_id)
        .eq('is_active', true)
        .limit(50),
      adminClient
        .from('open_controls_performance_metrics')
        .select('metric_type, metric_value')
        .eq('organization_id', body.organization_id)
        .in('metric_type', ['cpu_usage', 'memory_usage', 'stig_violations'])
        .order('measurement_timestamp', { ascending: false })
        .limit(50),
    ]);

    const assets = assetsResult.data ?? [];
    const metrics = metricsResult.data ?? [];

    if (assets.length === 0 && metrics.length === 0) {
      return new Response(JSON.stringify({
        insights: [],
        message: 'Insufficient telemetry data for inference. Scan assets and collect performance metrics first.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Build 32-dim feature vector matching the model's expected input ───────
    // The SouHimBou model was trained on 32-dim vectors (config: feature_dim=32).
    // We encode real org telemetry into the same feature space.
    const features = buildFeatureVector(assets, metrics, body.input_data);

    // ── Call Python ML service ────────────────────────────────────────────────
    const mlHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (mlApiKey) mlHeaders['X-API-Key'] = mlApiKey;

    const mlResp = await fetch(`${mlServiceUrl}/predict`, {
      method: 'POST',
      headers: mlHeaders,
      body: JSON.stringify({
        features,
        metadata: {
          organization_id: body.organization_id,
          model_id: body.model_id,
          source: 'ml-inference-proxy',
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!mlResp.ok) {
      const errText = await mlResp.text();
      throw new Error(`ML service returned ${mlResp.status}: ${errText}`);
    }

    const prediction = await mlResp.json();

    // ── Map anomaly score → PredictiveInsight[] ───────────────────────────────
    const insights: PredictiveInsight[] = mapPredictionToInsights(
      prediction,
      body.organization_id,
      assets,
    );

    // ── Persist inference event for audit/feedback loop ───────────────────────
    await adminClient.from('open_controls_performance_metrics').insert({
      organization_id: body.organization_id,
      metric_type: 'model_training_complete',
      metric_name: body.model_id,
      metric_value: prediction.anomaly_score,
      metric_metadata: {
        prediction,
        insights_count: insights.length,
        feature_count: features.length,
        inferred_at: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ insights }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ml-inference-proxy]', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Feature engineering ────────────────────────────────────────────────────────

function buildFeatureVector(
  assets: Record<string, unknown>[],
  metrics: Record<string, unknown>[],
  inputData: InferenceRequest['input_data'],
): number[] {
  // 32-dimensional feature vector:
  // [0-7]   compliance aggregates
  // [8-15]  performance metrics
  // [16-23] threat intelligence signals
  // [24-31] configuration change signals
  const vec = new Array(32).fill(0);

  if (assets.length > 0) {
    const scores = assets
      .map((a) => (a.compliance_status as Record<string, number>)?.score ?? 0)
      .filter((s) => typeof s === 'number');
    const violations = assets
      .map((a) => (a.compliance_status as Record<string, number>)?.violations ?? 0)
      .filter((v) => typeof v === 'number');
    const riskScores = assets
      .map((a) => Number(a.risk_score ?? 0));

    vec[0] = assets.length / 100;  // normalized asset count
    vec[1] = avg(scores);
    vec[2] = avg(violations) / 100;
    vec[3] = avg(riskScores);
    vec[4] = Math.max(...(scores.length ? scores : [0]));
    vec[5] = Math.min(...(scores.length ? scores : [0]));
    vec[6] = stddev(scores);
    vec[7] = violations.reduce((a, b) => a + b, 0) / Math.max(assets.length, 1);
  }

  const cpuMetrics = metrics.filter((m) => m.metric_type === 'cpu_usage').map((m) => Number(m.metric_value));
  const memMetrics = metrics.filter((m) => m.metric_type === 'memory_usage').map((m) => Number(m.metric_value));
  const stigViolationMetrics = metrics.filter((m) => m.metric_type === 'stig_violations').map((m) => Number(m.metric_value));

  vec[8] = avg(cpuMetrics);
  vec[9] = avg(memMetrics);
  vec[10] = avg(stigViolationMetrics) / 100;
  vec[11] = Math.max(...(cpuMetrics.length ? cpuMetrics : [0]));
  vec[12] = Math.max(...(memMetrics.length ? memMetrics : [0]));
  vec[13] = stddev(cpuMetrics);
  vec[14] = stddev(memMetrics);
  vec[15] = (cpuMetrics.length + memMetrics.length) / 100;

  // Threat intelligence signals (from caller-provided context)
  const threat = inputData.threat_intelligence as Record<string, unknown> ?? {};
  vec[16] = Number(threat.threat_count ?? 0) / 100;
  vec[17] = Number(threat.critical_cves ?? 0) / 10;
  vec[18] = Number(threat.high_cves ?? 0) / 10;
  vec[19] = Number(threat.active_exploits ?? 0);

  // Config change signals
  const changes = inputData.configuration_changes as Record<string, unknown> ?? {};
  vec[24] = Number(changes.change_count ?? 0) / 100;
  vec[25] = Number(changes.unauthorized_changes ?? 0);

  // Clip all values to [-1, 1] for numeric stability
  return vec.map((v) => Math.max(-1, Math.min(1, isNaN(v) ? 0 : v)));
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ── Insight mapping ────────────────────────────────────────────────────────────

function mapPredictionToInsights(
  prediction: { anomaly_score: number; is_anomaly: boolean; confidence: number; archetype_influence: Record<string, number> },
  organizationId: string,
  assets: Record<string, unknown>[],
): PredictiveInsight[] {
  if (!prediction.is_anomaly || prediction.anomaly_score < 0.3) {
    return [];
  }

  const severity: PredictiveInsight['potential_impact']['severity'] =
    prediction.anomaly_score >= 0.85 ? 'critical'
    : prediction.anomaly_score >= 0.65 ? 'high'
    : prediction.anomaly_score >= 0.45 ? 'medium'
    : 'low';

  const type: PredictiveInsight['type'] =
    prediction.archetype_influence['Legacy Crypto (RSA/CBC)'] ? 'security_threat'
    : prediction.anomaly_score > 0.7 ? 'compliance_risk'
    : 'performance_degradation';

  const dominantArchetype = Object.entries(prediction.archetype_influence)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown pattern';

  const insight: PredictiveInsight = {
    insight_id: `ml_insight_${Date.now()}`,
    type,
    confidence_score: prediction.confidence,
    predicted_timeline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7-day horizon
    recommended_actions: buildRecommendedActions(type, dominantArchetype, severity),
    potential_impact: {
      severity,
      affected_assets: assets.slice(0, 5).map((a) => String(a.id ?? 'unknown')),
      compliance_impact: Math.round(prediction.anomaly_score * 100),
    },
  };

  return [insight];
}

function buildRecommendedActions(
  type: string,
  archetype: string,
  severity: string,
): string[] {
  const actions: string[] = [];
  if (type === 'compliance_risk' || type === 'security_threat') {
    actions.push('Run STIG compliance scan on flagged assets');
    actions.push('Review open STIG findings for critical controls');
  }
  if (archetype.includes('RSA') || archetype.includes('CBC')) {
    actions.push('Upgrade cipher suites from RSA/CBC to ECDHE/AES-GCM');
  }
  if (type === 'performance_degradation') {
    actions.push('Investigate CPU/memory spikes on detected assets');
  }
  if (severity === 'critical' || severity === 'high') {
    actions.push('Escalate to security operations center (SOC)');
    actions.push('Initiate incident response checklist');
  }
  if (!actions.length) {
    actions.push('Review anomaly details and validate with security analyst');
  }
  return actions;
}
