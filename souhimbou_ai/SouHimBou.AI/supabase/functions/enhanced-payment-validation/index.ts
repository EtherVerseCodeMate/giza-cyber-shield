import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentValidationRequest {
  amount: number;
  currency: string;
  payment_type: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Enhanced payment validation request received');
    
    const requestBody = await req.json();
    const { amount, currency, payment_type, user_id, metadata }: PaymentValidationRequest = requestBody;
    
    // Enhanced input validation
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid positive amount is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Amount limits validation
    const MAX_AMOUNT = 999999; // $9,999.99 in cents
    const MIN_AMOUNT = 100; // $1.00 in cents
    
    if (amount > MAX_AMOUNT) {
      return new Response(
        JSON.stringify({ error: 'Amount exceeds maximum allowed limit' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (amount < MIN_AMOUNT) {
      return new Response(
        JSON.stringify({ error: 'Amount below minimum required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!currency || typeof currency !== 'string' || currency !== 'USD') {
      return new Response(
        JSON.stringify({ error: 'Only USD currency is supported' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validPaymentTypes = ['one_time', 'subscription', 'beta_subscription'];
    if (!payment_type || !validPaymentTypes.includes(payment_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `payment_validation:${clientIP}`;
    
    // Check recent validation attempts (in a real app, you'd use Redis or similar)
    const { data: recentAttempts } = await supabase
      .from('audit_logs')
      .select('created_at')
      .eq('action', 'payment_validation_attempt')
      .eq('ip_address', clientIP)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false });

    if (recentAttempts && recentAttempts.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Too many validation attempts. Please try again later.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log validation attempt
    await supabase.from('audit_logs').insert({
      action: 'payment_validation_attempt',
      resource_type: 'payment',
      details: {
        amount,
        currency,
        payment_type,
        user_id,
        metadata: metadata || {},
        client_ip: clientIP,
        validation_timestamp: new Date().toISOString()
      },
      ip_address: clientIP
    });

    // Additional validation based on payment type
    let validationResult = { valid: true, warnings: [] as string[] };

    if (payment_type === 'beta_subscription' && amount !== 1900) { // $19.00 in cents
      validationResult.warnings.push('Beta subscription amount does not match expected price');
    }

    if (user_id) {
      // Check user's payment history for fraud patterns
      const { data: paymentHistory } = await supabase
        .from('one_time_payments')
        .select('amount, created_at, status')
        .eq('user_id', user_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false });

      if (paymentHistory && paymentHistory.length > 5) {
        validationResult.warnings.push('High payment frequency detected');
      }
    }

    return new Response(
      JSON.stringify({
        valid: validationResult.valid,
        validated_amount: amount,
        validated_currency: currency,
        validated_payment_type: payment_type,
        warnings: validationResult.warnings,
        validation_timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Payment validation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Payment validation failed',
        message: 'Unable to validate payment. Please verify your information and try again.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});