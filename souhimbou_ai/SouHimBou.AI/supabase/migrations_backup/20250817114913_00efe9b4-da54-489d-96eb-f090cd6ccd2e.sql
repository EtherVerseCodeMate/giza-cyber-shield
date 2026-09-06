-- Create security_assets table for production asset management
CREATE TABLE IF NOT EXISTS public.security_assets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('device', 'network', 'application', 'database', 'api', 'storage')),
  status TEXT NOT NULL CHECK (status IN ('protected', 'vulnerable', 'monitoring', 'offline')),
  vulnerabilities JSONB DEFAULT '[]'::jsonb,
  last_scanned TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  protection_level TEXT NOT NULL DEFAULT 'none' CHECK (protection_level IN ('none', 'basic', 'advanced', 'khepra')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create remediation_tasks table for tracking security remediation
CREATE TABLE IF NOT EXISTS public.remediation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES public.security_assets(id) ON DELETE CASCADE,
  vulnerability_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  estimated_time_minutes INTEGER DEFAULT 5,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_assets
ALTER TABLE public.security_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for security_assets
CREATE POLICY "Users can view their own security assets" 
ON public.security_assets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security assets" 
ON public.security_assets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own security assets" 
ON public.security_assets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own security assets" 
ON public.security_assets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable RLS on remediation_tasks
ALTER TABLE public.remediation_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for remediation_tasks
CREATE POLICY "Users can view their own remediation tasks" 
ON public.remediation_tasks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own remediation tasks" 
ON public.remediation_tasks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own remediation tasks" 
ON public.remediation_tasks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own remediation tasks" 
ON public.remediation_tasks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_assets_user_id ON public.security_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_security_assets_type ON public.security_assets(type);
CREATE INDEX IF NOT EXISTS idx_security_assets_status ON public.security_assets(status);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_user_id ON public.remediation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_asset_id ON public.remediation_tasks(asset_id);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_status ON public.remediation_tasks(status);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_security_assets()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_security_assets_updated_at
  BEFORE UPDATE ON public.security_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_security_assets();

CREATE TRIGGER update_remediation_tasks_updated_at
  BEFORE UPDATE ON public.remediation_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();