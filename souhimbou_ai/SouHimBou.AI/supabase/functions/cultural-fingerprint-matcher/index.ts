import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CulturalFingerprintRequest {
  user_id: string;
  organization_id: string;
  platform_context?: string;
  adinkra_symbols?: string[];
}

interface AdinkraSymbolMapping {
  symbol: string;
  name: string;
  meaning: string;
  transformation_matrix: number[][];
  cultural_weight: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    ).auth.getUser(req.headers.get('authorization')?.replace('Bearer ', '') ?? '');

    if (authError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      return await generateCulturalFingerprint(req, supabase, user);
    } else if (req.method === 'GET') {
      return await validateCulturalFingerprint(req, supabase, user);
    }

    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Cultural fingerprint error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal processing error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateCulturalFingerprint(req: Request, supabase: any, user: any) {
  const payload: CulturalFingerprintRequest = await req.json();

  console.log('Generating cultural fingerprint for:', {
    user_id: payload.user_id,
    organization_id: payload.organization_id,
    platform_context: payload.platform_context || 'souhimbou:integration:bridge'
  });

  // Get Adinkra symbol mappings for SouHimBou platform
  const adinkraSymbols = getAdinkraSymbolMappings();
  
  // Generate cultural context matrix
  const culturalMatrix = generateCulturalMatrix(
    payload.user_id,
    payload.organization_id,
    payload.adinkra_symbols || ['GYE_NYAME', 'SANKOFA', 'DWENNIMMEN']
  );

  // Create unique cultural fingerprint
  const culturalFingerprint = await createCulturalFingerprint(
    culturalMatrix,
    payload.platform_context || 'souhimbou:integration:bridge'
  );

  // Calculate initial trust score based on cultural alignment
  const initialTrustScore = calculateInitialTrustScore(culturalMatrix, adinkraSymbols);

  // Store cultural fingerprint association
  await storeCulturalFingerprint(supabase, {
    user_id: payload.user_id,
    organization_id: payload.organization_id,
    cultural_fingerprint: culturalFingerprint,
    trust_score: initialTrustScore,
    adinkra_context: culturalMatrix,
    platform_context: payload.platform_context || 'souhimbou:integration:bridge'
  });

  return new Response(JSON.stringify({
    success: true,
    cultural_fingerprint: culturalFingerprint,
    initial_trust_score: initialTrustScore,
    adinkra_symbols: adinkraSymbols.slice(0, 3),
    platform_context: payload.platform_context || 'souhimbou:integration:bridge',
    generated_at: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function validateCulturalFingerprint(req: Request, supabase: any, user: any) {
  const url = new URL(req.url);
  const fingerprint = url.searchParams.get('fingerprint');
  const userId = url.searchParams.get('user_id');

  if (!fingerprint || !userId) {
    return new Response('Missing fingerprint or user_id parameter', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Validate fingerprint exists and belongs to user
  const { data: stored } = await supabase
    .from('ai_agent_chats')
    .select('*')
    .eq('user_id', userId)
    .contains('context', { cultural_fingerprint: fingerprint })
    .order('created_at', { ascending: false })
    .limit(1);

  const isValid = stored && stored.length > 0;
  const trustScore = isValid ? (stored[0].context?.trust_score || 75) : 0;

  return new Response(JSON.stringify({
    valid: isValid,
    trust_score: trustScore,
    platform_context: isValid ? (stored[0].context?.platform_context || 'souhimbou:integration:bridge') : null,
    validated_at: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getAdinkraSymbolMappings(): AdinkraSymbolMapping[] {
  return [
    {
      symbol: 'GYE_NYAME',
      name: 'Gye Nyame',
      meaning: 'Except for God - supremacy of divine power',
      transformation_matrix: [[1, 0], [0, 1]], // Identity - divine stability
      cultural_weight: 1.0
    },
    {
      symbol: 'SANKOFA',
      name: 'Sankofa',
      meaning: 'Return and get it - learning from the past',
      transformation_matrix: [[0, 1], [1, 0]], // Reflection - wisdom through time
      cultural_weight: 0.9
    },
    {
      symbol: 'DWENNIMMEN',
      name: 'Dwennimmen',
      meaning: 'Ram\'s horn - humility and wisdom',
      transformation_matrix: [[1, 1], [0, 1]], // Growth - humble advancement
      cultural_weight: 0.8
    },
    {
      symbol: 'ADWO',
      name: 'Adwo',
      meaning: 'Tranquility, peace, quiet',
      transformation_matrix: [[1, 0], [1, 1]], // Stability - peaceful growth
      cultural_weight: 0.7
    },
    {
      symbol: 'MPATAPO',
      name: 'Mpatapo',
      meaning: 'Knot of pacification - reconciliation',
      transformation_matrix: [[0, 1], [1, 1]], // Unity - bringing together
      cultural_weight: 0.8
    }
  ];
}

function generateCulturalMatrix(userId: string, organizationId: string, symbols: string[]) {
  const adinkraSymbols = getAdinkraSymbolMappings();
  
  // Create cultural context based on selected symbols
  const matrix = symbols.map(symbol => {
    const mapping = adinkraSymbols.find(s => s.symbol === symbol);
    return mapping ? mapping.transformation_matrix : [[1, 0], [0, 1]];
  });

  // Combine with user/org context
  const userHash = simpleHash(userId);
  const orgHash = simpleHash(organizationId);
  
  return {
    symbols,
    transformation_matrices: matrix,
    user_context: userHash % 100,
    org_context: orgHash % 100,
    cultural_alignment: symbols.length / adinkraSymbols.length
  };
}

async function createCulturalFingerprint(culturalMatrix: any, platformContext: string): Promise<string> {
  const contextString = JSON.stringify({
    matrices: culturalMatrix.transformation_matrices,
    symbols: culturalMatrix.symbols,
    platform: platformContext,
    timestamp: Math.floor(Date.now() / 1000)
  });

  // Create hash-like fingerprint (simplified for demo)
  const hash = simpleHash(contextString);
  return `khepra:${platformContext}:${hash.toString(16)}`;
}

function calculateInitialTrustScore(culturalMatrix: any, adinkraSymbols: AdinkraSymbolMapping[]): number {
  const baseScore = 75; // Base trust score
  
  // Calculate alignment bonus based on symbol selection
  const alignmentBonus = culturalMatrix.symbols.reduce((bonus: number, symbol: string) => {
    const mapping = adinkraSymbols.find(s => s.symbol === symbol);
    return bonus + (mapping ? mapping.cultural_weight * 10 : 0);
  }, 0);

  // Cultural diversity bonus (more symbols = higher trust)
  const diversityBonus = Math.min(culturalMatrix.symbols.length * 5, 20);
  
  return Math.min(baseScore + alignmentBonus + diversityBonus, 100);
}

async function storeCulturalFingerprint(supabase: any, data: any) {
  const { error } = await supabase.from('ai_agent_chats').insert({
    message_type: 'cultural_fingerprint_generation',
    message: 'Cultural fingerprint generated for SouHimBou AI platform integration',
    response: JSON.stringify({
      fingerprint: data.cultural_fingerprint,
      trust_score: data.trust_score,
      adinkra_context: data.adinkra_context
    }),
    context: {
      cultural_fingerprint: data.cultural_fingerprint,
      trust_score: data.trust_score,
      platform_context: data.platform_context,
      adinkra_symbols: data.adinkra_context.symbols
    },
    metadata: {
      source: 'cultural_fingerprint_matcher',
      platform_id: 'souhimbou-ai',
      generated_at: new Date().toISOString()
    },
    user_id: data.user_id,
    organization_id: data.organization_id
  });

  if (error) {
    console.error('Error storing cultural fingerprint:', error);
    throw error;
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}