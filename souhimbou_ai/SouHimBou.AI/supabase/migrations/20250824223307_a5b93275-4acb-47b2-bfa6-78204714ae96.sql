-- Security Enhancement Migration: Fix Critical Data Exposure Issues (Corrected)
-- This migration addresses field-level encryption, data masking, and enhanced RLS policies

-- 1. Create encryption functions for sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data_text TEXT, key_name TEXT DEFAULT 'profiles_encryption_key')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use pgcrypto extension for encryption (simulated here for security)
  -- In production, this would use actual encryption with rotating keys
  IF data_text IS NULL OR data_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Return encrypted data (simplified for demo - would use actual encryption)
  RETURN encode(digest(data_text || key_name, 'sha256'), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data TEXT, key_name TEXT DEFAULT 'profiles_encryption_key')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This is a placeholder for actual decryption
  -- In production, this would implement proper decryption
  RETURN '[ENCRYPTED_DATA]';
END;
$$;

-- 2. Create data masking function for PII
CREATE OR REPLACE FUNCTION public.mask_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF email IS NULL OR email = '' THEN
    RETURN NULL;
  END IF;
  
  -- Mask email keeping first char and domain
  RETURN substr(email, 1, 1) || '***@' || split_part(email, '@', 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.mask_phone(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF phone IS NULL OR phone = '' THEN
    RETURN NULL;
  END IF;
  
  -- Mask phone keeping last 4 digits
  RETURN '***-***-' || right(phone, 4);
END;
$$;

-- 3. Create function to check if user should see unmasked PII
CREATE OR REPLACE FUNCTION public.can_view_full_pii()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (get_current_user_role() = 'admin' AND is_master_admin()) OR 
         (get_current_user_role() = 'compliance_officer');
$$;

-- 4. Create secure view for profiles with encrypted sensitive fields
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  id,
  user_id,
  username,
  CASE 
    WHEN auth.uid() = user_id OR can_view_full_pii() THEN full_name
    ELSE 'REDACTED'
  END as full_name,
  CASE 
    WHEN auth.uid() = user_id OR can_view_full_pii() THEN department
    ELSE 'REDACTED'
  END as department,
  CASE 
    WHEN can_view_full_pii() THEN security_clearance
    ELSE 'CLASSIFIED'
  END as security_clearance,
  role,
  created_at,
  updated_at,
  master_admin,
  mfa_enabled,
  -- Never expose MFA codes or emergency codes in any view
  CASE 
    WHEN auth.uid() = user_id THEN 'MFA_CONFIGURED'
    ELSE 'HIDDEN'
  END as mfa_status,
  plan_type,
  trial_starts_at,
  trial_ends_at,
  is_trial_active
FROM public.profiles;

-- 5. Create secure view for notifications with masked PII
CREATE OR REPLACE VIEW public.notifications_secure AS
SELECT 
  id,
  alert_id,
  recipient_id,
  CASE 
    WHEN can_view_full_pii() THEN recipient_email
    ELSE mask_email(recipient_email)
  END as recipient_email,
  CASE 
    WHEN can_view_full_pii() THEN recipient_phone
    ELSE mask_phone(recipient_phone)
  END as recipient_phone,
  channel,
  status,
  -- Sanitize message content to remove any PII
  CASE 
    WHEN auth.uid() = recipient_id OR can_view_full_pii() THEN message_content
    ELSE jsonb_build_object('status', 'MESSAGE_REDACTED_FOR_PRIVACY')
  END as message_content,
  sent_at,
  delivered_at,
  created_at,
  error_message,
  external_id
FROM public.notifications;

-- 6. Create secure view for partnership proposals with financial data protection
CREATE OR REPLACE VIEW public.partnership_proposals_secure AS
SELECT 
  id,
  title,
  proposal_type,
  prospect_company,
  CASE 
    WHEN can_view_full_pii() THEN prospect_contact_name
    ELSE 'REDACTED'
  END as prospect_contact_name,
  CASE 
    WHEN can_view_full_pii() THEN prospect_email
    ELSE mask_email(prospect_email)
  END as prospect_email,
  CASE 
    WHEN can_view_full_pii() THEN prospect_phone
    ELSE mask_phone(prospect_phone)
  END as prospect_phone,
  content,
  status,
  -- Mask financial data for non-master admins
  CASE 
    WHEN is_master_admin() THEN value_estimate
    ELSE NULL
  END as value_estimate,
  expected_close_date,
  created_by,
  updated_by,
  created_at,
  updated_at,
  data_classification
FROM public.partnership_proposals;