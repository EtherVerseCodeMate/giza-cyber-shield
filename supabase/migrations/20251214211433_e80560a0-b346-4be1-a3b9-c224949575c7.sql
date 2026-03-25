-- Create consulting_access table to track user purchases and subscriptions
CREATE TABLE public.consulting_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id text,
    diagnostic_paid boolean NOT NULL DEFAULT false,
    diagnostic_paid_at timestamp with time zone,
    advisory_requested boolean NOT NULL DEFAULT false,
    advisory_requested_at timestamp with time zone,
    advisory_approved boolean NOT NULL DEFAULT false,
    advisory_approved_at timestamp with time zone,
    advisory_approved_by uuid,
    subscription_id text,
    subscription_status text,
    subscription_updated_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.consulting_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access record
CREATE POLICY "Users can view their own consulting access"
ON public.consulting_access
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own access record (for initial creation)
CREATE POLICY "Users can create their own consulting access"
ON public.consulting_access
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can update any record (for webhooks)
CREATE POLICY "Service role can manage all consulting access"
ON public.consulting_access
FOR ALL
USING (auth.role() = 'service_role');

-- Admins can update advisory_approved
CREATE POLICY "Admins can approve advisory access"
ON public.consulting_access
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'admin'::user_role
    )
);

-- Create updated_at trigger
CREATE TRIGGER update_consulting_access_updated_at
    BEFORE UPDATE ON public.consulting_access
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_consulting_access_user_id ON public.consulting_access(user_id);
CREATE INDEX idx_consulting_access_stripe_customer_id ON public.consulting_access(stripe_customer_id);