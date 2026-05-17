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

// ─── Autosend Email Delivery ─────────────────────────────────────────────────
async function sendEmailWithAutosend(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const apiKey = Deno.env.get('AUTOSEND_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'AUTOSEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.autosend.com/v1/mails/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        from: 'compliance@adinkhepra.com',
        subject,
        html,
        text: text || subject,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Autosend ${response.status}: ${errText}` };
    }

    const result = await response.json();
    return { success: true, message_id: result.id || `autosend_${Date.now()}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Report Email Templates ──────────────────────────────────────────────────

function buildScorecardEmail(scorecard: any, recipientName: string): string {
  const score = scorecard.overall_score?.toFixed(1) || '—';
  const sprs = scorecard.sprs_score ?? '—';
  const readiness = scorecard.certification_readiness || 'UNKNOWN';
  const l2Pass = scorecard.level_2?.passing_count || 0;
  const l2Fail = scorecard.level_2?.failing_count || 0;
  const l3Pass = scorecard.level_3?.passing_count || 0;
  const l3Fail = scorecard.level_3?.failing_count || 0;

  const readinessColor = readiness === 'READY FOR CERTIFICATION' ? '#27ae60'
    : readiness === 'NEAR COMPLIANCE' ? '#f39c12' : '#e74c3c';

  // Domain breakdown rows
  let domainRows = '';
  if (scorecard.level_2?.domain_scores) {
    for (const [domain, ds] of Object.entries(scorecard.level_2.domain_scores) as any) {
      const pct = ds.total > 0 ? ((ds.passing / ds.total) * 100).toFixed(0) : '0';
      const barWidth = ds.total > 0 ? Math.round((ds.passing / ds.total) * 100) : 0;
      domainRows += `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2433;color:#e2e5ec;font-family:monospace;font-size:13px">${domain}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2433;color:#8891a5;font-size:13px">${ds.family}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2433;color:#27ae60;font-size:13px">${ds.passing}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2433;color:#e74c3c;font-size:13px">${ds.failing}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2433">
            <div style="background:#1e2433;border-radius:4px;height:8px;width:100px">
              <div style="background:${barWidth >= 90 ? '#27ae60' : barWidth >= 70 ? '#f39c12' : '#e74c3c'};border-radius:4px;height:8px;width:${barWidth}px"></div>
            </div>
            <span style="color:#8891a5;font-size:11px">${pct}%</span>
          </td>
        </tr>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:'IBM Plex Sans',-apple-system,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0 24px">
      <div style="font-size:24px;color:#c9a227;letter-spacing:.08em;font-weight:700">🛡️ AdinKhepra</div>
      <div style="font-size:11px;color:#5c6478;font-family:monospace;letter-spacing:.1em;text-transform:uppercase;margin-top:4px">CMMC 3.0 Compliance Scorecard</div>
    </div>

    <!-- Card -->
    <div style="background:#12151c;border:1px solid #1e2433;border-radius:12px;padding:32px;margin-bottom:24px">
      <p style="color:#8891a5;font-size:14px;margin:0 0 24px">Hello ${recipientName},</p>
      <p style="color:#e2e5ec;font-size:14px;line-height:1.6;margin:0 0 24px">
        Your CMMC 3.0 compliance scorecard has been generated. Here is your current posture:
      </p>

      <!-- Score Grid -->
      <div style="display:flex;gap:16px;margin-bottom:24px">
        <div style="flex:1;background:#181c26;border-radius:8px;padding:20px;text-align:center">
          <div style="font-size:36px;color:#e2e5ec;font-weight:700">${score}</div>
          <div style="font-size:11px;color:#5c6478;font-family:monospace;text-transform:uppercase;margin-top:4px">Overall Score</div>
        </div>
        <div style="flex:1;background:#181c26;border-radius:8px;padding:20px;text-align:center">
          <div style="font-size:36px;color:#c9a227;font-weight:700">${sprs}</div>
          <div style="font-size:11px;color:#5c6478;font-family:monospace;text-transform:uppercase;margin-top:4px">SPRS Score</div>
        </div>
      </div>

      <!-- Readiness Badge -->
      <div style="text-align:center;padding:16px;background:${readinessColor}11;border:1px solid ${readinessColor}33;border-radius:8px;margin-bottom:24px">
        <span style="font-family:monospace;font-size:13px;font-weight:600;color:${readinessColor};letter-spacing:.06em">${readiness}</span>
      </div>

      <!-- L2/L3 Summary -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="padding:12px;background:#181c26;border-radius:8px 0 0 8px;text-align:center">
            <div style="font-size:11px;color:#5c6478;font-family:monospace;text-transform:uppercase">L2 (110 practices)</div>
            <div style="font-size:20px;color:#27ae60;margin-top:4px">${l2Pass} ✓</div>
            <div style="font-size:14px;color:#e74c3c">${l2Fail} ✗</div>
          </td>
          <td style="padding:12px;background:#181c26;border-radius:0 8px 8px 0;text-align:center">
            <div style="font-size:11px;color:#5c6478;font-family:monospace;text-transform:uppercase">L3 (24 enhanced)</div>
            <div style="font-size:20px;color:#27ae60;margin-top:4px">${l3Pass} ✓</div>
            <div style="font-size:14px;color:#e74c3c">${l3Fail} ✗</div>
          </td>
        </tr>
      </table>

      <!-- Domain Breakdown -->
      <h3 style="color:#e2e5ec;font-size:14px;margin:0 0 12px;font-family:monospace;letter-spacing:.04em">DOMAIN BREAKDOWN</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <th style="padding:8px 12px;text-align:left;color:#5c6478;font-size:10px;font-family:monospace;letter-spacing:.06em;border-bottom:1px solid #2a3044">DOMAIN</th>
          <th style="padding:8px 12px;text-align:left;color:#5c6478;font-size:10px;font-family:monospace;letter-spacing:.06em;border-bottom:1px solid #2a3044">FAMILY</th>
          <th style="padding:8px 12px;text-align:left;color:#5c6478;font-size:10px;font-family:monospace;letter-spacing:.06em;border-bottom:1px solid #2a3044">PASS</th>
          <th style="padding:8px 12px;text-align:left;color:#5c6478;font-size:10px;font-family:monospace;letter-spacing:.06em;border-bottom:1px solid #2a3044">FAIL</th>
          <th style="padding:8px 12px;text-align:left;color:#5c6478;font-size:10px;font-family:monospace;letter-spacing:.06em;border-bottom:1px solid #2a3044">SCORE</th>
        </tr>
        ${domainRows}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px">
      <a href="https://adinkhepra.com/compliance" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#c9a227,#b08d1f);color:#0a0c10;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #1e2433">
      <p style="color:#5c6478;font-size:11px;font-family:monospace;margin:0">
        Powered by AdinKhepra CMMC Compliance Autopilot<br>
        SecRed Knowledge Inc. (NouchiX) · SDVOSB · Patent Pending USPTO #73565085
      </p>
      <p style="color:#5c6478;font-size:11px;margin:8px 0 0">
        ML-DSA-65 PQC Signed · DAG-Anchored Evidence · STIG→CCI→NIST→CMMC Mapping Chain
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Edge Function Handler ───────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    switch (action) {
      case 'send_scorecard': {
        // Send CMMC scorecard report via email
        const { recipient_email, recipient_name, scorecard } = data;
        if (!recipient_email || !scorecard) {
          return new Response(JSON.stringify({ success: false, error: 'Missing recipient_email or scorecard' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const html = buildScorecardEmail(scorecard, recipient_name || 'Team');
        const subject = `🛡️ CMMC 3.0 Scorecard — SPRS ${scorecard.sprs_score ?? '—'} | ${scorecard.certification_readiness || 'Assessment'}`;

        const result = await sendEmailWithAutosend(recipient_email, subject, html);

        // Log to Supabase
        await supabase.from('compliance_report_emails').insert({
          recipient_email,
          scorecard_summary: {
            overall_score: scorecard.overall_score,
            sprs_score: scorecard.sprs_score,
            readiness: scorecard.certification_readiness,
          },
          delivery_status: result.success ? 'SENT' : 'FAILED',
          message_id: result.message_id,
          error: result.error,
        }).then(() => {}).catch(() => {});

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send_evidence_package': {
        // Send evidence package download link after checkout
        const { recipient_email, recipient_name, attestation_id, verify_url } = data;
        if (!recipient_email || !attestation_id) {
          return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:'IBM Plex Sans',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="text-align:center;padding:32px 0 16px">
    <div style="font-size:24px;color:#c9a227;font-weight:700">🛡️ AdinKhepra</div>
  </div>
  <div style="background:#12151c;border:1px solid #1e2433;border-radius:12px;padding:32px">
    <h2 style="color:#e2e5ec;font-size:20px;margin:0 0 16px">Your Evidence Package is Ready</h2>
    <p style="color:#8891a5;font-size:14px;line-height:1.6">Hello ${recipient_name || 'Team'},</p>
    <p style="color:#e2e5ec;font-size:14px;line-height:1.6">
      Your CMMC compliance attestation has been signed with ML-DSA-65 post-quantum cryptography
      and anchored to the DAG audit chain.
    </p>
    <div style="background:#181c26;border-radius:8px;padding:16px;margin:20px 0;font-family:monospace;font-size:12px">
      <div style="color:#5c6478;margin-bottom:4px">ATTESTATION ID</div>
      <div style="color:#c9a227;word-break:break-all">${attestation_id}</div>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${verify_url || `https://adinkhepra.com/verify/${attestation_id}`}" style="display:inline-block;padding:14px 32px;background:#27ae60;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        ✅ Verify Attestation
      </a>
    </div>
    <p style="color:#5c6478;font-size:12px;text-align:center">
      Share this link with your C3PAO — they can verify independently without logging in.
    </p>
  </div>
  <div style="text-align:center;padding:20px 0;font-size:11px;color:#5c6478;font-family:monospace">
    SecRed Knowledge Inc. (NouchiX) · SDVOSB · Patent Pending
  </div>
</div>
</body></html>`;

        const subject = `✅ CMMC Attestation Ready — Verify at ${verify_url || 'adinkhepra.com'}`;
        const result = await sendEmailWithAutosend(recipient_email, subject, html);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
