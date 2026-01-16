-- Beta program enrollment tracking
CREATE TABLE public.beta_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  tier text CHECK (tier IN ('trailblazer_beta', 'mvp_1_beta', 'mvp_2_pilot')) NOT NULL,
  tier_pricing numeric,
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  max_assets integer DEFAULT 0 NOT NULL,
  current_asset_count integer DEFAULT 0 NOT NULL,
  beta_terms_accepted boolean DEFAULT false NOT NULL,
  cui_acknowledgment_signed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- CUI detection and blocking log
CREATE TABLE public.cui_detection_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.beta_enrollments(id),
  user_id uuid REFERENCES auth.users(id),
  detected_at timestamptz DEFAULT now() NOT NULL,
  detection_type text CHECK (detection_type IN ('keyword', 'pattern', 'manual_report', 'automated_scan')) NOT NULL,
  detected_content text,
  blocked boolean DEFAULT true NOT NULL,
  admin_review_required boolean DEFAULT true NOT NULL,
  admin_reviewed_by uuid,
  admin_reviewed_at timestamptz,
  resolution_notes text
);

-- Beta usage metrics for product validation
CREATE TABLE public.beta_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.beta_enrollments(id) NOT NULL,
  metric_date date DEFAULT CURRENT_DATE NOT NULL,
  assets_scanned integer DEFAULT 0,
  stig_searches integer DEFAULT 0,
  evidence_bundles_generated integer DEFAULT 0,
  dashboard_sessions integer DEFAULT 0,
  user_feedback_score integer CHECK (user_feedback_score BETWEEN 1 AND 5),
  feature_requests jsonb DEFAULT '[]'::jsonb,
  bug_reports jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.beta_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cui_detection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for beta_enrollments
CREATE POLICY "Users can view own beta enrollment" ON public.beta_enrollments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage beta enrollments" ON public.beta_enrollments
  FOR ALL USING (is_master_admin() OR get_current_user_role() = 'admin');

-- RLS Policies for cui_detection_log
CREATE POLICY "Users can view own CUI logs" ON public.cui_detection_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can log CUI detection" ON public.cui_detection_log
  FOR INSERT WITH CHECK (true);

-- RLS Policies for beta_usage_metrics
CREATE POLICY "Users can view own metrics" ON public.beta_usage_metrics
  FOR SELECT USING (
    enrollment_id IN (
      SELECT id FROM public.beta_enrollments WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert metrics" ON public.beta_usage_metrics
  FOR INSERT WITH CHECK (true);

-- Helper Functions
CREATE OR REPLACE FUNCTION public.has_beta_access(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beta_enrollments 
    WHERE user_id = user_uuid 
    AND beta_terms_accepted = true
    AND cui_acknowledgment_signed = true
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_beta_tier(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tier FROM public.beta_enrollments 
  WHERE user_id = user_uuid 
  AND (expires_at IS NULL OR expires_at > now())
  ORDER BY enrolled_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_beta_asset_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN current_asset_count < max_assets THEN true
    ELSE false
  END
  FROM public.beta_enrollments 
  WHERE user_id = user_uuid 
  AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_beta_enrollments_updated_at
  BEFORE UPDATE ON public.beta_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();