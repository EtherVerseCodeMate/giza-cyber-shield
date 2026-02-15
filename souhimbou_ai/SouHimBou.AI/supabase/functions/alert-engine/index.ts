import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface AlertRequest {
  action: 'create_alert' | 'process_rules' | 'send_notification' | 'escalate_alert' | 'test_notification';
  data?: any;
}

interface Alert {
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  alert_type: string;
  source_type: string;
  source_id?: string;
  risk_score?: number;
  confidence_score?: number;
  metadata?: any;
  tags?: string[];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Alert engine function called');

    const { action, data }: AlertRequest = await req.json();

    let result;
    switch (action) {
      case 'create_alert':
        result = await createAlert(data);
        break;
      case 'process_rules':
        result = await processAlertRules(data);
        break;
      case 'send_notification':
        result = await sendNotification(data);
        break;
      case 'escalate_alert':
        result = await escalateAlert(data);
        break;
      case 'test_notification':
        result = await testNotification(data);
        break;
      default:
        result = await processAlertRules(data);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in alert-engine function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
    );
  }
});

async function createAlert(alertData: Alert) {
  console.log('Creating new alert:', alertData.title);

  // Calculate SLA deadline based on severity
  const slaMinutes = getSLAMinutes(alertData.severity);
  const slaDeadline = new Date(Date.now() + slaMinutes * 60 * 1000);

  const { data: alert, error } = await supabase
    .from('alerts')
    .insert({
      ...alertData,
      sla_deadline: slaDeadline.toISOString()
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Trigger immediate notifications for critical alerts
  if (alertData.severity === 'CRITICAL') {
    await sendImmediateNotification(alert);
  }

  // Process alert rules
  await processAlertRules(alert);

  console.log(`Alert created with ID: ${alert.id}`);
  return {
    success: true,
    alert_id: alert.id,
    severity: alert.severity,
    sla_deadline: alert.sla_deadline
  };
}

async function processAlertRules(triggerData?: any) {
  console.log('Processing alert rules');

  const { data: rules, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('enabled', true);

  if (error) {
    throw error;
  }

  let triggeredRules = 0;
  const results = [];

  for (const rule of rules) {
    try {
      const shouldTrigger = await evaluateRule(rule, triggerData);

      if (shouldTrigger) {
        // Check cooldown
        if (rule.last_triggered) {
          const cooldownEnd = new Date(rule.last_triggered).getTime() + (rule.cooldown_minutes * 60 * 1000);
          if (Date.now() < cooldownEnd) {
            console.log(`Rule ${rule.name} in cooldown, skipping`);
            continue;
          }
        }

        const alertResult = await triggerRule(rule, triggerData);
        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          triggered: true,
          alert_id: alertResult.alert_id
        });

        // Update rule trigger count and timestamp
        await supabase
          .from('alert_rules')
          .update({
            last_triggered: new Date().toISOString(),
            trigger_count: (rule.trigger_count || 0) + 1
          })
          .eq('id', rule.id);

        triggeredRules++;
      }
    } catch (error) {
      console.error(`Error processing rule ${rule.name}:`, error);
      results.push({
        rule_id: rule.id,
        rule_name: rule.name,
        triggered: false,
        error: error.message
      });
    }
  }

  return {
    success: true,
    rules_processed: rules.length,
    rules_triggered: triggeredRules,
    results
  };
}

async function evaluateRule(rule: any, triggerData: any): Promise<boolean> {
  const conditions = rule.conditions;
  if (!conditions || !triggerData) return false;

  // Simple threshold-based rule evaluation
  if (rule.rule_type === 'threshold') {
    if (conditions.source === 'ai_analysis' && triggerData?.risk_score) {
      const riskCondition = conditions.risk_score;
      if (riskCondition) {
        return evaluateCondition(triggerData.risk_score, riskCondition);
      }
    }

    if (conditions.source === 'security_event' && triggerData?.severity) {
      return triggerData.severity === conditions.severity;
    }
  }

  // Pattern-based rule evaluation
  if (rule.rule_type === 'pattern') {
    if (conditions.source === 'security_event' && triggerData?.severity) {
      return triggerData.severity === conditions.severity;
    }
  }

  // TRL10 PRODUCTION: Random triggering removed
  return false;
}

function evaluateCondition(value: number, condition: any): boolean {
  switch (condition.operator) {
    case '>=': return value >= condition.value;
    case '>': return value > condition.value;
    case '<=': return value <= condition.value;
    case '<': return value < condition.value;
    case '==': return value === condition.value;
    default: return false;
  }
}

async function triggerRule(rule: any, triggerData: any) {
  console.log(`Triggering rule: ${rule.name}`);

  // Create alert from rule
  const alertData = {
    title: `${rule.name} - Alert Triggered`,
    description: rule.description || `Alert generated by rule: ${rule.name}`,
    severity: rule.severity,
    alert_type: rule.rule_type,
    source_type: 'alert_rule',
    source_id: rule.id,
    risk_score: triggerData?.risk_score || 0,
    confidence_score: triggerData?.confidence_score || 50,
    metadata: {
      rule_name: rule.name,
      trigger_data: triggerData,
      conditions: rule.conditions
    }
  };

  const { data: alert, error } = await supabase
    .from('alerts')
    .insert(alertData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Process rule actions
  const actions = rule.actions;
  if (actions.notifications) {
    for (const channel of actions.notifications) {
      await queueNotification(alert, channel);
    }
  }

  if (actions.escalate) {
    await scheduleEscalation(alert);
  }

  return {
    success: true,
    alert_id: alert.id,
    actions_taken: Object.keys(actions)
  };
}

async function sendNotification(notificationData: any) {
  console.log('Sending notification:', notificationData);

  const { alert_id, channel, recipient_email, recipient_phone } = notificationData;

  // Get alert details
  const { data: alert } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alert_id)
    .single();

  if (!alert) {
    throw new Error('Alert not found');
  }

  const messageContent = generateNotificationMessage(alert, channel);

  let notificationResult;
  switch (channel) {
    case 'email':
      notificationResult = await sendEmailNotification(recipient_email, messageContent);
      break;
    case 'sms':
      notificationResult = await sendSMSNotification(recipient_phone, messageContent);
      break;
    case 'webhook':
      notificationResult = await sendWebhookNotification(messageContent);
      break;
    case 'in_app':
      notificationResult = await sendInAppNotification(alert);
      break;
    default:
      notificationResult = { success: false, error: 'Unsupported channel' };
  }

  // Log notification attempt
  await supabase
    .from('notifications')
    .insert({
      alert_id,
      recipient_email,
      recipient_phone,
      channel,
      status: notificationResult.success ? 'SENT' : 'FAILED',
      message_content: messageContent,
      error_message: notificationResult.error,
      sent_at: notificationResult.success ? new Date().toISOString() : null
    });

  return notificationResult;
}

async function queueNotification(alert: any, channel: string) {
  // For demo, create notification records
  return await supabase
    .from('notifications')
    .insert({
      alert_id: alert.id,
      channel,
      status: 'PENDING',
      message_content: generateNotificationMessage(alert, channel)
    });
}

function generateNotificationMessage(alert: any, channel: string) {
  const baseMessage = {
    subject: `🚨 ${alert.severity} Alert: ${alert.title}`,
    body: `
Alert Details:
- Title: ${alert.title}
- Severity: ${alert.severity}
- Type: ${alert.alert_type}
- Risk Score: ${alert.risk_score}/100
- Created: ${new Date(alert.created_at).toLocaleString()}
- SLA Deadline: ${new Date(alert.sla_deadline).toLocaleString()}

Description: ${alert.description}

Please investigate immediately.
`,
    alert_id: alert.id,
    timestamp: new Date().toISOString()
  };

  if (channel === 'sms') {
    return {
      text: `🚨 ${alert.severity} Alert: ${alert.title} - Risk: ${alert.risk_score}/100. Check IMOHTEP for details.`
    };
  }

  if (channel === 'webhook') {
    return {
      event: 'security_alert',
      data: {
        alert,
        severity: alert.severity,
        risk_score: alert.risk_score,
        url: `${Deno.env.get('SUPABASE_URL')}/alerts/${alert.id}`
      }
    };
  }

  return baseMessage;
}

async function sendEmailNotification(email: string, content: any) {
  // Mock email sending - replace with real email service
  console.log(`Sending email to ${email}:`, content.subject);

  // Simulate email API call
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    message_id: `email_${Date.now()}`,
    recipient: email
  };
}

async function sendSMSNotification(phone: string, content: any) {
  // Mock SMS sending - replace with Twilio or similar
  console.log(`Sending SMS to ${phone}:`, content.text);

  return {
    success: true,
    message_id: `sms_${Date.now()}`,
    recipient: phone
  };
}

async function sendWebhookNotification(content: any) {
  console.log('Sending webhook notification:', content);

  // Mock webhook - replace with actual webhook URLs
  return {
    success: true,
    webhook_id: `webhook_${Date.now()}`
  };
}

async function sendInAppNotification(alert: any) {
  console.log('Creating in-app notification for alert:', alert.id);

  // In-app notifications would be handled via real-time subscriptions
  return {
    success: true,
    notification_id: `inapp_${Date.now()}`
  };
}

async function sendImmediateNotification(alert: any) {
  console.log('Sending immediate notification for critical alert');

  // Get all analysts for immediate notification
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'analyst', 'operator']);

  for (const profile of profiles || []) {
    if (profile.role === 'admin' || profile.role === 'analyst') {
      await queueNotification(alert, 'email');
      if (alert.severity === 'CRITICAL') {
        await queueNotification(alert, 'sms');
      }
    }
  }
}

async function escalateAlert(alertId: string) {
  console.log('Escalating alert:', alertId);

  const { data: alert } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .single();

  if (!alert) {
    throw new Error('Alert not found');
  }

  // Update escalation level
  const newEscalationLevel = (alert.escalation_level || 0) + 1;

  await supabase
    .from('alerts')
    .update({
      escalated: true,
      escalation_level: newEscalationLevel,
      updated_at: new Date().toISOString()
    })
    .eq('id', alertId);

  return {
    success: true,
    alert_id: alertId,
    escalation_level: newEscalationLevel
  };
}

async function scheduleEscalation(alert: any) {
  // Mock escalation scheduling - in production, use a job queue
  console.log(`Scheduling escalation for alert ${alert.id} in 5 minutes`);

  setTimeout(async () => {
    await escalateAlert(alert.id);
  }, 5 * 60 * 1000); // 5 minutes
}

async function testNotification(data: any) {
  const { channel, recipient } = data;

  const testAlert = {
    id: 'test_alert',
    title: 'Test Alert - System Check',
    description: 'This is a test notification to verify the alerting system is working correctly.',
    severity: 'LOW',
    alert_type: 'test',
    risk_score: 25,
    created_at: new Date().toISOString(),
    sla_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };

  return await sendNotification({
    alert_id: 'test_alert',
    channel,
    recipient_email: channel === 'email' ? recipient : null,
    recipient_phone: channel === 'sms' ? recipient : null
  });
}

function getSLAMinutes(severity: string): number {
  switch (severity) {
    case 'CRITICAL': return 15; // 15 minutes
    case 'HIGH': return 60;     // 1 hour
    case 'MEDIUM': return 240;  // 4 hours
    case 'LOW': return 480;     // 8 hours
    default: return 240;
  }
}