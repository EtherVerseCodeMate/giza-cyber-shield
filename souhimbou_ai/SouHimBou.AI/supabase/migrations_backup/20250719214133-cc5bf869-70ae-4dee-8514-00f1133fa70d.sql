-- Create legal documents management system

-- Create legal documents table for organization-specific documents
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'policy', 'agreement', 'nda', 'partnership', 'other')),
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  access_level TEXT NOT NULL DEFAULT 'organization' CHECK (access_level IN ('organization', 'admin_only', 'master_admin_only')),
  created_by UUID NOT NULL,
  updated_by UUID,
  metadata JSONB DEFAULT '{}',
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create legal document permissions table for granular access control
CREATE TABLE public.legal_document_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write', 'delete', 'approve')),
  granted_by UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(document_id, user_id, permission_type),
  UNIQUE(document_id, role, permission_type)
);

-- Create document audit trail
CREATE TABLE public.legal_document_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'downloaded', 'viewed', 'approved', 'rejected')),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create partnership proposals table (MasterAdmin only)
CREATE TABLE public.partnership_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  prospect_company TEXT NOT NULL,
  prospect_contact_name TEXT,
  prospect_email TEXT,
  prospect_phone TEXT,
  proposal_type TEXT NOT NULL CHECK (proposal_type IN ('technology', 'strategic', 'reseller', 'integration', 'other')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'under_review', 'accepted', 'rejected', 'negotiating')),
  value_estimate DECIMAL(15,2),
  expected_close_date DATE,
  created_by UUID NOT NULL,
  updated_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for legal_documents
CREATE POLICY "Organization members can view their org documents"
ON public.legal_documents FOR SELECT
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (
    access_level = 'organization' OR
    (access_level = 'admin_only' AND (get_current_user_role() = 'admin' OR is_master_admin())) OR
    (access_level = 'master_admin_only' AND is_master_admin())
  )
);

CREATE POLICY "Admins can manage organization documents"
ON public.legal_documents FOR ALL
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
)
WITH CHECK (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- RLS Policies for legal_document_permissions
CREATE POLICY "Users can view permissions for accessible documents"
ON public.legal_document_permissions FOR SELECT
USING (
  document_id IN (
    SELECT id FROM public.legal_documents 
    WHERE organization_id IN (SELECT get_user_organizations())
  )
);

CREATE POLICY "Admins can manage document permissions"
ON public.legal_document_permissions FOR ALL
USING (
  document_id IN (
    SELECT id FROM public.legal_documents 
    WHERE organization_id IN (SELECT get_user_organizations()) AND
    (get_current_user_role() = 'admin' OR is_master_admin())
  )
);

-- RLS Policies for legal_document_audit
CREATE POLICY "Organization members can view document audit logs"
ON public.legal_document_audit FOR SELECT
USING (
  document_id IN (
    SELECT id FROM public.legal_documents 
    WHERE organization_id IN (SELECT get_user_organizations())
  ) AND
  (get_current_user_role() IN ('admin', 'analyst') OR is_master_admin())
);

CREATE POLICY "System can insert audit logs"
ON public.legal_document_audit FOR INSERT
WITH CHECK (true);

-- RLS Policies for partnership_proposals (MasterAdmin only)
CREATE POLICY "Master admin can manage partnership proposals"
ON public.partnership_proposals FOR ALL
USING (is_master_admin())
WITH CHECK (is_master_admin());

-- Create triggers for automatic timestamps
CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partnership_proposals_updated_at
  BEFORE UPDATE ON public.partnership_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check document permissions
CREATE OR REPLACE FUNCTION public.check_document_permission(
  doc_id UUID,
  user_uuid UUID,
  permission TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.legal_document_permissions
    WHERE document_id = doc_id
    AND (
      user_id = user_uuid OR
      role = (SELECT role FROM public.profiles WHERE user_id = user_uuid)
    )
    AND permission_type = permission
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Create function to log document actions
CREATE OR REPLACE FUNCTION public.log_document_action(
  doc_id UUID,
  action_name TEXT,
  old_vals JSONB DEFAULT NULL,
  new_vals JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.legal_document_audit (
    document_id,
    user_id,
    action,
    old_values,
    new_values,
    ip_address,
    created_at
  ) VALUES (
    doc_id,
    auth.uid(),
    action_name,
    old_vals,
    new_vals,
    inet_client_addr(),
    now()
  );
END;
$$;