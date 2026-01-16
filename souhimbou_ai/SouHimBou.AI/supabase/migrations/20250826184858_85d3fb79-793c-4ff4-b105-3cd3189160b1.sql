-- Create table to track one-time payments and founding members
CREATE TABLE public.one_time_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE,
  payment_type TEXT NOT NULL, -- 'founding-member', 'supporter', 'donation', 'beta-access'
  amount INTEGER NOT NULL, -- Amount in cents
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create referral tracking table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  reward_type TEXT DEFAULT 'discount', -- 'discount', 'credit', 'feature_access'
  reward_amount INTEGER DEFAULT 0, -- Amount in cents or percentage
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'expired'
  conversion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create digital products table for future use
CREATE TABLE public.digital_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- Price in cents
  product_type TEXT NOT NULL, -- 'guide', 'calendar', 'template', 'course'
  file_path TEXT,
  download_limit INTEGER DEFAULT 5,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.one_time_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for one_time_payments
CREATE POLICY "Users can view their own payments" ON public.one_time_payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage payments" ON public.one_time_payments
  FOR ALL USING (true);

-- RLS policies for referrals
CREATE POLICY "Users can view their referrals" ON public.referrals
  FOR SELECT USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

CREATE POLICY "Users can create referrals" ON public.referrals
  FOR INSERT WITH CHECK (referrer_user_id = auth.uid());

CREATE POLICY "System can update referrals" ON public.referrals
  FOR UPDATE USING (true);

-- RLS policies for digital products
CREATE POLICY "Digital products are publicly viewable" ON public.digital_products
  FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage digital products" ON public.digital_products
  FOR ALL USING (get_current_user_role() = 'admin' OR is_master_admin());

-- Create indexes
CREATE INDEX idx_one_time_payments_user_id ON public.one_time_payments(user_id);
CREATE INDEX idx_one_time_payments_stripe_session ON public.one_time_payments(stripe_session_id);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_one_time_payments_updated_at 
    BEFORE UPDATE ON public.one_time_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at 
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_digital_products_updated_at 
    BEFORE UPDATE ON public.digital_products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();