-- Enhanced RBAC policies and user management system

-- Add master_admin column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'master_admin') THEN
        ALTER TABLE public.profiles ADD COLUMN master_admin boolean DEFAULT false;
    END IF;
END $$;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create security definer function to check if user is master admin
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(master_admin, false) FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enhanced policies for profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- New comprehensive policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.get_current_user_role() IN ('admin') OR public.is_master_admin());

CREATE POLICY "Users can update their own basic profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  -- Users cannot modify their role, security_clearance, or master_admin status
  role = OLD.role AND 
  security_clearance = OLD.security_clearance AND 
  COALESCE(master_admin, false) = COALESCE(OLD.master_admin, false)
);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() IN ('admin') OR public.is_master_admin())
WITH CHECK (
  -- Only master admins can modify master_admin status
  (NOT (COALESCE(master_admin, false) != COALESCE(OLD.master_admin, false)) OR public.is_master_admin())
);

CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.get_current_user_role() IN ('admin') OR public.is_master_admin());

-- Enhanced policies for audit logs
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;

CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (public.get_current_user_role() IN ('admin') OR public.is_master_admin());

CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Enhanced policies for security events
DROP POLICY IF EXISTS "Authenticated users can view security events" ON public.security_events;

CREATE POLICY "Analysts and above can manage security events" 
ON public.security_events 
FOR ALL 
USING (public.get_current_user_role() IN ('admin', 'analyst', 'operator') OR public.is_master_admin())
WITH CHECK (public.get_current_user_role() IN ('admin', 'analyst', 'operator') OR public.is_master_admin());

-- Enhanced policies for threat intelligence
DROP POLICY IF EXISTS "Authenticated users can view threat intelligence" ON public.threat_intelligence;
DROP POLICY IF EXISTS "Users can create threat intelligence" ON public.threat_intelligence;

CREATE POLICY "Analysts and above can manage threat intelligence" 
ON public.threat_intelligence 
FOR ALL 
USING (public.get_current_user_role() IN ('admin', 'analyst', 'operator') OR public.is_master_admin())
WITH CHECK (public.get_current_user_role() IN ('admin', 'analyst', 'operator') OR public.is_master_admin());

-- Create function to log user actions
CREATE OR REPLACE FUNCTION public.log_user_action(
  action_type TEXT,
  resource_type TEXT DEFAULT NULL,
  resource_id TEXT DEFAULT NULL,
  details JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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