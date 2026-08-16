-- Create resource usage tracking tables
CREATE TABLE public.resource_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  resource_type TEXT NOT NULL, -- 'compute', 'storage', 'bandwidth', 'api_calls', 'threats_analyzed', 'compliance_scans'
  quantity DECIMAL(10,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- 'cpu_hours', 'gb_hours', 'mb_transferred', 'requests', 'scans'
  cost_per_unit DECIMAL(8,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10,4) GENERATED ALWAYS AS (quantity * cost_per_unit) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_period DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create billing periods table
CREATE TABLE public.billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'billed', 'paid'
  total_usage_cost DECIMAL(10,4) DEFAULT 0,
  base_subscription_cost DECIMAL(10,4) DEFAULT 0,
  total_amount DECIMAL(10,4) GENERATED ALWAYS AS (total_usage_cost + base_subscription_cost) STORED,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create usage quotas table
CREATE TABLE public.usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  quota_limit DECIMAL(10,4) NOT NULL,
  quota_period TEXT NOT NULL DEFAULT 'monthly', -- 'daily', 'monthly', 'annual'
  overage_rate DECIMAL(8,4) DEFAULT 0, -- cost per unit over quota
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, resource_type)
);

-- Create cost tracking view
CREATE VIEW public.usage_costs_summary AS
SELECT 
  r.organization_id,
  r.billing_period,
  r.resource_type,
  SUM(r.quantity) as total_quantity,
  r.unit,
  AVG(r.cost_per_unit) as avg_cost_per_unit,
  SUM(r.total_cost) as total_cost,
  COUNT(*) as usage_events
FROM public.resource_usage r
GROUP BY r.organization_id, r.billing_period, r.resource_type, r.unit;

-- Enable RLS
ALTER TABLE public.resource_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can view their usage" 
ON public.resource_usage FOR SELECT 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "System can insert usage records" 
ON public.resource_usage FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Organization members can view billing periods" 
ON public.billing_periods FOR SELECT 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Admins can manage billing periods" 
ON public.billing_periods FOR ALL 
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Organization members can view quotas" 
ON public.usage_quotas FOR SELECT 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Admins can manage quotas" 
ON public.usage_quotas FOR ALL 
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() = 'admin' OR is_master_admin())
);

-- Function to track resource usage
CREATE OR REPLACE FUNCTION public.track_resource_usage(
  p_organization_id UUID,
  p_resource_type TEXT,
  p_quantity DECIMAL,
  p_unit TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_id UUID;
  cost_per_unit DECIMAL(8,4);
BEGIN
  -- Get current cost per unit (this could be dynamic based on resource type)
  cost_per_unit := CASE p_resource_type
    WHEN 'compute' THEN 0.05 -- $0.05 per CPU hour
    WHEN 'storage' THEN 0.02 -- $0.02 per GB hour
    WHEN 'bandwidth' THEN 0.10 -- $0.10 per GB transferred
    WHEN 'api_calls' THEN 0.001 -- $0.001 per API call
    WHEN 'threats_analyzed' THEN 0.05 -- $0.05 per threat analyzed
    WHEN 'compliance_scans' THEN 1.00 -- $1.00 per compliance scan
    ELSE 0.01
  END;
  
  INSERT INTO public.resource_usage (
    organization_id,
    resource_type,
    quantity,
    unit,
    cost_per_unit,
    metadata
  ) VALUES (
    p_organization_id,
    p_resource_type,
    p_quantity,
    p_unit,
    cost_per_unit,
    p_metadata
  ) RETURNING id INTO usage_id;
  
  RETURN usage_id;
END;
$$;

-- Trigger to update billing periods total
CREATE OR REPLACE FUNCTION public.update_billing_period_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update billing period total when usage is added
  INSERT INTO public.billing_periods (organization_id, period_start, period_end, total_usage_cost)
  VALUES (
    NEW.organization_id,
    date_trunc('month', NEW.created_at)::date,
    (date_trunc('month', NEW.created_at) + interval '1 month - 1 day')::date,
    NEW.total_cost
  )
  ON CONFLICT (organization_id, period_start) 
  DO UPDATE SET 
    total_usage_cost = billing_periods.total_usage_cost + NEW.total_cost,
    updated_at = now();
    
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_billing_total_trigger
  AFTER INSERT ON public.resource_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_period_total();

-- Add unique constraint to billing periods
ALTER TABLE public.billing_periods 
ADD CONSTRAINT unique_org_period UNIQUE (organization_id, period_start);