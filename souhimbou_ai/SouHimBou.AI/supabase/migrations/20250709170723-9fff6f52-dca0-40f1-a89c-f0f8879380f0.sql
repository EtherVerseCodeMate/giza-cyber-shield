-- Create user_agreements table to track legal document acceptance
CREATE TABLE public.user_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  agreement_type TEXT NOT NULL, -- 'tos', 'privacy', 'saas', 'beta', 'dod_compliance', 'liability_waiver', 'export_control'
  agreement_version TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own agreements" 
ON public.user_agreements 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own agreements" 
ON public.user_agreements 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all agreements" 
ON public.user_agreements 
FOR SELECT 
USING (
  (get_current_user_role() = 'admin'::text) OR 
  is_master_admin()
);

-- Create function to check if user has accepted all required agreements
CREATE OR REPLACE FUNCTION public.has_accepted_all_agreements(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'tos' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'privacy' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'saas' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'beta' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'dod_compliance' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'liability_waiver' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'export_control' 
    AND revoked_at IS NULL
  );
$$;

-- Create audit trigger for agreement updates
CREATE OR REPLACE FUNCTION public.update_user_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_agreements_updated_at
  BEFORE UPDATE ON public.user_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_agreements_updated_at();