-- Create alerts table for managing security alerts
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  alert_type TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'ai_analysis', 'threat_feed', 'security_event', 'manual'
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'SUPPRESSED')),
  assigned_to UUID,
  risk_score INTEGER DEFAULT 0,
  confidence_score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  escalated BOOLEAN DEFAULT false,
  escalation_level INTEGER DEFAULT 0,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alert rules table for automated alert generation
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  rule_type TEXT NOT NULL, -- 'threshold', 'pattern', 'anomaly', 'correlation'
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  cooldown_minutes INTEGER DEFAULT 60,
  last_triggered TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table for tracking sent notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL, -- 'email', 'sms', 'webhook', 'in_app', 'slack'
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
  message_content JSONB,
  external_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alert escalation rules table
CREATE TABLE public.escalation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  severity_levels TEXT[] NOT NULL,
  escalation_steps JSONB NOT NULL, -- Array of escalation levels with timeouts and recipients
  enabled BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for alerts
CREATE POLICY "Analysts and above can manage alerts" 
ON public.alerts 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'operator'::text])) OR is_master_admin());

-- Create RLS policies for alert rules
CREATE POLICY "Analysts and above can manage alert rules" 
ON public.alert_rules 
FOR ALL 
USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'operator'::text])) OR is_master_admin());

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = recipient_id OR (get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text])) OR is_master_admin());

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Create RLS policies for escalation rules
CREATE POLICY "Admins can manage escalation rules" 
ON public.escalation_rules 
FOR ALL 
USING ((get_current_user_role() = 'admin'::text) OR is_master_admin());

-- Create indexes for performance
CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_alerts_severity ON public.alerts(severity);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at);
CREATE INDEX idx_alerts_assigned_to ON public.alerts(assigned_to);
CREATE INDEX idx_notifications_alert_id ON public.notifications(alert_id);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_alert_rules_enabled ON public.alert_rules(enabled);

-- Create trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
BEFORE UPDATE ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_escalation_rules_updated_at
BEFORE UPDATE ON public.escalation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default alert rules
INSERT INTO public.alert_rules (name, description, rule_type, conditions, actions, severity) VALUES
('Critical Risk Score Alert', 'Trigger on AI analysis with risk score above 80', 'threshold', 
 '{"source": "ai_analysis", "risk_score": {"operator": ">=", "value": 80}}', 
 '{"notifications": ["email", "sms"], "escalate": true}', 'CRITICAL'),
 
('High Volume Threat Feed', 'Alert on unusual threat intelligence volume', 'threshold',
 '{"source": "threat_feed", "count": {"operator": ">=", "value": 50, "timeframe": "1h"}}',
 '{"notifications": ["email"], "escalate": false}', 'HIGH'),
 
('Critical Security Event', 'Immediate alert on critical security events', 'pattern',
 '{"source": "security_event", "severity": "CRITICAL"}',
 '{"notifications": ["email", "sms", "webhook"], "escalate": true}', 'CRITICAL'),
 
('Failed Login Attempts', 'Multiple failed login attempts detected', 'threshold',
 '{"source": "security_event", "event_type": "failed_login", "count": {"operator": ">=", "value": 5, "timeframe": "5m"}}',
 '{"notifications": ["email"], "escalate": false}', 'MEDIUM');

-- Insert default escalation rules
INSERT INTO public.escalation_rules (name, severity_levels, escalation_steps) VALUES
('Critical Alert Escalation', '["CRITICAL"]', 
 '[
   {"level": 1, "timeout_minutes": 5, "recipients": ["primary_analyst"], "channels": ["email", "sms"]},
   {"level": 2, "timeout_minutes": 15, "recipients": ["senior_analyst", "team_lead"], "channels": ["email", "sms", "webhook"]},
   {"level": 3, "timeout_minutes": 30, "recipients": ["security_manager", "ciso"], "channels": ["email", "sms", "webhook"]}
 ]'),
 
('High Alert Escalation', '["HIGH"]',
 '[
   {"level": 1, "timeout_minutes": 15, "recipients": ["primary_analyst"], "channels": ["email"]},
   {"level": 2, "timeout_minutes": 60, "recipients": ["team_lead"], "channels": ["email", "sms"]}
 ]');