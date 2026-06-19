/**
 * DAGGraphService — fetches live DAG audit trail + CMMC compliance scan results
 * from the Khepra daemon (port 45444) and merges them into the 3d-force-graph
 * wire format consumed by DAGAuditViewer.
 *
 * Endpoint contracts:
 *   GET /dag/graph          → DAGGraphResponse  (daemon DAG nodes)
 *   GET /compliance/scan-all → ComplianceScanResponse (OSScanner results)
 */

const DAEMON_BASE = 'http://127.0.0.1:45444';

// ── Wire types (match handlers_graph.go) ──────────────────────────────────────

export interface ViewerNode {
  id: string;
  label: string;
  type: 'prompt' | 'tool' | 'finding' | 'control' | 'attest' | 'staging' | 'remediated';
  val: number;
  desc: string;
  ts?: string;
  severity?: 'CAT_I' | 'CAT_II' | 'CAT_III';
  impact?: string;
  roi?: string;
  sig?: string;
  framework?: string;
  symbol?: string;
  job_id?: string;
}

export interface ViewerLink {
  source: string;
  target: string;
  w: number;
}

export interface ViewerMeta {
  session_id: string;
  tenant: string;
  tool_calls: number;
  attestations: number;
  findings: number;
  controls_mapped: number;
  staging_pending: number;
  auto_remediated: number;
  generated: string;
  license_tier: string;
}

export interface DAGGraphPayload {
  meta: ViewerMeta;
  nodes: ViewerNode[];
  links: ViewerLink[];
}

export interface ComplianceScanResult {
  controls: Record<string, string>; // controlID → PASS|FAIL|MANUAL_REVIEW|STAGING_PENDING:uuid
  total: number;
  pass: number;
  fail: number;
  manual_review: number;
  staging_pending: number;
  timestamp: string;
}

// ── Colour palette (mirrors DAGAuditViewer.tsx) ───────────────────────────────

const CMMC_FAMILY_LABELS: Record<string, string> = {
  '3.1': 'AC – Access Control',
  '3.2': 'AT – Awareness & Training',
  '3.3': 'AU – Audit & Accountability',
  '3.4': 'CM – Config Management',
  '3.5': 'IA – Identification & Auth',
  '3.6': 'IR – Incident Response',
  '3.7': 'MA – Maintenance',
  '3.8': 'MP – Media Protection',
  '3.9': 'PS – Personnel Security',
  '3.10': 'PE – Physical Protection',
  '3.11': 'RA – Risk Assessment',
  '3.12': 'CA – Security Assessment',
  '3.13': 'SC – System & Comms',
  '3.14': 'SI – System & Info Integrity',
};

function cmmcFamily(controlID: string): string {
  const parts = controlID.replace('e', '').split('.');
  if (parts.length >= 2) {
    const key = `${parts[0]}.${parts[1]}`;
    return CMMC_FAMILY_LABELS[key] ?? `NIST ${controlID.endsWith('e') ? '800-172' : '800-171'}`;
  }
  return 'NIST 800-171';
}

function statusToViewerType(status: string): ViewerNode['type'] {
  if (status === 'PASS') return 'control';
  if (status === 'MANUAL_REVIEW') return 'staging';
  if (status.startsWith('STAGING_PENDING')) return 'staging';
  if (status === 'AUTO_REMEDIATED') return 'remediated';
  return 'finding'; // FAIL
}

function statusToSeverity(status: string, controlID: string): ViewerNode['severity'] | undefined {
  if (status === 'PASS' || status === 'AUTO_REMEDIATED') return undefined;
  // Enhanced (800-172) controls that fail are always CAT_I severity
  if (controlID.endsWith('e')) return 'CAT_I';
  return 'CAT_II';
}

/** Build one ViewerNode per CMMC control. */
function cmmcControlsToNodes(scan: ComplianceScanResult): ViewerNode[] {
  return Object.entries(scan.controls).map(([id, status]) => {
    const type = statusToViewerType(status);
    const jobID = status.startsWith('STAGING_PENDING:') ? status.split(':')[1] : undefined;
    return {
      id: `ctrl-${id}`,
      label: id,
      type,
      val: type === 'finding' ? 14 : type === 'staging' ? 11 : 7,
      desc: cmmcFamily(id),
      framework: id.endsWith('e') ? 'NIST SP 800-172 Enhanced' : 'NIST SP 800-171 Rev 2 / CMMC L2',
      severity: statusToSeverity(status, id),
      job_id: jobID,
    } satisfies ViewerNode;
  });
}

/**
 * Build family-cluster links: one synthetic cluster node per 800-171/172 family,
 * with edges from each control node to its family hub. This produces the Wiz-style
 * cluster layout where controls orbit their family group.
 */
function buildFamilyLinks(controlNodes: ViewerNode[]): { hubs: ViewerNode[]; links: ViewerLink[] } {
  const families = new Map<string, string[]>();
  for (const n of controlNodes) {
    const parts = n.id.replace('ctrl-', '').replace('e', '').split('.');
    if (parts.length < 2) continue;
    const fam = `${parts[0]}.${parts[1]}`;
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam)!.push(n.id);
  }

  const hubs: ViewerNode[] = [];
  const links: ViewerLink[] = [];
  for (const [fam, members] of families) {
    const hubID = `fam-${fam}`;
    hubs.push({
      id: hubID,
      label: CMMC_FAMILY_LABELS[fam] ?? fam,
      type: 'prompt',
      val: 18,
      desc: `CMMC control family ${fam}`,
    });
    for (const memberID of members) {
      links.push({ source: hubID, target: memberID, w: 1 });
    }
  }
  return { hubs, links };
}

// ── Network ───────────────────────────────────────────────────────────────────

async function daemonGet<T>(path: string): Promise<T | null> {
  try {
    const resp = await fetch(`${DAEMON_BASE}${path}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    return resp.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export class DAGGraphService {
  /** Fetch live DAG nodes from the daemon. */
  static async fetchDAGGraph(): Promise<DAGGraphPayload | null> {
    return daemonGet<DAGGraphPayload>('/dag/graph');
  }

  /** Run (or return cached) OSScanner.ScanAll() via the daemon. */
  static async fetchComplianceScan(): Promise<ComplianceScanResult | null> {
    return daemonGet<ComplianceScanResult>('/compliance/scan-all');
  }

  /**
   * Merge DAG audit trail + CMMC scan results into one 3d-force-graph payload.
   * DAG nodes (tool/attest/prompt/finding) are layered on top of CMMC family
   * cluster nodes so both audit provenance and compliance posture live in the
   * same graph.
   */
  static async buildLivePayload(): Promise<DAGGraphPayload> {
    const [dagData, scanData] = await Promise.all([
      DAGGraphService.fetchDAGGraph(),
      DAGGraphService.fetchComplianceScan(),
    ]);

    // Start with DAG audit trail nodes + links.
    const nodes: ViewerNode[] = dagData?.nodes ?? [];
    const links: ViewerLink[] = dagData?.links ?? [];

    // Layer in CMMC control nodes.
    if (scanData) {
      const controlNodes = cmmcControlsToNodes(scanData);
      const { hubs, links: familyLinks } = buildFamilyLinks(controlNodes);
      nodes.push(...hubs, ...controlNodes);
      links.push(...familyLinks);
    }

    const meta: ViewerMeta = {
      session_id: dagData?.meta.session_id ?? `dag-${Date.now()}`,
      tenant: dagData?.meta.tenant ?? 'sovereign',
      tool_calls: dagData?.meta.tool_calls ?? 0,
      attestations: dagData?.meta.attestations ?? 0,
      findings: dagData?.meta.findings ?? 0,
      controls_mapped: scanData?.total ?? 0,
      staging_pending: scanData?.staging_pending ?? 0,
      auto_remediated: 0,
      generated: new Date().toISOString(),
      license_tier: 'sovereign',
    };

    return { meta, nodes, links };
  }
}
