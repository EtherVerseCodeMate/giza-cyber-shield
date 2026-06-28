import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CUI detection patterns
const CUI_PATTERNS = [
  /\bFOUO\b/gi,                      // For Official Use Only
  /\bCUI\b/gi,                       // Controlled Unclassified Information
  /\bSECRET\b/gi,                    // SECRET classification
  /\bCONFIDENTIAL\b/gi,              // CONFIDENTIAL classification
  /\bNOFORN\b/gi,                    // No Foreign Nationals
  /\bSSN[:\s]*\d{3}-\d{2}-\d{4}/gi, // Social Security Numbers
  /\bCLASSIFICATION[:]/gi,           // Classification markers
  /\bFISA\b/gi,                      // Foreign Intelligence Surveillance Act
  /\bSCI\b/gi,                       // Sensitive Compartmented Information
  /\bSAR\b/gi,                       // Special Access Required
  /\bITAR\b/gi,                      // International Traffic in Arms Regulations
];

function detectCUI(inputData: string): { detected: boolean; matches: string[] } {
  const matches: string[] = [];
  
  for (const pattern of CUI_PATTERNS) {
    const found = inputData.match(pattern);
    if (found) {
      matches.push(...found.map(m => m.toUpperCase()));
    }
  }
  
  return {
    detected: matches.length > 0,
    matches: [...new Set(matches)] // Deduplicate
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data, enrollment_id } = await req.json();
    
    // Scan the data
    const scanResult = detectCUI(JSON.stringify(data));
    
    if (scanResult.detected) {
      // Initialize Supabase client
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Log CUI detection
      await supabaseClient.from('cui_detection_log').insert({
        enrollment_id,
        detection_type: 'automated_scan',
        detected_content: `Patterns: ${scanResult.matches.join(', ')}`,
        blocked: true,
        admin_review_required: true
      });
      
      return new Response(
        JSON.stringify({
          allowed: false,
          error: 'CUI detected in submission',
          message: 'This beta environment does not support CUI workloads. Detected markers: ' + scanResult.matches.join(', '),
          contact: 'support@nouchix.com for production GovCloud access',
          matches: scanResult.matches
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify({ allowed: true, message: 'No CUI detected' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});