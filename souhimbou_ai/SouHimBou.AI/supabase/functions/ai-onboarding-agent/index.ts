import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userInput, currentPhase } = await req.json();
    console.log('AI Onboarding Agent called with:', { userInput, currentPhase });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AI system prompt based on current phase
    const systemPrompt = getSystemPrompt(currentPhase);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const aiResponse = data.choices[0].message.content;

    // Determine next action based on AI response and current phase
    const nextAction = determineNextAction(aiResponse, currentPhase, userInput);

    return new Response(JSON.stringify({ 
      aiResponse,
      nextAction,
      phase: nextAction.phase || currentPhase
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-onboarding-agent:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      aiResponse: "I apologize, but I'm experiencing technical difficulties. Please try again or contact support.",
      nextAction: { type: 'error' }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getSystemPrompt(phase: string): string {
  const basePrompt = `You are KHEPRA, an AI security expert specializing in enterprise infrastructure discovery and STIG compliance. You help organizations discover their technology stack and analyze security posture.`;

  switch (phase) {
    case 'discovery':
      return `${basePrompt}

Current Phase: Infrastructure Discovery
Your role: Help the user provide information about their infrastructure so we can perform automated discovery.

Guidelines:
- Ask for domain names, IP ranges, or organizational details
- Be conversational and helpful
- Keep responses under 100 words
- Guide them toward providing actionable information for scanning`;

    case 'analysis':
      return `${basePrompt}

Current Phase: Security Analysis
Your role: Explain the STIG compliance analysis process and findings.

Guidelines:
- Explain what STIG compliance means
- Help interpret security findings
- Suggest next steps for remediation
- Keep responses clear and actionable`;

    case 'integration':
      return `${basePrompt}

Current Phase: Integration Setup
Your role: Guide the user through setting up security integrations.

Guidelines:
- Explain available integrations (CrowdStrike, Splunk, etc.)
- Help prioritize which integrations to set up first
- Provide clear next steps
- Focus on immediate security value`;

    default:
      return `${basePrompt}

You are helping with general onboarding questions. Be helpful, concise, and guide users toward the next appropriate step in their security journey.`;
  }
}

function determineNextAction(aiResponse: string, currentPhase: string, userInput: string): any {
  const lowerInput = userInput.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();

  // Look for domain names or infrastructure details
  if (currentPhase === 'discovery') {
    const domainPattern = /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
    const domains = userInput.match(domainPattern);
    
    if (domains || lowerInput.includes('scan') || lowerInput.includes('discover')) {
      return {
        type: 'start_discovery',
        phase: 'analysis',
        data: { domains: domains || [] }
      };
    }
  }

  // Check if user is ready to proceed to next phase
  if (lowerInput.includes('yes') || lowerInput.includes('proceed') || lowerInput.includes('continue')) {
    switch (currentPhase) {
      case 'discovery':
        return { type: 'start_discovery', phase: 'analysis' };
      case 'analysis':
        return { type: 'start_integration', phase: 'integration' };
      case 'integration':
        return { type: 'complete_onboarding', phase: 'complete' };
    }
  }

  return { type: 'continue', phase: currentPhase };
}