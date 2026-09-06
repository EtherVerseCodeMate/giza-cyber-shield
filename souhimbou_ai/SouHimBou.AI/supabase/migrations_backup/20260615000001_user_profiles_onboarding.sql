-- Migration: User Profiles + Onboarding + OAuth Provider Metadata
-- Date: 2026-06-15
-- Handles: Google / GitHub / LinkedIn / Microsoft / Email sign-ups
-- RLS: users own their own profile

-- ── user_profiles ────────────────────────────────────────────────────────────
-- Extends auth.users with application-level profile data.
-- Row is created on first onboarding completion (or eagerly via trigger).

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            text,
  organization         text,
  job_title            text,
  security_clearance   text        NOT NULL DEFAULT 'UNCLASSIFIED'
                                   CHECK (security_clearance IN ('UNCLASSIFIED','CUI','CONFIDENTIAL','SECRET','TOP_SECRET')),
  org_tier             text        CHECK (org_tier IN ('individual','smb','enterprise','dod','mssp')),
  use_path             text        CHECK (use_path IN ('cmmc','stig','flight_recorder','full_suite')),
  onboarding_complete  boolean     NOT NULL DEFAULT false,
  avatar_url           text,
  -- OAuth metadata (populated from Supabase identity)
  oauth_provider       text,       -- 'google' | 'github' | 'linkedin_oidc' | 'azure' | 'email'
  github_username      text,
  linkedin_url         text,
  -- License / subscription
  license_key          text,
  subscription_tier    text        NOT NULL DEFAULT 'free'
                                   CHECK (subscription_tier IN ('free','starter','professional','enterprise','dod')),
  subscription_status  text        NOT NULL DEFAULT 'active'
                                   CHECK (subscription_status IN ('active','trialing','past_due','canceled','paused')),
  trial_ends_at        timestamptz,
  -- Timestamps
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_org       ON public.user_profiles(organization);
CREATE INDEX IF NOT EXISTS idx_profiles_tier      ON public.user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_onboard   ON public.user_profiles(onboarding_complete);
CREATE INDEX IF NOT EXISTS idx_profiles_license   ON public.user_profiles(license_key);

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_owner_all" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);

-- Admins (service role) can read all profiles for billing/mgmt
CREATE POLICY "admin_read_all" ON public.user_profiles
  FOR SELECT USING (auth.role() = 'service_role');

-- ── Trigger: auto-create profile on signup ────────────────────────────────
-- Fires when a new row is inserted into auth.users (any provider).
-- Populates name and oauth_provider from Supabase identity metadata.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name  text;
  _provider   text;
  _avatar     text;
BEGIN
  -- Extract from raw_user_meta_data (Google/GitHub/LinkedIn/SAML)
  _full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'preferred_username',
    split_part(NEW.email, '@', 1)
  );

  _provider := COALESCE(
    NEW.raw_app_meta_data ->> 'provider',
    'email'
  );

  _avatar := COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture'
  );

  INSERT INTO public.user_profiles (id, full_name, oauth_provider, avatar_url, subscription_tier, trial_ends_at)
  VALUES (
    NEW.id,
    _full_name,
    _provider,
    _avatar,
    'free',
    now() + INTERVAL '14 days'   -- 14-day free trial on signup
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name     = EXCLUDED.full_name,
    oauth_provider = EXCLUDED.oauth_provider,
    avatar_url    = EXCLUDED.avatar_url,
    updated_at    = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── onboarding_events ─────────────────────────────────────────────────────
-- Tracks onboarding funnel for analytics (no PII beyond user_id)

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event       text        NOT NULL,  -- 'step_complete:1' | 'skipped' | 'completed'
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_ev   ON public.onboarding_events(event);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_owner" ON public.onboarding_events
  FOR ALL USING (auth.uid() = user_id);

-- ── updated_at trigger helper ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Realtime ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
