import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecutiveRequest {
  action: 'threat-analysis' | 'cmmc-planning' | 'team-performance' | 'security-report';
  context?: any;
  userId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { action, context, userId }: ExecutiveRequest = await req.json();

    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user context and security data
    const { data: securityEvents } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: complianceData } = await supabase
      .from('compliance_frameworks')
      .select('*')
      .eq('framework', 'CMMC');

    let systemPrompt = `You are an executive AI assistant for a cybersecurity platform. You provide concise, actionable insights for C-level executives focusing on security posture, compliance, and business impact.`;

    let userPrompt = '';

    switch (action) {
      case 'threat-analysis':
        systemPrompt += ` You're analyzing active security threats and providing executive recommendations.`;
        userPrompt = `Based on the recent security events: ${JSON.stringify(securityEvents?.slice(0, 3))}, provide a brief executive summary of the current threat landscape and 3 specific recommended actions. Focus on business impact and urgency.`;
        break;

      case 'cmmc-planning':
        systemPrompt += ` You're providing CMMC compliance planning and timeline guidance.`;
        userPrompt = `Given current CMMC compliance status at 73%, provide an executive briefing on: 1) Key gaps to address, 2) Timeline to reach Level 3 certification, 3) Budget considerations. Keep it strategic and business-focused.`;
        break;

      case 'team-performance':
        systemPrompt += ` You're analyzing security team performance metrics.`;
        userPrompt = `The security team is exceeding KPIs this quarter. Provide an executive summary highlighting: 1) Key performance wins, 2) Areas for continued investment, 3) Strategic recommendations for scaling success. Focus on metrics that matter to leadership.`;
        break;

      case 'security-report':
        systemPrompt += ` You're generating a comprehensive security posture report.`;
        userPrompt = `Generate an executive security report covering: 1) Overall security posture (87% rating), 2) Critical action items, 3) Resource allocation recommendations. Include specific metrics and business impact assessment.`;
        break;

      default:
        throw new Error('Invalid action specified');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Log the AI interaction
    if (userId) {
      await supabase
        .from('ai_interactions')
        .insert({
          user_id: userId,
          interaction_type: `executive_${action}`,
          input: userPrompt,
          output: aiResponse,
          metadata: { context, action }
        });
    }

    return new Response(JSON.stringify({ 
      response: aiResponse,
      action,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in executive-ai-agent function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate AI insights'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});