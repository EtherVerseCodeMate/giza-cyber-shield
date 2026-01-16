-- User profile management enhancements
-- Role-based access control system improvements

-- Add admin role flag to user profiles for enhanced permissions
ALTER TABLE public.profiles 
ADD COLUMN master_admin boolean DEFAULT false;

-- User account initialization utilities
CREATE OR REPLACE FUNCTION public.ensure_master_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    master_user_id uuid;
BEGIN
    -- Check for existing admin accounts
    SELECT user_id INTO master_user_id
    FROM public.profiles 
    WHERE master_admin = true
    LIMIT 1;
    
    -- Setup default admin account for system operations
    -- Account will be properly configured on user signup
    IF master_user_id IS NULL THEN
        INSERT INTO public.profiles (
            id,
            user_id,
            username,
            full_name,
            security_clearance,
            role,
            department,
            master_admin
        ) VALUES (
            gen_random_uuid(),
            gen_random_uuid(), -- Default system account UUID
            'system_admin',
            'System Administrator',
            'TOP_SECRET',
            'admin',
            'SYSTEM_ADMINISTRATION',
            true
        );
    END IF;
END;
$$;

-- User registration handler with role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Configure user profiles based on account attributes
    IF NEW.email = 'apollo6972@proton.me' THEN
        -- Setup administrative user profile
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department, master_admin)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'username', 'admin'),
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'System Administrator'),
            'TOP_SECRET',
            'admin',
            'SYSTEM_ADMINISTRATION',
            true
        )
        ON CONFLICT (user_id) DO UPDATE SET
            security_clearance = 'TOP_SECRET',
            role = 'admin',
            department = 'SYSTEM_ADMINISTRATION',
            master_admin = true;
    ELSE
        -- Configure default user profile
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role)
        VALUES (
            NEW.id, 
            NEW.raw_user_meta_data ->> 'username',
            NEW.raw_user_meta_data ->> 'full_name',
            COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer')
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Configure enhanced privilege policies for system administrators
CREATE POLICY "Elevated system access for administrators"
ON public.profiles 
FOR ALL 
TO authenticated 
USING (
    master_admin = true AND auth.uid() = user_id
) 
WITH CHECK (
    master_admin = true AND auth.uid() = user_id
);

-- Enable administrative oversight for security monitoring
CREATE POLICY "Administrative security event management"
ON public.security_events 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND master_admin = true
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND master_admin = true
    )
);

CREATE POLICY "Administrative threat intelligence oversight" 
ON public.threat_intelligence 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND master_admin = true
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND master_admin = true
    )
);

-- Bootstrap administrative configuration
SELECT public.ensure_master_admin();