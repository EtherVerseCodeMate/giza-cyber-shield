-- Create compliance frameworks table
CREATE TABLE public.compliance_frameworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  authority TEXT,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance controls table
CREATE TABLE public.compliance_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  control_type TEXT NOT NULL,
  family TEXT,
  priority TEXT DEFAULT 'MEDIUM',
  implementation_guidance TEXT,
  assessment_procedures TEXT,
  automation_possible BOOLEAN DEFAULT false,
  automation_query TEXT,
  required_evidence TEXT[],
  related_controls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(framework_id, control_id)
);

-- Create compliance assessments table
CREATE TABLE public.compliance_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assessment_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  assessor_name TEXT,
  assessor_organization TEXT,
  scope_description TEXT,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  overall_score DECIMAL(5,2),
  compliance_level TEXT,
  findings_summary TEXT,
  recommendations TEXT[],
  next_assessment_due DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create control assessments table
CREATE TABLE public.control_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.compliance_assessments(id) ON DELETE CASCADE,
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  effectiveness TEXT,
  implementation_score DECIMAL(5,2),
  test_results TEXT,
  findings TEXT,
  recommendations TEXT,
  compensating_controls TEXT,
  evidence_provided TEXT[],
  assessor_notes TEXT,
  last_tested_date DATE,
  next_test_due DATE,
  automation_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, control_id)
);

-- Create compliance evidence table
CREATE TABLE public.compliance_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  control_assessment_id UUID REFERENCES public.control_assessments(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_hash TEXT,
  collection_method TEXT,
  collection_date DATE,
  retention_period_days INTEGER DEFAULT 2555,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance exceptions table
CREATE TABLE public.compliance_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.compliance_assessments(id) ON DELETE CASCADE,
  exception_type TEXT NOT NULL,
  title TEXT NOT NULL,
  justification TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  compensating_measures TEXT,
  approved_by UUID,
  approval_date DATE,
  expiration_date DATE,
  review_frequency_days INTEGER DEFAULT 90,
  last_review_date DATE,
  next_review_date DATE,
  status TEXT DEFAULT 'ACTIVE',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_exceptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Analysts and above can manage compliance frameworks" 
ON public.compliance_frameworks 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Analysts and above can view compliance controls" 
ON public.compliance_controls 
FOR SELECT 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'compliance_officer'::text, 'operator'::text])) OR is_master_admin());

CREATE POLICY "Compliance officers can insert controls" 
ON public.compliance_controls 
FOR INSERT 
WITH CHECK ((get_current_user_role() = ANY (ARRAY['admin'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Compliance officers can update controls" 
ON public.compliance_controls 
FOR UPDATE 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Compliance officers can delete controls" 
ON public.compliance_controls 
FOR DELETE 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Analysts and above can manage assessments" 
ON public.compliance_assessments 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Analysts and above can manage control assessments" 
ON public.control_assessments 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Analysts and above can manage evidence" 
ON public.compliance_evidence 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'compliance_officer'::text])) OR is_master_admin());

CREATE POLICY "Analysts and above can manage exceptions" 
ON public.compliance_exceptions 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'compliance_officer'::text])) OR is_master_admin());

-- Create indexes for performance
CREATE INDEX idx_compliance_controls_framework ON public.compliance_controls(framework_id);
CREATE INDEX idx_compliance_controls_family ON public.compliance_controls(family);
CREATE INDEX idx_compliance_controls_priority ON public.compliance_controls(priority);
CREATE INDEX idx_compliance_assessments_framework ON public.compliance_assessments(framework_id);
CREATE INDEX idx_compliance_assessments_status ON public.compliance_assessments(status);
CREATE INDEX idx_control_assessments_assessment ON public.control_assessments(assessment_id);
CREATE INDEX idx_control_assessments_control ON public.control_assessments(control_id);
CREATE INDEX idx_control_assessments_status ON public.control_assessments(status);
CREATE INDEX idx_compliance_evidence_control_assessment ON public.compliance_evidence(control_assessment_id);
CREATE INDEX idx_compliance_exceptions_control ON public.compliance_exceptions(control_id);
CREATE INDEX idx_compliance_exceptions_status ON public.compliance_exceptions(status);

-- Create triggers for updated_at
CREATE TRIGGER update_compliance_frameworks_updated_at
BEFORE UPDATE ON public.compliance_frameworks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_controls_updated_at
BEFORE UPDATE ON public.compliance_controls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_assessments_updated_at
BEFORE UPDATE ON public.compliance_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_control_assessments_updated_at
BEFORE UPDATE ON public.control_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_exceptions_updated_at
BEFORE UPDATE ON public.compliance_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();