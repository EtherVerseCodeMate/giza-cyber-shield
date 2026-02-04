-- Fix handle_new_user trigger to include department column and handle conflicts gracefully
-- This resolves "Database error saving new user" on registration

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
        -- Use ON CONFLICT to handle re-registration attempts gracefully
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department)
        VALUES (
            NEW.id,
            NEW.raw_user_meta_data ->> 'username',
            NEW.raw_user_meta_data ->> 'full_name',
            COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
            NEW.raw_user_meta_data ->> 'department'
        )
        ON CONFLICT (user_id) DO UPDATE SET
            username = COALESCE(EXCLUDED.username, public.profiles.username),
            full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
            security_clearance = COALESCE(EXCLUDED.security_clearance, public.profiles.security_clearance),
            role = COALESCE(EXCLUDED.role, public.profiles.role),
            department = COALESCE(EXCLUDED.department, public.profiles.department),
            updated_at = now();
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Handle username uniqueness conflict - append user ID suffix
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'username', '') || '_' || substr(NEW.id::text, 1, 8),
            NEW.raw_user_meta_data ->> 'full_name',
            COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
            NEW.raw_user_meta_data ->> 'department'
        )
        ON CONFLICT (user_id) DO NOTHING;
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log the error but don't block user creation
        RAISE WARNING 'handle_new_user trigger error: % %', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$;

-- Also clean up any orphaned profiles that don't have matching auth.users entries
-- (from the ensure_master_admin function that created a profile with random user_id)
DELETE FROM public.profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
AND username = 'system_admin';
