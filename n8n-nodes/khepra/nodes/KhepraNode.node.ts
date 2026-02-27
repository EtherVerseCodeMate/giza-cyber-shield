import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class KhepraNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Khepra Cyber Shield',
    name: 'khepra',
    // icon: 'file:khepra.svg',
    group: ['security'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description:
      'Interact with Khepra Cyber Shield — PQC-secured AI security platform. ' +
      'Ask security questions in plain English, run compliance scans, hunt threats, ' +
      'and export C3PAO attestation packages.',
    defaults: { name: 'Khepra Cyber Shield' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'khepraApi', required: true }],
    properties: [
      // ── Operation ────────────────────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Ask Security Question (NL)',
            value: 'ask',
            description: 'Natural language security query — "Is my network compromised?"',
            action: 'Ask a natural language security question',
          },
          {
            name: 'Get Security Dashboard',
            value: 'dashboard',
            description: 'Get overall security risk posture',
            action: 'Get security dashboard',
          },
          {
            name: 'Get Active Alerts',
            value: 'alerts',
            description: 'Retrieve IDS/IPS alerts at a given severity',
            action: 'Get active security alerts',
          },
          {
            name: 'Get Security Timeline',
            value: 'timeline',
            description: 'Get security event timeline for the last N hours',
            action: 'Get security event timeline',
          },
          {
            name: 'Run Compliance Scan',
            value: 'complianceScan',
            description: 'Trigger a CMMC/STIG compliance scan',
            action: 'Run compliance scan',
          },
          {
            name: 'Get Compliance Score',
            value: 'complianceScore',
            description: 'Get compliance score for an organization',
            action: 'Get compliance score',
          },
          {
            name: 'Export Attestation Package',
            value: 'attest',
            description: 'Export a PQC-signed C3PAO evidence package',
            action: 'Export attestation package',
          },
          {
            name: 'Declare Incident',
            value: 'incident',
            description: 'Declare a security incident (NIST 800-61)',
            action: 'Declare security incident',
          },
          {
            name: 'Execute MCP Tool',
            value: 'tool',
            description: 'Execute any of the 32 Khepra MCP security tools directly',
            action: 'Execute MCP tool',
          },
        ],
        default: 'ask',
      },

      // ── ask ──────────────────────────────────────────────────────────────────
      {
        displayName: 'Security Question',
        name: 'query',
        type: 'string',
        typeOptions: { rows: 3 },
        displayOptions: { show: { operation: ['ask'] } },
        default: '',
        placeholder: 'Is my network compromised? What happened at 3am?',
        description: 'Plain English security question — the AI will run the right tools and synthesize an answer',
        required: true,
      },
      {
        displayName: 'Context',
        name: 'queryContext',
        type: 'json',
        displayOptions: { show: { operation: ['ask'] } },
        default: '{"org_id": ""}',
        description: 'Optional context as JSON (org_id, asset_id, etc.)',
      },
      {
        displayName: 'Max Tools to Run',
        name: 'maxTools',
        type: 'number',
        displayOptions: { show: { operation: ['ask'] } },
        default: 5,
        description: 'Maximum number of security tools to chain together',
      },

      // ── alerts ────────────────────────────────────────────────────────────────
      {
        displayName: 'Minimum Severity',
        name: 'severity',
        type: 'options',
        displayOptions: { show: { operation: ['alerts'] } },
        options: [
          { name: 'Critical', value: 'CRITICAL' },
          { name: 'High', value: 'HIGH' },
          { name: 'Medium', value: 'MEDIUM' },
          { name: 'Low', value: 'LOW' },
        ],
        default: 'HIGH',
      },

      // ── timeline ──────────────────────────────────────────────────────────────
      {
        displayName: 'Lookback Hours',
        name: 'hours',
        type: 'number',
        displayOptions: { show: { operation: ['timeline'] } },
        default: 24,
        description: 'How many hours of history to return',
      },

      // ── complianceScore / complianceScan ──────────────────────────────────────
      {
        displayName: 'Organization ID',
        name: 'orgId',
        type: 'string',
        displayOptions: { show: { operation: ['complianceScore', 'complianceScan', 'attest'] } },
        default: '',
        description: 'Organization identifier',
        required: true,
      },
      {
        displayName: 'Framework',
        name: 'framework',
        type: 'options',
        displayOptions: { show: { operation: ['complianceScore', 'complianceScan'] } },
        options: [
          { name: 'CMMC Level 2', value: 'CMMC_L2' },
          { name: 'CMMC Level 3', value: 'CMMC_L3' },
          { name: 'NIST 800-171', value: 'NIST_800_171' },
          { name: 'NIST 800-53', value: 'NIST_800_53' },
          { name: 'STIG', value: 'STIG' },
        ],
        default: 'CMMC_L2',
      },

      // ── incident ──────────────────────────────────────────────────────────────
      {
        displayName: 'Incident Description',
        name: 'incidentDesc',
        type: 'string',
        typeOptions: { rows: 2 },
        displayOptions: { show: { operation: ['incident'] } },
        default: '',
        required: true,
      },
      {
        displayName: 'Severity',
        name: 'incidentSeverity',
        type: 'options',
        displayOptions: { show: { operation: ['incident'] } },
        options: [
          { name: 'Critical', value: 'CRITICAL' },
          { name: 'High', value: 'HIGH' },
          { name: 'Medium', value: 'MEDIUM' },
          { name: 'Low', value: 'LOW' },
        ],
        default: 'HIGH',
      },

      // ── tool (raw MCP) ────────────────────────────────────────────────────────
      {
        displayName: 'Tool Name',
        name: 'toolName',
        type: 'string',
        displayOptions: { show: { operation: ['tool'] } },
        default: '',
        placeholder: 'khepra_hunt_threats',
        description: 'Any of the 32 Khepra MCP tool names',
        required: true,
      },
      {
        displayName: 'Tool Arguments',
        name: 'toolArgs',
        type: 'json',
        displayOptions: { show: { operation: ['tool'] } },
        default: '{}',
        description: 'Tool parameters as JSON',
      },

      // ── Dashboard options ─────────────────────────────────────────────────────
      {
        displayName: 'Organization ID',
        name: 'dashOrgId',
        type: 'string',
        displayOptions: { show: { operation: ['dashboard'] } },
        default: 'default',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('khepraApi');

    const apiUrl = (credentials.apiUrl as string).replace(/\/$/, '');
    const token = credentials.token as string;
    const authMethod = credentials.authMethod as string;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authMethod === 'pqcToken') {
      headers['X-Khepra-PQC-Token'] = token;
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      let responseData: Record<string, unknown>;

      try {
        if (operation === 'ask') {
          const query = this.getNodeParameter('query', i) as string;
          const maxTools = this.getNodeParameter('maxTools', i) as number;
          const contextRaw = this.getNodeParameter('queryContext', i) as string;
          let context: Record<string, string> = {};
          try {
            context = JSON.parse(contextRaw);
          } catch {}

          const response = await this.helpers.request({
            method: 'POST',
            url: `${apiUrl}/api/v1/mcp/ask`,
            headers,
            body: JSON.stringify({ query, context, max_tools: maxTools }),
          });
          responseData = JSON.parse(response);

        } else if (operation === 'dashboard') {
          const orgId = this.getNodeParameter('dashOrgId', i) as string;
          const response = await this.helpers.request({
            method: 'GET',
            url: `${apiUrl}/api/v1/mcp/dashboard?org_id=${orgId}`,
            headers,
          });
          responseData = JSON.parse(response);

        } else if (operation === 'alerts') {
          const severity = this.getNodeParameter('severity', i) as string;
          const response = await this.helpers.request({
            method: 'GET',
            url: `${apiUrl}/api/v1/mcp/alerts?severity=${severity}`,
            headers,
          });
          responseData = JSON.parse(response);

        } else if (operation === 'timeline') {
          const hours = this.getNodeParameter('hours', i) as number;
          const response = await this.helpers.request({
            method: 'GET',
            url: `${apiUrl}/api/v1/mcp/timeline?hours=${hours}`,
            headers,
          });
          responseData = JSON.parse(response);

        } else if (operation === 'complianceScore') {
          const orgId = this.getNodeParameter('orgId', i) as string;
          const framework = this.getNodeParameter('framework', i) as string;
          const response = await this.helpers.request({
            method: 'GET',
            url: `${apiUrl}/api/v1/mcp/compliance/${orgId}?framework=${framework}`,
            headers,
          });
          responseData = JSON.parse(response);

        } else if (operation === 'complianceScan') {
          const orgId = this.getNodeParameter('orgId', i) as string;
          const framework = this.getNodeParameter('framework', i) as string;
          const response = await this.helpers.request({
            method: 'POST',
            url: `${apiUrl}/api/v1/mcp/tool`,
            headers,
            body: JSON.stringify({
              tool_name: 'khepra_run_compliance_scan',
              arguments: { org_id: orgId, framework },
            }),
          });
          responseData = JSON.parse(response);

        } else if (operation === 'attest') {
          const orgId = this.getNodeParameter('orgId', i) as string;
          const response = await this.helpers.request({
            method: 'POST',
            url: `${apiUrl}/api/v1/mcp/tool`,
            headers,
            body: JSON.stringify({
              tool_name: 'khepra_export_attestation',
              arguments: { org_id: orgId },
            }),
          });
          responseData = JSON.parse(response);

        } else if (operation === 'incident') {
          const description = this.getNodeParameter('incidentDesc', i) as string;
          const severity = this.getNodeParameter('incidentSeverity', i) as string;
          const response = await this.helpers.request({
            method: 'POST',
            url: `${apiUrl}/api/v1/mcp/tool`,
            headers,
            body: JSON.stringify({
              tool_name: 'khepra_declare_incident',
              arguments: { description, severity },
            }),
          });
          responseData = JSON.parse(response);

        } else if (operation === 'tool') {
          const toolName = this.getNodeParameter('toolName', i) as string;
          const toolArgsRaw = this.getNodeParameter('toolArgs', i) as string;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(toolArgsRaw);
          } catch {}
          const response = await this.helpers.request({
            method: 'POST',
            url: `${apiUrl}/api/v1/mcp/tool`,
            headers,
            body: JSON.stringify({ tool_name: toolName, arguments: toolArgs }),
          });
          responseData = JSON.parse(response);

        } else {
          throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
        }

        returnData.push({ json: responseData });

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error instanceof Error ? error.message : String(error) },
          });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  }
}
