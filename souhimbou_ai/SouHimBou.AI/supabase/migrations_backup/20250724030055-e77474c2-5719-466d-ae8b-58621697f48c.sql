-- Create missing user profile for ai-nativevc@souhimbou.ai
-- First, let's check if this user exists in auth.users
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Try to find the user by email
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'ai-nativevc@souhimbou.ai';
    
    IF target_user_id IS NOT NULL THEN
        -- User exists in auth but not in profiles, create profile
        INSERT INTO public.profiles (
            user_id, 
            username, 
            full_name, 
            security_clearance, 
            role,
            master_admin,
            department,
            trial_starts_at,
            trial_ends_at,
            is_trial_active,
            plan_type
        ) VALUES (
            target_user_id,
            'ai-nativevc',
            'AI Native VC',
            'TOP_SECRET',
            'admin',
            false,
            'AI Strategy',
            now(),
            now() + INTERVAL '30 days',
            true,
            'enterprise'
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Profile created for existing user ai-nativevc@souhimbou.ai';
    ELSE
        RAISE NOTICE 'User ai-nativevc@souhimbou.ai not found in auth.users table';
    END IF;
END $$;