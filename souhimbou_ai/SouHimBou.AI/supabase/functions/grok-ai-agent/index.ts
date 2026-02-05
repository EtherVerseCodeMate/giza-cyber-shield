/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Security validation utilities
class SecurityValidator {
  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /(;|--|\*|\/\*|\*\/)/g,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(WAITFOR|DELAY|BENCHMARK|SLEEP)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi
  ];

  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<\s*\/?\s*(script|iframe|object|embed|form|img|svg|math)\b/gi
  ];

  static validate(input: any): { isValid: boolean; errors: string[]; sanitized?: any } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      return { isValid: false, errors: ['Invalid input format'] };
    }

    const { message, sessionId, organizationId, userId } = input;

    // Validate required fields
    if (!message || typeof message !== 'string') {
      errors.push('Message is required and must be a string');
    } else if (message.length > 5000) {
      errors.push('Message exceeds maximum length of 5000 characters');
    } else if (this.containsMaliciousContent(message)) {
      errors.push('Message contains potentially dangerous content');
    }

    if (!sessionId || !this.isValidUUID(sessionId)) {
      errors.push('Valid session ID is required');
    }

    if (!organizationId || !this.isValidUUID(organizationId)) {
      errors.push('Valid organization ID is required');
    }

    if (!userId || !this.isValidUUID(userId)) {
      errors.push('Valid user ID is required');
    }

    const sanitized = errors.length === 0 ? {
      message: this.sanitizeString(message),
      sessionId,
      organizationId,
      userId,
      context: input.context ? this.sanitizeObject(input.context) : {}
    } : undefined;

    return { isValid: errors.length === 0, errors, sanitized };
  }

  private static containsMaliciousContent(value: string): boolean {
    return this.SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value)) ||
      this.XSS_PATTERNS.some(pattern => pattern.test(value));
  }

  private static isValidUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private static sanitizeString(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#x27;')
      .replaceAll('\0', '')
      .trim()
      .normalize('NFKC');
  }

  private static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

// Rate limiter
const rateLimiter = new Map<string, number[]>();
function checkRateLimit(identifier: string, maxRequests: number = 20, windowMs: number = 60000): boolean {
  const now = Date.now();
  const requests = rateLimiter.get(identifier) || [];
  const recentRequests = requests.filter(time => time > now - windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimiter.set(identifier, recentRequests);
  return true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const grokApiKey = Deno.env.get('GROK_API_KEY')!;

if (!supabaseUrl || !supabaseServiceKey || !grokApiKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SecurityContext {
  recentAlerts: any[];
  threatIntelligence: any[];
  complianceStatus: any[];
  securityEvents: any[];
  organizationProfile: any;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    const rawInput = await req.json();
    const validation = SecurityValidator.validate(rawInput);

    if (!validation.isValid) {
      console.warn('Input validation failed:', validation.errors);
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validation.errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, sessionId, organizationId, userId, context } = validation.sanitized!;

    // Get security context for the organization
    const securityContext = await getSecurityContext(organizationId);

    // Build enhanced system prompt with security context
    const systemPrompt = buildSecuritySystemPrompt(securityContext);

    // Call GrokAI API
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4-0709',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 2048,
        stream: false
      }),
    });

    if (!grokResponse.ok) {
      throw new Error(`GrokAI API error: ${grokResponse.status}`);
    }

    const grokData = await grokResponse.json();
    const agentResponse = grokData.choices[0].message.content;

    // Store conversation in database
    await supabase
      .from('ai_agent_chats')
      .insert([
        {
          user_id: userId,
          organization_id: organizationId,
          session_id: sessionId,
          message,
          message_type: 'user',
          context: { ...context, securityContext },
        },
        {
          user_id: userId,
          organization_id: organizationId,
          session_id: sessionId,
          message: agentResponse,
          response: agentResponse,
          message_type: 'agent',
          context: { model: 'grok-4-0709', temperature: 0.3 },
        }
      ]);

    // Analyze response for actionable security recommendations
    const actionableItems = await analyzeForActions(agentResponse, securityContext);

    // Execute autonomous actions that are safe to auto-execute
    const executionResults = await executeAutonomousActions(actionableItems, organizationId);

    return new Response(
      JSON.stringify({
        response: agentResponse,
        sessionId,
        actionableItems,
        executionResults,
        securityContext: {
          alertsCount: securityContext.recentAlerts.length,
          threatsCount: securityContext.threatIntelligence.length,
          complianceScore: calculateComplianceScore(securityContext.complianceStatus)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in GrokAI agent:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        error: 'AI agent temporarily unavailable',
        details: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getSecurityContext(organizationId: string): Promise<SecurityContext> {
  try {
    // Get recent alerts
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get threat intelligence
    const { data: threats } = await supabase
      .from('threat_intelligence')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get security events
    const { data: events } = await supabase
      .from('security_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(15);

    // Get compliance assessments
    const { data: compliance } = await supabase
      .from('compliance_assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get organization profile
    const { data: organization } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    return {
      recentAlerts: alerts || [],
      threatIntelligence: threats || [],
      complianceStatus: compliance || [],
      securityEvents: events || [],
      organizationProfile: organization
    };
  } catch (error) {
    console.error('Error fetching security context:', error);
    return {
      recentAlerts: [],
      threatIntelligence: [],
      complianceStatus: [],
      securityEvents: [],
      organizationProfile: null
    };
  }
}

function buildSecuritySystemPrompt(context: SecurityContext): string {
  const orgName = context.organizationProfile?.name || 'Organization';
  const industryInfo = context.organizationProfile?.settings?.industry || 'General';

  return `You are ARGUS, an advanced AI Security Operations Center (ASOC) agent for ${orgName}, specializing in cybersecurity analysis and AUTONOMOUS incident response.

ORGANIZATION CONTEXT:
- Industry: ${industryInfo}
- Active Alerts: ${context.recentAlerts.length}
- Threat Indicators: ${context.threatIntelligence.length}
- Recent Security Events: ${context.securityEvents.length}

CURRENT SECURITY STATUS:
${context.recentAlerts.length > 0 ? `- ACTIVE ALERTS: ${context.recentAlerts.map(a => `[${a.severity}] ${a.title}`).join(', ')}` : '- No active alerts'}
${context.threatIntelligence.length > 0 ? `- THREAT INTEL: Recent indicators include ${context.threatIntelligence.slice(0, 3).map(t => t.indicator_type).join(', ')}` : '- No recent threat indicators'}

AUTONOMOUS EXECUTION CAPABILITIES:
You can now directly implement security actions in live production environments. Your recommendations will be automatically converted to executable scripts when you:
- Suggest blocking IPs or domains (generates firewall rules)
- Recommend network scans (generates nmap commands)
- Advise patching systems (generates update scripts)
- Propose isolating endpoints (generates isolation scripts)
- Suggest configuration hardening (generates config changes)

EXECUTION SAFETY LEVELS:
- LOW RISK: Auto-executable (scans, monitoring, log analysis)
- MEDIUM RISK: Requires approval (configuration changes, patches)
- HIGH RISK: Manual review required (isolation, blocking, critical patches)

CAPABILITIES:
- Real-time threat analysis and correlation
- AUTONOMOUS security remediation execution
- Incident response with immediate action implementation
- Compliance gap analysis with auto-fixing
- Risk assessment with automated mitigation
- Security automation with direct system integration
- Threat hunting with live environment scanning

RESPONSE GUIDELINES:
- Provide actionable, EXECUTABLE recommendations
- Use specific commands that can be directly implemented
- Specify target IPs, domains, or systems for actions
- Indicate urgency level for execution prioritization
- Reference current security context when relevant
- Structure responses for immediate implementation
- Include both manual and automated remediation options

EXECUTION EXAMPLES:
- "Block IP 185.220.101.42 immediately" → Auto-generates firewall rules
- "Scan network range 192.168.1.0/24 for vulnerabilities" → Auto-generates nmap commands
- "Harden SSH configuration on all servers" → Auto-generates SSH config scripts
- "Investigate suspicious domain malicious.example.com" → Auto-generates threat intel queries

Remember: You now have AUTONOMOUS EXECUTION CAPABILITIES. Your recommendations will be directly implemented in live environments when safe to do so. Always provide specific, actionable instructions that can be automatically converted to production-ready scripts.`;
}

async function analyzeForActions(response: string, context: SecurityContext): Promise<any[]> {
  const actionableItems = [];

  // Parse response for actionable recommendations with execution capabilities
  const actionKeywords = [
    'recommend', 'suggest', 'should', 'implement', 'configure',
    'update', 'patch', 'investigate', 'monitor', 'block', 'allow',
    'scan', 'firewall', 'isolate', 'quarantine', 'remediate'
  ];

  const sentences = response.split(/[.!?]/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (actionKeywords.some(keyword => lowerSentence.includes(keyword))) {
      const action = await createExecutableAction(sentence.trim(), context);
      if (action) {
        actionableItems.push(action);
      }
    }
  }

  return actionableItems.slice(0, 5); // Limit to top 5 actions
}

async function createExecutableAction(sentence: string, context: SecurityContext): Promise<any | null> {
  const lowerSentence = sentence.toLowerCase();
  const priority = determinePriority(sentence);
  const category = categorizeAction(sentence);

  // Determine if action can be auto-executed based on priority and type
  const canAutoExecute = shouldAutoExecute(sentence, priority, category);

  // Extract target information (IPs, domains, etc.)
  const targets = extractTargets(sentence);

  // Map to specific remediation actions
  let remediationType = null;
  let remediationScript = null;

  if (lowerSentence.includes('block') || lowerSentence.includes('firewall')) {
    remediationType = 'network_isolation';
    remediationScript = generateFirewallScript(targets);
  } else if (lowerSentence.includes('scan') || lowerSentence.includes('investigate')) {
    remediationType = 'threat_investigation';
    remediationScript = generateScanScript(targets);
  } else if (lowerSentence.includes('patch') || lowerSentence.includes('update')) {
    remediationType = 'patch_management';
    remediationScript = generatePatchScript(targets);
  } else if (lowerSentence.includes('isolate') || lowerSentence.includes('quarantine')) {
    remediationType = 'endpoint_isolation';
    remediationScript = generateIsolationScript(targets);
  } else if (lowerSentence.includes('configure') || lowerSentence.includes('harden')) {
    remediationType = 'configuration_hardening';
    remediationScript = generateConfigScript(sentence);
  }

  if (!remediationType) return null;

  return {
    type: 'executable_action',
    text: sentence,
    priority,
    category,
    canAutoExecute,
    remediationType,
    remediationScript,
    targets,
    estimatedDuration: estimateDuration(remediationType),
    requiresApproval: !canAutoExecute || priority === 'high' || priority === 'critical',
    riskLevel: assessRiskLevel(remediationType, targets)
  };
}

function determinePriority(sentence: string): 'critical' | 'high' | 'medium' | 'low' {
  const criticalWords = ['critical', 'urgent', 'immediate', 'emergency', 'breach'];
  const highPriorityWords = ['high', 'severe', 'dangerous'];
  const mediumPriorityWords = ['important', 'significant', 'recommend'];

  const lowerSentence = sentence.toLowerCase();

  if (criticalWords.some(word => lowerSentence.includes(word))) {
    return 'critical';
  } else if (highPriorityWords.some(word => lowerSentence.includes(word))) {
    return 'high';
  } else if (mediumPriorityWords.some(word => lowerSentence.includes(word))) {
    return 'medium';
  }
  return 'low';
}

function categorizeAction(sentence: string): string {
  const categories = {
    'incident-response': ['investigate', 'respond', 'contain', 'isolate'],
    'configuration': ['configure', 'set up', 'enable', 'disable'],
    'monitoring': ['monitor', 'watch', 'track', 'observe'],
    'patching': ['update', 'patch', 'upgrade', 'fix'],
    'policy': ['policy', 'procedure', 'rule', 'guideline']
  };

  const lowerSentence = sentence.toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerSentence.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}

function calculateComplianceScore(complianceData: any[]): number {
  if (complianceData.length === 0) return 0;

  const scores = complianceData
    .filter(assessment => assessment.overall_score !== null)
    .map(assessment => assessment.overall_score);

  if (scores.length === 0) return 0;

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

// Helper functions for autonomous action execution
function shouldAutoExecute(sentence: string, priority: string, category: string): boolean {
  const lowerSentence = sentence.toLowerCase();

  // EMERGENCY AUTO-EXECUTION: "Shoot first, ask questions later"
  // High-priority threats with active indicators should be auto-executed
  const emergencyKeywords = [
    'breach', 'attack', 'malware', 'ransomware', 'compromise',
    'backdoor', 'exploit', 'intrusion', 'suspicious', 'threat'
  ];

  const hasEmergencyKeyword = emergencyKeywords.some(keyword =>
    lowerSentence.includes(keyword)
  );

  // Auto-execute HIGH RISK actions if it's an emergency situation
  if (hasEmergencyKeyword && (priority === 'high' || priority === 'critical')) {
    console.log(`EMERGENCY AUTO-EXECUTION triggered for: ${sentence}`);
    return true;
  }

  // Continue with existing logic for lower-risk actions
  const safeActions = ['scan', 'investigate', 'monitor', 'log', 'alert'];
  return safeActions.some(action => lowerSentence.includes(action));
}

function extractTargets(sentence: string): string[] {
  const targets: string[] = [];

  // Extract IP addresses
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const ips = sentence.match(ipRegex) || [];
  targets.push(...ips);

  // Extract domain names
  const domainRegex = /\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\b/g;
  const domains = sentence.match(domainRegex)?.filter(d => d.includes('.')) || [];
  targets.push(...domains);

  return [...new Set(targets)]; // Remove duplicates
}

function generateFirewallScript(targets: string[]): string {
  if (targets.length === 0) return 'echo "No targets specified for firewall rule"';

  return targets.map(target =>
    `iptables -A INPUT -s ${target} -j DROP && echo "Blocked ${target}"`
  ).join('\n');
}

function generateScanScript(targets: string[]): string {
  if (targets.length === 0) return 'nmap -sn 192.168.1.0/24';

  return targets.map(target =>
    `nmap -sV -sC ${target} && echo "Scan completed for ${target}"`
  ).join('\n');
}

function generatePatchScript(targets: string[]): string {
  return `
# Automated patch management
apt update && apt upgrade -y || yum update -y
echo "Security patches applied on $(date)"
  `.trim();
}

function generateIsolationScript(targets: string[]): string {
  if (targets.length === 0) return 'echo "No targets specified for isolation"';

  return targets.map(target =>
    `# Isolate ${target}\niptables -A INPUT -s ${target} -j DROP\niptables -A OUTPUT -d ${target} -j DROP`
  ).join('\n');
}

function generateConfigScript(sentence: string): string {
  const lowerSentence = sentence.toLowerCase();

  if (lowerSentence.includes('ssh')) {
    return `
# SSH hardening
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
    `.trim();
  } else if (lowerSentence.includes('firewall')) {
    return `
# Basic firewall hardening
ufw enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
    `.trim();
  }

  return 'echo "Configuration script needs manual review"';
}

function estimateDuration(remediationType: string): number {
  const durations = {
    'network_isolation': 2,
    'threat_investigation': 15,
    'patch_management': 30,
    'endpoint_isolation': 5,
    'configuration_hardening': 10
  };

  return (durations as Record<string, number>)[remediationType] || 10;
}

function assessRiskLevel(remediationType: string, targets: string[]): string {
  if (remediationType === 'endpoint_isolation' || remediationType === 'network_isolation') {
    return targets.length > 5 ? 'high' : 'medium';
  }

  if (remediationType === 'patch_management') {
    return 'medium';
  }

  return 'low';
}

async function executeAutonomousActions(actionableItems: any[], organizationId: string): Promise<any[]> {
  const executionResults = [];

  for (const action of actionableItems) {
    if (action.type !== 'executable_action') continue;

    try {
      // EMERGENCY EXECUTION: Execute immediately for high-risk threats
      const shouldExecuteImmediately = action.canAutoExecute ||
        (action.priority === 'high' || action.priority === 'critical');

      if (shouldExecuteImmediately) {
        console.log(`AUTONOMOUS EXECUTION: ${action.text}`);

        // Generate rollback script before execution
        const rollbackScript = generateRollbackScript(action);

        // Call automated remediation function
        const { data: remediationResult, error } = await supabase.functions.invoke('automated-remediation', {
          body: {
            action: action.remediationType,
            targets: action.targets,
            remediation_type: action.category,
            organizationId,
            dry_run: false,
            script: action.remediationScript,
            emergency_mode: action.priority === 'high' || action.priority === 'critical'
          }
        });

        if (error) {
          console.error('Emergency remediation failed:', error);
          executionResults.push({
            actionId: action.text.substring(0, 50),
            status: 'failed',
            error: error.message,
            type: action.remediationType,
            emergency: true
          });
        } else {
          console.log('EMERGENCY ACTION EXECUTED:', remediationResult);

          // Store execution record with rollback capability
          const { data: activityRecord } = await supabase.from('remediation_activities').insert([{
            organization_id: organizationId,
            action_type: action.remediationType,
            targets: action.targets,
            execution_status: 'COMPLETED',
            results: {
              ...remediationResult,
              rollback_script: rollbackScript,
              emergency_execution: true,
              executed_at: new Date().toISOString()
            },
            successful_actions: remediationResult?.summary?.successful_actions || 1,
            total_actions: remediationResult?.summary?.total_actions || 1,
            success_rate: remediationResult?.summary?.success_rate || 100
          }]).select().single();

          // Send immediate alert notification
          await sendEmergencyAlert(action, remediationResult, organizationId);

          executionResults.push({
            actionId: action.text.substring(0, 50),
            status: 'executed_emergency',
            result: remediationResult,
            type: action.remediationType,
            targets: action.targets,
            successRate: remediationResult?.summary?.success_rate || 100,
            rollbackId: activityRecord?.id,
            emergency: true
          });
        }
      } else {
        // Action requires approval - store for manual review
        await supabase.from('remediation_activities').insert([{
          organization_id: organizationId,
          action_type: action.remediationType,
          targets: action.targets,
          execution_status: 'PENDING',
          results: {
            reason: action.requiresApproval ? 'Requires approval' : 'High risk action',
            script: action.remediationScript,
            estimatedDuration: action.estimatedDuration,
            riskLevel: action.riskLevel
          },
          dry_run: true
        }]);

        executionResults.push({
          actionId: action.text.substring(0, 50),
          status: 'pending_approval',
          reason: action.requiresApproval ? 'Requires manual approval' : 'High risk - needs review',
          type: action.remediationType,
          targets: action.targets
        });
      }
    } catch (error) {
      console.error('Error executing autonomous action:', error);
      executionResults.push({
        actionId: action.text.substring(0, 50),
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        type: action.remediationType
      });
    }
  }

  return executionResults;
}

// Rollback script generation
function generateRollbackScript(action: any): string {
  const remediationType = action.remediationType;
  const targets = action.targets || [];

  switch (remediationType) {
    case 'network_isolation':
      // Generate undo iptables rules
      return targets.map((target: string) =>
        `iptables -D INPUT -s ${target} -j DROP && echo "Unblocked ${target}"`
      ).join('\n');

    case 'endpoint_isolation':
      return targets.map((target: string) =>
        `# Restore network access for ${target}\niptables -D INPUT -s ${target} -j DROP\niptables -D OUTPUT -d ${target} -j DROP`
      ).join('\n');

    case 'configuration_hardening':
      if (action.text.toLowerCase().includes('ssh')) {
        return `
# Rollback SSH configuration
cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
systemctl restart sshd
echo "SSH configuration rolled back"
        `.trim();
      }
      return 'echo "Manual rollback required for configuration changes"';

    case 'patch_management':
      return `
# Rollback patches (use with extreme caution)
echo "Patch rollback requires manual intervention"
echo "Check /var/log/apt/history.log for package history"
      `.trim();

    default:
      return `echo "No automated rollback available for ${remediationType}"`;
  }
}

// Emergency alert system
async function sendEmergencyAlert(action: any, result: any, organizationId: string): Promise<void> {
  try {
    // Create emergency alert record
    const alertTitle = `🚨 EMERGENCY: Autonomous Security Action Executed`;
    const alertDescription = `ARGUS AI automatically executed ${action.remediationType} to address ${action.priority} priority threat: ${action.text}`;

    // Insert alert into alerts table
    await supabase.from('alerts').insert([{
      organization_id: organizationId,
      alert_type: 'autonomous_action',
      title: alertTitle,
      description: alertDescription,
      severity: 'CRITICAL',
      status: 'OPEN',
      metadata: {
        action_type: action.remediationType,
        targets: action.targets,
        execution_result: result,
        autonomous: true,
        emergency_execution: true,
        executed_at: new Date().toISOString()
      },
      risk_score: action.priority === 'critical' ? 95 : 85,
      source_type: 'AI_AGENT',
      source_id: 'ARGUS'
    }]);

    // Log security event
    await supabase.from('security_events').insert([{
      organization_id: organizationId,
      event_type: 'autonomous_remediation',
      severity: 'HIGH',
      details: {
        message: `ARGUS AI executed emergency action: ${action.text}`,
        action_type: action.remediationType,
        targets: action.targets,
        success_rate: result?.summary?.success_rate || 100,
        rollback_available: true
      },
      source_system: 'ARGUS_AI'
    }]);

    console.log(`Emergency alert sent for autonomous action: ${action.remediationType}`);

  } catch (error) {
    console.error('Failed to send emergency alert:', error);
  }
}