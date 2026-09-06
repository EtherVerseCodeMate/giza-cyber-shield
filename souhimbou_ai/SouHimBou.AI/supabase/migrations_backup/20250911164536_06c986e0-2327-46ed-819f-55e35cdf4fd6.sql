-- Enterprise AI Agent Framework Database Schema

-- Agent roles and permissions system
CREATE TABLE public.ai_agent_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent registry and management
CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL, -- 'finance', 'hr', 'security', 'operations', 'legal'
  trust_level INTEGER NOT NULL DEFAULT 0, -- 0-100 scale
  status TEXT NOT NULL DEFAULT 'inactive', -- 'inactive', 'training', 'active', 'suspended'
  role_id UUID REFERENCES public.ai_agent_roles(id),
  specialization TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  permissions JSONB NOT NULL DEFAULT '{}',
  performance_metrics JSONB NOT NULL DEFAULT '{}',
  learning_data JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE,
  deployment_status TEXT NOT NULL DEFAULT 'draft'
);

-- Agent action audit trail
CREATE TABLE public.agent_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_context TEXT NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  execution_time_ms INTEGER,
  risk_score INTEGER DEFAULT 0,
  approval_required BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent permissions and access control
CREATE TABLE public.agent_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'database', 'api', 'tool', 'system'
  resource_identifier TEXT NOT NULL,
  permission_level TEXT NOT NULL, -- 'read', 'write', 'execute', 'admin'
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  conditions JSONB DEFAULT '{}'
);

-- Agent performance tracking
CREATE TABLE public.agent_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  measurement_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  measurement_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent collaboration and workflows  
CREATE TABLE public.agent_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  workflow_name TEXT NOT NULL,
  workflow_type TEXT NOT NULL, -- 'sequential', 'parallel', 'conditional'
  participating_agents UUID[] NOT NULL,
  workflow_definition JSONB NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent tool integrations
CREATE TABLE public.agent_tool_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  integration_config JSONB NOT NULL DEFAULT '{}',
  api_endpoints JSONB NOT NULL DEFAULT '[]',
  authentication_method TEXT NOT NULL DEFAULT 'api_key',
  rate_limits JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default agent roles
INSERT INTO public.ai_agent_roles (role_name, description, base_permissions) VALUES
('trainee', 'New agent with limited permissions', '{"read": true, "write": false, "execute": false}'),
('junior', 'Developing agent with basic permissions', '{"read": true, "write": true, "execute": false}'),
('senior', 'Experienced agent with expanded permissions', '{"read": true, "write": true, "execute": true}'),
('expert', 'Highly trusted agent with full permissions', '{"read": true, "write": true, "execute": true, "admin": false}'),
('specialist', 'Domain expert agent with specialized permissions', '{"read": true, "write": true, "execute": true, "admin": true}');

-- Enable RLS on all tables
ALTER TABLE public.ai_agent_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agent roles are viewable by authenticated users" ON public.ai_agent_roles
  FOR SELECT USING (true);

CREATE POLICY "Organization agents access" ON public.ai_agents
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Agent actions organization access" ON public.agent_actions
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Agent permissions organization access" ON public.agent_permissions
  FOR ALL USING (agent_id IN (SELECT id FROM public.ai_agents WHERE organization_id IN (SELECT get_user_organizations())));

CREATE POLICY "Agent performance organization access" ON public.agent_performance
  FOR ALL USING (agent_id IN (SELECT id FROM public.ai_agents WHERE organization_id IN (SELECT get_user_organizations())));

CREATE POLICY "Agent workflows organization access" ON public.agent_workflows
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Agent tool integrations organization access" ON public.agent_tool_integrations
  FOR ALL USING (agent_id IN (SELECT id FROM public.ai_agents WHERE organization_id IN (SELECT get_user_organizations())));

-- Triggers for updated_at
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agent_roles_updated_at
  BEFORE UPDATE ON public.ai_agent_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_workflows_updated_at
  BEFORE UPDATE ON public.agent_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_tool_integrations_updated_at
  BEFORE UPDATE ON public.agent_tool_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();