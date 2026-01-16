import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-USER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Use the service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Use anon key for user authentication check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const currentUser = userData.user;
    if (!currentUser?.email) throw new Error("User not authenticated");
    
    logStep("Current user authenticated", { userId: currentUser.id, email: currentUser.email });

    // Check if current user is master admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('master_admin')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError || !profile?.master_admin) {
      throw new Error("Only master admin can create users");
    }

    logStep("Master admin verified");

    const requestBody = await req.json();
    const { email, password, username, full_name, security_clearance, department, role, master_admin } = requestBody;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    logStep("Creating new user", { email, username, full_name });

    // Create the authenticated user with admin privileges
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification for admin-created users
      user_metadata: {
        username,
        full_name,
        security_clearance: security_clearance || 'UNCLASSIFIED',
        department: department || 'Engineering',
        role: role || 'viewer',
        master_admin: master_admin || false
      }
    });

    if (createError) {
      logStep("Error creating user", { error: createError.message });
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUserData.user) {
      throw new Error("Failed to create user - no user data returned");
    }

    logStep("User created successfully", { userId: newUserData.user.id });

    // Log the action
    await supabaseAdmin.rpc('log_user_action', {
      action_type: 'user_created_by_admin',
      resource_type: 'user',
      resource_id: newUserData.user.id,
      details: {
        created_user_email: email,
        created_user_id: newUserData.user.id,
        created_by: currentUser.id,
        user_metadata: newUserData.user.user_metadata
      }
    });

    logStep("Action logged successfully");

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserData.user.id,
      email: newUserData.user.email
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-user", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});