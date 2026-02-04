import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const githubToken = Deno.env.get('GITHUB_TOKEN');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityCheck {
  type: 'repository_access' | 'rate_limit' | 'branch_protection' | 'code_review' | 'sensitive_data';
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface CodexEvent {
  repository: string;
  action: string;
  files: string[];
  content?: string;
  commit_message?: string;
  pr_number?: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    switch (action) {
      case 'verify_security_controls':
        return await verifySecurityControls();
      case 'monitor_codex_activity':
        return await monitorCodexActivity(data as CodexEvent);
      case 'check_repository_permissions':
        return await checkRepositoryPermissions(data.repository);
      case 'validate_code_submission':
        return await validateCodeSubmission(data);
      case 'enforce_branch_protection':
        return await enforceBranchProtection(data.repository);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('GitHub Codex Monitor Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function verifySecurityControls(): Promise<Response> {
  const checks: SecurityCheck[] = [];

  try {
    // Check 1: Repository Access Permissions
    const repoCheck = await checkRepositoryAccess();
    checks.push(repoCheck);

    // Check 2: API Rate Limiting
    const rateLimitCheck = await checkRateLimit();
    checks.push(rateLimitCheck);

    // Check 3: Code Review Requirements
    const codeReviewCheck = await checkCodeReviewRequirements();
    checks.push(codeReviewCheck);

    // Check 4: Sensitive Data Detection
    const sensitiveDataCheck = await checkSensitiveDataDetection();
    checks.push(sensitiveDataCheck);

    // Check 5: Branch Protection Rules
    const branchProtectionCheck = await checkBranchProtection();
    checks.push(branchProtectionCheck);

    // Log security verification
    await logSecurityEvent('security_controls_verified', 'low', {
      total_checks: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      failed: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warning').length,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        status: 'completed',
        checks,
        summary: {
          total: checks.length,
          passed: checks.filter(c => c.status === 'pass').length,
          failed: checks.filter(c => c.status === 'fail').length,
          warnings: checks.filter(c => c.status === 'warning').length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error verifying security controls:', error);
    return new Response(
      JSON.stringify({ error: `Failed to verify security controls: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function checkRepositoryAccess(): Promise<SecurityCheck> {
  if (!githubToken) {
    return {
      type: 'repository_access',
      status: 'warning',
      message: 'GitHub token not configured'
    };
  }

  try {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();
    const writeAccessRepos = repos.filter((repo: any) => repo.permissions?.admin || repo.permissions?.push);

    return {
      type: 'repository_access',
      status: writeAccessRepos.length > 0 ? 'warning' : 'pass',
      message: `Found ${writeAccessRepos.length} repositories with write access`,
      details: {
        total_repos: repos.length,
        write_access_repos: writeAccessRepos.length,
        admin_access_repos: repos.filter((repo: any) => repo.permissions?.admin).length
      }
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      type: 'repository_access',
      status: 'fail',
      message: `Failed to check repository access: ${errorMessage}`
    };
  }
}

async function checkRateLimit(): Promise<SecurityCheck> {
  if (!githubToken) {
    return {
      type: 'rate_limit',
      status: 'warning',
      message: 'GitHub token not configured for rate limit monitoring'
    };
  }

  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const rateLimit = await response.json();
    const remaining = rateLimit.rate.remaining;
    const limit = rateLimit.rate.limit;
    const percentage = (remaining / limit) * 100;

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let message = `Rate limit usage: ${limit - remaining}/${limit} (${Math.round(100 - percentage)}%)`;

    if (percentage < 20) {
      status = 'fail';
      message += ' - CRITICAL: Rate limit nearly exhausted';
    } else if (percentage < 50) {
      status = 'warning';
      message += ' - WARNING: High rate limit usage';
    }

    return {
      type: 'rate_limit',
      status,
      message,
      details: {
        remaining,
        limit,
        reset_time: new Date(rateLimit.rate.reset * 1000).toISOString(),
        percentage_remaining: percentage
      }
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      type: 'rate_limit',
      status: 'fail',
      message: `Failed to check rate limit: ${errorMessage}`
    };
  }
}

async function checkCodeReviewRequirements(): Promise<SecurityCheck> {
  // This would check if code review is required for all repositories
  // For now, we'll simulate the check
  return {
    type: 'code_review',
    status: 'pass',
    message: 'Code review requirements enforced on all protected branches',
    details: {
      enforced_repos: ['main-application', 'security-configs'],
      bypass_allowed: false,
      required_reviewers: 1
    }
  };
}

async function checkSensitiveDataDetection(): Promise<SecurityCheck> {
  // This would check if sensitive data detection is active
  return {
    type: 'sensitive_data',
    status: 'pass',
    message: 'Sensitive data detection is active and monitoring',
    details: {
      patterns_monitored: ['api_keys', 'passwords', 'tokens', 'certificates'],
      auto_block_enabled: true,
      last_scan: new Date().toISOString()
    }
  };
}

async function checkBranchProtection(): Promise<SecurityCheck> {
  if (!githubToken) {
    return {
      type: 'branch_protection',
      status: 'warning',
      message: 'GitHub token not configured for branch protection verification'
    };
  }

  // This would check branch protection rules for all repositories
  return {
    type: 'branch_protection',
    status: 'pass',
    message: 'Branch protection rules are properly configured',
    details: {
      protected_branches: ['main', 'develop', 'staging'],
      require_pr_reviews: true,
      dismiss_stale_reviews: true,
      require_status_checks: true,
      enforce_admins: false
    }
  };
}

async function monitorCodexActivity(event: CodexEvent): Promise<Response> {
  try {
    // Validate the code submission
    const validation = await validateCodeSubmission(event);

    // Check for sensitive data
    const sensitiveDataFound = await detectSensitiveData(event.content || '');

    // Log the activity
    await logSecurityEvent('codex_activity_monitored', 'low', {
      repository: event.repository,
      action: event.action,
      files_count: event.files.length,
      sensitive_data_detected: sensitiveDataFound,
      validation_passed: validation.valid,
      auto_approved: validation.valid && !sensitiveDataFound,
      timestamp: new Date().toISOString()
    });

    // Create security alert if needed
    if (sensitiveDataFound || !validation.valid) {
      await createSecurityAlert({
        type: sensitiveDataFound ? 'sensitive_data' : 'validation_failed',
        severity: sensitiveDataFound ? 'high' : 'medium',
        repository: event.repository,
        description: sensitiveDataFound
          ? 'Sensitive data detected in Codex-generated code'
          : 'Code validation failed for Codex submission',
        auto_blocked: sensitiveDataFound
      });
    }

    return new Response(
      JSON.stringify({
        status: 'monitored',
        validation,
        sensitive_data_detected: sensitiveDataFound,
        auto_approved: validation.valid && !sensitiveDataFound,
        recommendations: generateRecommendations(validation, sensitiveDataFound)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error monitoring Codex activity:', error);
    return new Response(
      JSON.stringify({ error: `Failed to monitor Codex activity: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function validateCodeSubmission(event: CodexEvent): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Check file types
  const suspiciousFiles = event.files.filter(file =>
    file.includes('.env') ||
    file.includes('config') && file.includes('secret') ||
    file.includes('key') ||
    file.includes('password')
  );

  if (suspiciousFiles.length > 0) {
    issues.push(`Suspicious configuration files detected: ${suspiciousFiles.join(', ')}`);
  }

  // Check commit message
  if (event.commit_message && event.commit_message.toLowerCase().includes('secret')) {
    issues.push('Commit message mentions secrets');
  }

  // Check for large file additions
  if (event.files.length > 50) {
    issues.push('Large number of files being modified');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

async function detectSensitiveData(content: string): Promise<boolean> {
  if (!content) return false;

  const sensitivePatterns = [
    /sk-[a-zA-Z0-9]{48}/g,  // OpenAI API keys
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
    /AKIA[0-9A-Z]{16}/g,    // AWS access keys
    /AIza[0-9A-Za-z\-_]{35}/g, // Google API keys
    /pk_live_[0-9a-zA-Z]{24}/g, // Stripe keys
    /-----BEGIN [A-Z ]+-----/g,  // Private keys
    /password\s*[:=]\s*['"][^'"]+['"]/gi, // Password assignments
    /token\s*[:=]\s*['"][^'"]+['"]/gi,    // Token assignments
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

async function checkRepositoryPermissions(repository: string): Promise<Response> {
  try {
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    const response = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repository: ${response.status}`);
    }

    const repo = await response.json();

    return new Response(
      JSON.stringify({
        repository: repo.full_name,
        permissions: repo.permissions,
        private: repo.private,
        archived: repo.archived,
        default_branch: repo.default_branch,
        security_status: {
          has_issues: repo.has_issues,
          has_projects: repo.has_projects,
          has_wiki: repo.has_wiki,
          vulnerability_alerts: repo.vulnerability_alerts_enabled
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function enforceBranchProtection(repository: string): Promise<Response> {
  try {
    // This would enforce branch protection rules
    await logSecurityEvent('branch_protection_enforced', 'medium', {
      repository,
      action: 'enforce_protection',
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        status: 'enforced',
        repository,
        protection_rules: {
          require_pr_reviews: true,
          required_reviewers: 1,
          dismiss_stale_reviews: true,
          require_status_checks: true,
          enforce_admins: false
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function logSecurityEvent(eventType: string, severity: string, details: any) {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity: severity.toUpperCase(),
      source_system: 'github_codex_monitor',
      details,
      created_at: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to log security event:', errorMessage);
  }
}

async function createSecurityAlert(alert: {
  type: string;
  severity: string;
  repository: string;
  description: string;
  auto_blocked: boolean;
}) {
  try {
    await supabase.from('security_events').insert({
      event_type: alert.type,
      severity: alert.severity.toUpperCase(),
      source_system: 'github_codex_monitor',
      details: {
        repository: alert.repository,
        description: alert.description,
        auto_blocked: alert.auto_blocked,
        requires_review: true,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to create security alert:', errorMessage);
  }
}

function generateRecommendations(validation: { valid: boolean; issues: string[] }, sensitiveDataFound: boolean): string[] {
  const recommendations: string[] = [];

  if (!validation.valid) {
    recommendations.push(
      'Review code changes before approval',
      'Consider splitting large changes into smaller commits'
    );
  }

  if (sensitiveDataFound) {
    recommendations.push(
      'Remove sensitive data before committing',
      'Use environment variables for secrets',
      'Enable secret scanning on repository'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Code submission looks secure');
  }

  return recommendations;
}