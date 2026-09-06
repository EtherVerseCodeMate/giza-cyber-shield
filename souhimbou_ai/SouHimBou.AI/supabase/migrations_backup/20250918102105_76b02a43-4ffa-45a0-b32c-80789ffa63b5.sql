-- Create Codex Agent Swarm Tables for TRL10 Production

-- Codex Agents Table
CREATE TABLE public.codex_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('discovery', 'analysis', 'remediation', 'intelligence', 'connector', 'compliance')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'processing', 'learning', 'error', 'offline')),
  ai_model TEXT NOT NULL CHECK (ai_model IN ('gpt-5', 'gpt-4.1', 'o3', 'o4-mini', 'claude-opus-4-1', 'claude-sonnet-4')),
  capabilities JSONB DEFAULT '[]'::JSONB,
  specialized_knowledge JSONB DEFAULT '[]'::JSONB,
  performance_metrics JSONB DEFAULT '{"tasks_completed": 0, "success_rate": 0, "avg_execution_time": 0, "learning_iterations": 0}'::JSONB,
  configuration JSONB DEFAULT '{}'::JSONB,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Polymorphic APIs Table  
CREATE TABLE public.polymorphic_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  evolution_stage TEXT NOT NULL DEFAULT 'stable' CHECK (evolution_stage IN ('stable', 'evolving', 'breakthrough')),
  endpoints JSONB DEFAULT '[]'::JSONB,
  authentication JSONB DEFAULT '{}'::JSONB,
  rate_limits JSONB DEFAULT '{}'::JSONB,
  auto_evolution_enabled BOOLEAN DEFAULT true,
  learning_metadata JSONB DEFAULT '{"usage_patterns": {}, "performance_optimizations": {}, "error_patterns": {}}'::JSONB,
  performance_score DECIMAL(5,2) DEFAULT 0.0 CHECK (performance_score >= 0 AND performance_score <= 100),
  palantir_advantage DECIMAL(5,2) DEFAULT 0.0,
  stig_validations JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adaptive Schemas Table
CREATE TABLE public.adaptive_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  schema_name TEXT NOT NULL,
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  base_schema JSONB NOT NULL,
  adaptations JSONB DEFAULT '[]'::JSONB,
  evolution_triggers JSONB DEFAULT '[]'::JSONB,
  learning_metadata JSONB DEFAULT '{"usage_patterns": {}, "optimization_history": {}, "compliance_validations": {}}'::JSONB,
  stig_compliance_mappings JSONB DEFAULT '{}'::JSONB,
  performance_metrics JSONB DEFAULT '{"query_performance": {}, "integration_efficiency": {}, "compliance_scores": {}}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Swarm Tasks Table
CREATE TABLE public.swarm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('integration_discovery', 'api_generation', 'schema_evolution', 'compliance_analysis', 'threat_correlation', 'connector_creation')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'requires_human')),
  assigned_agents JSONB DEFAULT '[]'::JSONB,
  input_data JSONB DEFAULT '{}'::JSONB,
  output_data JSONB DEFAULT NULL,
  execution_strategy TEXT NOT NULL DEFAULT 'parallel' CHECK (execution_strategy IN ('parallel', 'sequential', 'hierarchical', 'competitive')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  error_details JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Integration Patterns Table
CREATE TABLE public.integration_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  data_mapping JSONB DEFAULT '{}'::JSONB,
  authentication_method TEXT DEFAULT 'api_key',
  compliance_requirements JSONB DEFAULT '[]'::JSONB,
  auto_generated BOOLEAN DEFAULT false,
  success_rate DECIMAL(5,2) DEFAULT 0.0 CHECK (success_rate >= 0 AND success_rate <= 100),
  learned_optimizations JSONB DEFAULT '[]'::JSONB,
  performance_metrics JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Swarm Performance Metrics Table
CREATE TABLE public.swarm_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_metadata JSONB DEFAULT '{}'::JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.codex_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polymorphic_apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization-based access
CREATE POLICY "Organization members can manage codex agents" ON public.codex_agents
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage polymorphic apis" ON public.polymorphic_apis
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage adaptive schemas" ON public.adaptive_schemas
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage swarm tasks" ON public.swarm_tasks
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage integration patterns" ON public.integration_patterns
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can view performance metrics" ON public.swarm_performance_metrics
  FOR SELECT USING (organization_id IN (SELECT get_user_organizations()));

-- Insert only for performance metrics (system managed)
CREATE POLICY "System can insert performance metrics" ON public.swarm_performance_metrics
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_codex_agents_org_status ON public.codex_agents(organization_id, status);
CREATE INDEX idx_polymorphic_apis_org_stage ON public.polymorphic_apis(organization_id, evolution_stage);
CREATE INDEX idx_swarm_tasks_org_status ON public.swarm_tasks(organization_id, status);
CREATE INDEX idx_swarm_tasks_priority ON public.swarm_tasks(priority, created_at);
CREATE INDEX idx_integration_patterns_org_success ON public.integration_patterns(organization_id, success_rate);
CREATE INDEX idx_performance_metrics_org_time ON public.swarm_performance_metrics(organization_id, recorded_at);

-- Create triggers for updated_at
CREATE TRIGGER update_codex_agents_updated_at 
  BEFORE UPDATE ON public.codex_agents 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_polymorphic_apis_updated_at 
  BEFORE UPDATE ON public.polymorphic_apis 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_adaptive_schemas_updated_at 
  BEFORE UPDATE ON public.adaptive_schemas 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_swarm_tasks_updated_at 
  BEFORE UPDATE ON public.swarm_tasks 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_patterns_updated_at 
  BEFORE UPDATE ON public.integration_patterns 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();