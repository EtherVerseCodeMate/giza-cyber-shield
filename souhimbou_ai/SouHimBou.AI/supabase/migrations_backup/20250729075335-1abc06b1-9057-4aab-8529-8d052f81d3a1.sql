-- Fix remaining functions that don't have proper search_path set
CREATE OR REPLACE FUNCTION public.log_user_action(action_type text, resource_type text DEFAULT NULL::text, resource_id text DEFAULT NULL::text, details jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    action_type,
    resource_type,
    resource_id,
    details,
    inet_client_addr(),
    now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_security_event(event_type text, severity text DEFAULT 'MEDIUM'::text, details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    details,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    'security_event',
    'security',
    jsonb_build_object(
      'event_type', event_type,
      'severity', severity,
      'details', details,
      'timestamp', now()
    ),
    inet_client_addr(),
    now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_document_action(doc_id uuid, action_name text, old_vals jsonb DEFAULT NULL::jsonb, new_vals jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.legal_document_audit (
    document_id,
    user_id,
    action,
    old_values,
    new_values,
    ip_address,
    created_at
  ) VALUES (
    doc_id,
    auth.uid(),
    action_name,
    old_vals,
    new_vals,
    inet_client_addr(),
    now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    username, 
    full_name, 
    security_clearance, 
    role,
    trial_starts_at,
    trial_ends_at,
    is_trial_active,
    plan_type
  )
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
    now(),
    now() + INTERVAL '14 days',
    true,
    'trial'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_agreements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_integration_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;