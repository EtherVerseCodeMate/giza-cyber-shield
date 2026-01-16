-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'compliance_officer', 'operator', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update get_current_user_role to use user_roles table
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text 
  FROM public.user_roles 
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'analyst' THEN 2
      WHEN 'compliance_officer' THEN 3
      WHEN 'operator' THEN 4
      WHEN 'viewer' THEN 5
    END
  LIMIT 1
$$;

-- RLS Policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_master_admin()
);

-- Migrate existing roles from profiles table to user_roles
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT user_id, role::app_role, created_at
FROM public.profiles
WHERE role IS NOT NULL
  AND role IN ('admin', 'analyst', 'compliance_officer', 'operator', 'viewer')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);