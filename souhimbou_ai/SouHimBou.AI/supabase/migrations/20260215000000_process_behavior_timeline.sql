-- Process Behavior Timeline - Integration with STIG Compliance
--
-- This table stores process-level forensic events that map to STIG controls.
-- Events are correlated with STIG findings to create a compliance audit trail.
--
-- Reference: STIGVIEWER_STRATEGY_MITOCHONDRIA.md §3.3 (Process Behavior Timeline)
-- Frontend Component: ProcessBehaviorTimeline.tsx

CREATE TABLE IF NOT EXISTS public.process_behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,

  -- Process identification
  pid INTEGER NOT NULL,
  process_name TEXT NOT NULL,
  parent_pid INTEGER,
  parent_process_name TEXT,
  user_name TEXT,

  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN ('FILE', 'REGISTRY', 'NETWORK', 'PROCESS', 'SERVICE', 'DRIVER')),
  action TEXT NOT NULL, -- CREATE, DELETE, MODIFY, EXECUTE, CONNECT, LISTEN, etc.
  target TEXT NOT NULL, -- File path, registry key, network address, etc.

  -- Event details
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Compliance mapping
  cmmc_control TEXT, -- e.g., "SI.L2-3.14.6"
  stig_control TEXT, -- e.g., "RHEL-08-010010"
  nist_control TEXT, -- e.g., "SI-4", "AU-2"
  finding_id UUID REFERENCES public.stig_findings(id) ON DELETE SET NULL,

  -- Compliance status
  compliance_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (compliance_status IN ('VALIDATED', 'VIOLATION', 'PENDING', 'IGNORED')),
  severity TEXT CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Analyst review
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Correlation
  correlation_id UUID, -- Groups related events
  threat_indicator_id UUID,

  -- Evidence collection
  evidence_collected BOOLEAN DEFAULT false,
  evidence_path TEXT,
  evidence_hash TEXT,

  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_process_events_org ON public.process_behavior_events(organization_id);
CREATE INDEX idx_process_events_asset ON public.process_behavior_events(asset_id);
CREATE INDEX idx_process_events_stig ON public.process_behavior_events(stig_control) WHERE stig_control IS NOT NULL;
CREATE INDEX idx_process_events_finding ON public.process_behavior_events(finding_id) WHERE finding_id IS NOT NULL;
CREATE INDEX idx_process_events_compliance ON public.process_behavior_events(compliance_status);
CREATE INDEX idx_process_events_timestamp ON public.process_behavior_events(event_timestamp DESC);
CREATE INDEX idx_process_events_type ON public.process_behavior_events(event_type, action);
CREATE INDEX idx_process_events_severity ON public.process_behavior_events(severity) WHERE severity IN ('HIGH', 'CRITICAL');

-- Correlation index (for grouping related events)
CREATE INDEX idx_process_events_correlation ON public.process_behavior_events(correlation_id) WHERE correlation_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.process_behavior_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization members can only see their events
CREATE POLICY "Organization process events access"
ON public.process_behavior_events
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- RLS Policy: Master admins can see all events
CREATE POLICY "Master admin full access to process events"
ON public.process_behavior_events
FOR ALL
USING (is_master_admin());

-- Update trigger for updated_at
CREATE TRIGGER update_process_behavior_events_updated_at
    BEFORE UPDATE ON public.process_behavior_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- View: STIG Control Violations (for dashboards)
CREATE OR REPLACE VIEW public.v_stig_violations_timeline AS
SELECT
  pbe.id,
  pbe.event_timestamp,
  pbe.stig_control,
  pbe.process_name,
  pbe.event_type,
  pbe.action,
  pbe.target,
  pbe.compliance_status,
  pbe.severity,
  sr.title AS stig_rule_title,
  sr.severity AS stig_severity,
  sf.finding_status,
  pbe.asset_id,
  pbe.organization_id
FROM public.process_behavior_events pbe
LEFT JOIN public.stig_rules sr ON sr.rule_id = pbe.stig_control
LEFT JOIN public.stig_findings sf ON sf.id = pbe.finding_id
WHERE pbe.compliance_status = 'VIOLATION'
ORDER BY pbe.event_timestamp DESC;

-- View: Real-time Compliance Dashboard
CREATE OR REPLACE VIEW public.v_process_compliance_summary AS
SELECT
  organization_id,
  asset_id,
  compliance_status,
  severity,
  COUNT(*) AS event_count,
  MAX(event_timestamp) AS last_event
FROM public.process_behavior_events
WHERE event_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY organization_id, asset_id, compliance_status, severity;

-- Function: Link process event to STIG finding
CREATE OR REPLACE FUNCTION public.link_process_event_to_finding(
  event_id UUID,
  p_stig_control TEXT,
  p_compliance_status TEXT DEFAULT 'VIOLATION'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_finding_id UUID;
  v_asset_id UUID;
  v_org_id UUID;
BEGIN
  -- Get event details
  SELECT asset_id, organization_id INTO v_asset_id, v_org_id
  FROM public.process_behavior_events
  WHERE id = event_id;

  IF v_asset_id IS NULL THEN
    RAISE EXCEPTION 'Process event not found: %', event_id;
  END IF;

  -- Find or create STIG finding
  SELECT id INTO v_finding_id
  FROM public.stig_findings
  WHERE asset_id = v_asset_id
    AND rule_id = p_stig_control
    AND finding_status = 'Open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_finding_id IS NULL THEN
    -- Create new finding
    INSERT INTO public.stig_findings (
      asset_id,
      organization_id,
      rule_id,
      finding_status,
      severity,
      comments,
      remediation_status
    )
    SELECT
      v_asset_id,
      v_org_id,
      p_stig_control,
      'Open',
      sr.severity,
      'Auto-generated from process behavior event: ' || event_id,
      'pending'
    FROM public.stig_rules sr
    WHERE sr.rule_id = p_stig_control
    RETURNING id INTO v_finding_id;
  END IF;

  -- Link event to finding
  UPDATE public.process_behavior_events
  SET
    finding_id = v_finding_id,
    stig_control = p_stig_control,
    compliance_status = p_compliance_status,
    updated_at = NOW()
  WHERE id = event_id;

  RETURN v_finding_id;
END;
$$;

COMMENT ON TABLE public.process_behavior_events IS 'Process-level forensic events mapped to STIG controls for compliance audit trail';
COMMENT ON FUNCTION public.link_process_event_to_finding IS 'Links a process behavior event to a STIG finding, creating the finding if needed';
