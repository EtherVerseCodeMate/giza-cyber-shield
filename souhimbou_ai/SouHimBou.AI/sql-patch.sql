ALTER TABLE public.compliance_connectors ADD COLUMN discovered_assets INTEGER DEFAULT 0;
ALTER TABLE public.remediation_playbooks ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE public.remediation_playbooks ADD COLUMN rollback_steps JSONB DEFAULT '[]'::jsonb;
ALTER INDEX IF EXISTS remediation_playbooks_pkey RENAME TO remediation_playbooks_pkey1; -- workaround for type change
ALTER TABLE public.remediation_playbooks ALTER COLUMN type SET DEFAULT 'manual';
ALTER TABLE public.remediation_executions ADD COLUMN triggers TEXT;
ALTER TABLE public.compliance_control_gaps ADD COLUMN blast_radius INTEGER DEFAULT 5;
ALTER TABLE public.compliance_control_gaps ADD COLUMN affected_assets INTEGER DEFAULT 0;
