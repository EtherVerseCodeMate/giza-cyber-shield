-- Fix security issues from previous migration

-- Drop and recreate the view without security definer
DROP VIEW IF EXISTS public.usage_costs_summary;
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

-- Fix search path for functions
CREATE OR REPLACE FUNCTION public.track_resource_usage(
  p_organization_id UUID,
  p_resource_type TEXT,
  p_quantity DECIMAL,
  p_unit TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Fix search path for trigger function
CREATE OR REPLACE FUNCTION public.update_billing_period_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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