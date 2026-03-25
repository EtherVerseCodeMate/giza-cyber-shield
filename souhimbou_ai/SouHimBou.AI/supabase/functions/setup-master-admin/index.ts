import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SetupMasterAdminRequest {
  user_email: string;
  setup_key: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Master admin setup request received');
    
    const requestBody = await req.json();
    const { user_email, setup_key }: SetupMasterAdminRequest = requestBody;
    
    // Enhanced input validation
    if (!user_email || typeof user_email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!setup_key || typeof setup_key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Setup key is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify setup key (you should set this as a secret)
    const expectedSetupKey = Deno.env.get('MASTER_ADMIN_SETUP_KEY');
    if (!expectedSetupKey || setup_key !== expectedSetupKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid setup key' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if any master admin already exists
    const { data: existingMasterAdmin, error: checkError } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('role_type', 'master_admin')
      .eq('is_active', true)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing master admin:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify master admin status' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (existingMasterAdmin && existingMasterAdmin.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Master admin already exists' }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find user by email
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('full_name', `%${user_email}%`)
      .maybeSingle();

    if (profileError) {
      console.error('Error finding user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to find user' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found with that email' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create master admin role
    const { error: roleError } = await supabase
      .from('admin_roles')
      .insert({
        user_id: userProfile.user_id,
        role_type: 'master_admin',
        granted_by: null, // System granted
        granted_at: new Date().toISOString(),
        expires_at: null, // Never expires
        is_active: true,
        metadata: {
          setup_method: 'initial_setup',
          setup_timestamp: new Date().toISOString(),
          setup_key_used: true
        }
      });

    if (roleError) {
      console.error('Error creating master admin role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to create master admin role' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Also update the profiles table for backward compatibility
    await supabase
      .from('profiles')
      .update({ master_admin: true })
      .eq('user_id', userProfile.user_id);

    // Log the master admin setup
    await supabase.from('audit_logs').insert({
      action: 'master_admin_setup_completed',
      resource_type: 'admin_role',
      resource_id: userProfile.user_id,
      details: {
        user_email,
        setup_timestamp: new Date().toISOString(),
        setup_method: 'edge_function'
      },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown'
    });

    console.log('Master admin setup completed successfully for:', user_email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Master admin role granted successfully',
        user_id: userProfile.user_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Master admin setup error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Setup failed',
        message: 'Unable to complete master admin setup. Please contact support.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});