-- Add AI agent chat table for storing conversations
CREATE TABLE IF NOT EXISTS public.ai_agent_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  response TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'agent', 'system')),
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agent_chats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own AI chats in their organization" 
ON public.ai_agent_chats FOR SELECT 
USING (
  user_id = auth.uid() AND 
  organization_id IN (SELECT get_user_organizations())
);

CREATE POLICY "Users can insert their own AI chats" 
ON public.ai_agent_chats FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND 
  organization_id IN (SELECT get_user_organizations())
);

-- Create indexes for performance
CREATE INDEX idx_ai_agent_chats_user_org ON public.ai_agent_chats(user_id, organization_id);
CREATE INDEX idx_ai_agent_chats_session ON public.ai_agent_chats(session_id);
CREATE INDEX idx_ai_agent_chats_created_at ON public.ai_agent_chats(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_agent_chats_updated_at
  BEFORE UPDATE ON public.ai_agent_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();