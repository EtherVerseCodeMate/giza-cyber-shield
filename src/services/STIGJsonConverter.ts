/**
 * STIG JSON Converter Service
 * Supports STIG Viewer 3.5+ JSON format for modern checklist management
 * Converts between XML and JSON formats for better integration
 */

export interface STIGChecklistJSON {
  version: '3.5';
  metadata: {
    title: string;
    description: string;
    release: string;
    benchmark_date: string;
  };
  target: {
    hostname: string;
    ip_address?: string;
    mac_address?: string;
    fqdn?: string;
    role: string;
    technology_area: string;
  };
  checklist: STIGCheckJSON[];
  statistics: {
    total_rules: number;
    open: number;
    not_applicable: number;
    not_reviewed: number;
    compliant: number;
  };
}

export interface STIGCheckJSON {
  rule_id: string;
  stig_id: string;
  severity: 'high' | 'medium' | 'low';
  group_title: string;
  rule_title: string;
  vulnerability_discussion: string;
  check_content: string;
  fix_text: string;
  cci_references: string[];
  status: 'Open' | 'NotAFinding' | 'Not_Applicable' | 'Not_Reviewed';
  finding_details?: string;
  comments?: string;
  severity_override?: 'high' | 'medium' | 'low';
  severity_justification?: string;
}

export interface STIGChecklistXML {
  // Legacy XML structure
  xml: string;
}

export class STIGJsonConverter {
  /**
   * Convert XML STIG checklist to JSON format
   */
  async xmlToJson(xmlContent: string): Promise<STIGChecklistJSON> {
    // Parse XML (simplified - in production use a proper XML parser)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Extract metadata
    const metadata = this.extractMetadata(xmlDoc);
    const target = this.extractTarget(xmlDoc);
    const checklist = this.extractChecklist(xmlDoc);

    // Calculate statistics
    const statistics = this.calculateStatistics(checklist);

    return {
      version: '3.5',
      metadata,
      target,
      checklist,
      statistics,
    };
  }

  /**
   * Convert JSON STIG checklist to XML format
   */
  async jsonToXml(jsonContent: STIGChecklistJSON): Promise<string> {
    const { hostname, ip_address, mac_address, fqdn, role, technology_area } =
      jsonContent.target;

    // Derive STIG ID from title (spaces → underscores)
    const stigid = jsonContent.metadata.title.replace(/\s+/g, '_');
    const filename = `U_${stigid}_STIG.zip`;
    const releaseinfo = `Release: ${jsonContent.metadata.release} Benchmark Date: ${jsonContent.metadata.benchmark_date}`;
    // Placeholder UUID (not crypto-random, but sufficient for CKL format)
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<CHECKLIST>\n';

    // ASSET section — all fields required by STIGViewer 3.5+
    xml += '  <ASSET>\n';
    xml += `    <ROLE>${this.escapeXml(role)}</ROLE>\n`;
    xml += `    <ASSET_TYPE>${this.escapeXml(technology_area)}</ASSET_TYPE>\n`;
    xml += `    <HOST_NAME>${this.escapeXml(hostname)}</HOST_NAME>\n`;
    xml += `    <HOST_IP>${this.escapeXml(ip_address || '')}</HOST_IP>\n`;
    xml += `    <HOST_MAC>${this.escapeXml(mac_address || '')}</HOST_MAC>\n`;
    xml += `    <HOST_FQDN>${this.escapeXml(fqdn || '')}</HOST_FQDN>\n`;
    xml += '    <TECH_AREA></TECH_AREA>\n';
    xml += '    <TARGET_KEY>0</TARGET_KEY>\n';
    xml += '    <WEB_OR_DATABASE>false</WEB_OR_DATABASE>\n';
    xml += '    <WEB_DB_SITE></WEB_DB_SITE>\n';
    xml += '    <WEB_DB_INSTANCE></WEB_DB_INSTANCE>\n';
    xml += '  </ASSET>\n';

    // STIGS / iSTIG section
    xml += '  <STIGS>\n';
    xml += '    <iSTIG>\n';

    // STIG_INFO — 11 SI_DATA elements
    xml += '      <STIG_INFO>\n';
    const siData: Array<[string, string]> = [
      ['version', jsonContent.metadata.release.replace(/\D/g, '') || '1'],
      ['classification', 'UNCLASSIFIED'],
      ['customname', ''],
      ['stigid', stigid],
      ['description', jsonContent.metadata.description],
      ['filename', filename],
      ['releaseinfo', releaseinfo],
      ['title', jsonContent.metadata.title],
      ['uuid', uuid],
      ['notice', 'terms-of-use'],
      ['source', 'STIG.DOD.MIL'],
    ];
    for (const [name, data] of siData) {
      xml += '        <SI_DATA>\n';
      xml += `          <SID_NAME>${this.escapeXml(name)}</SID_NAME>\n`;
      xml += `          <SID_DATA>${this.escapeXml(data)}</SID_DATA>\n`;
      xml += '        </SI_DATA>\n';
    }
    xml += '      </STIG_INFO>\n';

    // Add vulnerabilities
    for (const check of jsonContent.checklist) {
      xml += this.checkToXml(check);
    }

    xml += '    </iSTIG>\n';
    xml += '  </STIGS>\n';
    xml += '</CHECKLIST>';

    return xml;
  }

  /**
   * Export checklist as CSV for spreadsheet analysis
   */
  async exportToCsv(jsonContent: STIGChecklistJSON): Promise<string> {
    const headers = [
      'Rule ID',
      'STIG ID',
      'Severity',
      'Title',
      'Status',
      'Finding Details',
      'Comments',
    ];

    let csv = headers.join(',') + '\n';

    for (const check of jsonContent.checklist) {
      const row = [
        check.rule_id,
        check.stig_id,
        check.severity,
        `"${check.rule_title.replace(/"/g, '""')}"`,
        check.status,
        `"${(check.finding_details || '').replace(/"/g, '""')}"`,
        `"${(check.comments || '').replace(/"/g, '""')}"`,
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Export checklist as HTML report
   */
  async exportToHtml(jsonContent: STIGChecklistJSON): Promise<string> {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>STIG Compliance Report - ${jsonContent.target.hostname}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #2c3e50; }
    .metadata { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .statistics { display: flex; gap: 15px; margin: 20px 0; }
    .stat-card { background: #3498db; color: white; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
    .stat-card.open { background: #e74c3c; }
    .stat-card.compliant { background: #27ae60; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #bdc3c7; padding: 10px; text-align: left; }
    th { background: #34495e; color: white; }
    .high { color: #e74c3c; font-weight: bold; }
    .medium { color: #f39c12; font-weight: bold; }
    .low { color: #3498db; font-weight: bold; }
  </style>
</head>
<body>
  <h1>STIG Compliance Report</h1>
  
  <div class="metadata">
    <h2>Target System</h2>
    <p><strong>Hostname:</strong> ${jsonContent.target.hostname}</p>
    <p><strong>IP Address:</strong> ${jsonContent.target.ip_address || 'N/A'}</p>
    <p><strong>Role:</strong> ${jsonContent.target.role}</p>
    <p><strong>Technology Area:</strong> ${jsonContent.target.technology_area}</p>
  </div>

  <div class="statistics">
    <div class="stat-card">
      <h3>${jsonContent.statistics.total_rules}</h3>
      <p>Total Rules</p>
    </div>
    <div class="stat-card open">
      <h3>${jsonContent.statistics.open}</h3>
      <p>Open Findings</p>
    </div>
    <div class="stat-card compliant">
      <h3>${jsonContent.statistics.compliant}</h3>
      <p>Compliant</p>
    </div>
    <div class="stat-card">
      <h3>${jsonContent.statistics.not_applicable}</h3>
      <p>Not Applicable</p>
    </div>
  </div>

  <h2>Checklist Details</h2>
  <table>
    <thead>
      <tr>
        <th>Rule ID</th>
        <th>STIG ID</th>
        <th>Severity</th>
        <th>Title</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>`;

    for (const check of jsonContent.checklist) {
      html += `
      <tr>
        <td>${check.rule_id}</td>
        <td>${check.stig_id}</td>
        <td class="${check.severity}">${check.severity.toUpperCase()}</td>
        <td>${check.rule_title}</td>
        <td>${check.status}</td>
      </tr>`;
    }

    html += `
    </tbody>
  </table>
</body>
</html>`;

    return html;
  }

  /**
   * Validate JSON checklist format
   */
  validateJson(jsonContent: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (jsonContent.version !== '3.5') {
      errors.push('Invalid version: must be 3.5');
    }

    if (!jsonContent.metadata || !jsonContent.metadata.title) {
      errors.push('Missing required metadata');
    }

    if (!jsonContent.target || !jsonContent.target.hostname) {
      errors.push('Missing required target information');
    }

    if (!Array.isArray(jsonContent.checklist)) {
      errors.push('Checklist must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Helper methods

  /**
   * Escape special XML characters in a string value.
   */
  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private extractMetadata(xmlDoc: Document): STIGChecklistJSON['metadata'] {
    const getSIData = (name: string): string => {
      const nodes = xmlDoc.querySelectorAll('SI_DATA');
      for (let i = 0; i < nodes.length; i++) {
        const nameEl = nodes[i].querySelector('SID_NAME');
        const dataEl = nodes[i].querySelector('SID_DATA');
        if (nameEl?.textContent === name && dataEl) {
          return dataEl.textContent || '';
        }
      }
      return '';
    };
    return {
      title: getSIData('title') || 'STIG Checklist',
      description: getSIData('description') || 'Automated STIG Compliance Checklist',
      release: getSIData('releaseinfo') || 'Release 1',
      benchmark_date: new Date().toISOString().split('T')[0],
    };
  }

  private extractTarget(xmlDoc: Document): STIGChecklistJSON['target'] {
    const getAssetField = (tag: string): string => {
      return xmlDoc.querySelector(tag)?.textContent || '';
    };
    return {
      hostname: getAssetField('HOST_NAME') || 'unknown',
      ip_address: getAssetField('HOST_IP') || undefined,
      mac_address: getAssetField('HOST_MAC') || undefined,
      fqdn: getAssetField('HOST_FQDN') || undefined,
      role: getAssetField('ROLE') || 'None',
      technology_area: getAssetField('ASSET_TYPE') || 'General',
    };
  }

  private extractChecklist(xmlDoc: Document): STIGCheckJSON[] {
    const vulns = xmlDoc.querySelectorAll('VULN');
    const checks: STIGCheckJSON[] = [];

    vulns.forEach(vuln => {
      const getStigData = (attr: string): string => {
        const nodes = vuln.querySelectorAll('STIG_DATA');
        for (let i = 0; i < nodes.length; i++) {
          const attrEl = nodes[i].querySelector('VULN_ATTRIBUTE');
          const dataEl = nodes[i].querySelector('ATTRIBUTE_DATA');
          if (attrEl?.textContent === attr && dataEl) {
            return dataEl.textContent || '';
          }
        }
        return '';
      };

      const rawStatus = vuln.querySelector('STATUS')?.textContent || 'Not_Reviewed';
      const validStatuses = ['Open', 'NotAFinding', 'Not_Applicable', 'Not_Reviewed'];
      const status = validStatuses.includes(rawStatus)
        ? (rawStatus as STIGCheckJSON['status'])
        : 'Not_Reviewed';

      const rawSeverity = getStigData('Severity').toLowerCase();
      const severity = (['high', 'medium', 'low'].includes(rawSeverity)
        ? rawSeverity
        : 'medium') as STIGCheckJSON['severity'];

      checks.push({
        rule_id: getStigData('Vuln_Num'),
        stig_id: getStigData('Rule_ID') || getStigData('Rule_Ver'),
        severity,
        group_title: getStigData('Group_Title'),
        rule_title: getStigData('Rule_Title'),
        vulnerability_discussion: getStigData('Vuln_Discuss'),
        check_content: getStigData('Check_Content'),
        fix_text: getStigData('Fix_Text'),
        cci_references: getStigData('CCI_REF') ? [getStigData('CCI_REF')] : [],
        status,
        finding_details: vuln.querySelector('FINDING_DETAILS')?.textContent || undefined,
        comments: vuln.querySelector('COMMENTS')?.textContent || undefined,
      });
    });

    return checks;
  }

  private calculateStatistics(
    checklist: STIGCheckJSON[]
  ): STIGChecklistJSON['statistics'] {
    return {
      total_rules: checklist.length,
      open: checklist.filter(c => c.status === 'Open').length,
      not_applicable: checklist.filter(c => c.status === 'Not_Applicable')
        .length,
      not_reviewed: checklist.filter(c => c.status === 'Not_Reviewed').length,
      compliant: checklist.filter(c => c.status === 'NotAFinding').length,
    };
  }

  private checkToXml(check: STIGCheckJSON): string {
    // Build STIGRef from stig_id
    const stigRef = `${check.stig_id} :: Version 1, Release 1`;

    const stigData: Array<[string, string]> = [
      ['Vuln_Num', check.rule_id],
      ['Severity', check.severity],
      ['Group_Title', check.group_title || ''],
      ['Rule_ID', check.stig_id],
      ['Rule_Ver', check.stig_id],
      ['Rule_Title', check.rule_title],
      ['Vuln_Discuss', check.vulnerability_discussion || ''],
      ['IA_Controls', ''],
      ['Check_Content', check.check_content || ''],
      ['Fix_Text', check.fix_text || ''],
      ['False_Positives', ''],
      ['False_Negatives', ''],
      ['Documentable', 'false'],
      ['Mitigations', ''],
      ['Potential_Impact', ''],
      ['Third_Party_Tools', ''],
      ['Mitigation_Control', ''],
      ['Responsibility', 'Information Assurance Officer'],
      ['Security_Override_Guidance', ''],
      ['Check_Content_Ref', 'M'],
      ['Weight', '10.0'],
      ['Class', 'Unclass'],
      ['STIGRef', stigRef],
      ['TargetKey', '0'],
      ['STIG_UUID', ''],
      ['LEGACY_ID', ''],
      ['CCI_REF', (check.cci_references && check.cci_references[0]) ? check.cci_references[0] : ''],
    ];

    let xml = '\n      <VULN>\n';
    for (const [attr, data] of stigData) {
      xml += '        <STIG_DATA>\n';
      xml += `          <VULN_ATTRIBUTE>${this.escapeXml(attr)}</VULN_ATTRIBUTE>\n`;
      xml += `          <ATTRIBUTE_DATA>${this.escapeXml(data)}</ATTRIBUTE_DATA>\n`;
      xml += '        </STIG_DATA>\n';
    }
    xml += `        <STATUS>${this.escapeXml(check.status)}</STATUS>\n`;
    xml += `        <FINDING_DETAILS>${this.escapeXml(check.finding_details || '')}</FINDING_DETAILS>\n`;
    xml += `        <COMMENTS>${this.escapeXml(check.comments || '')}</COMMENTS>\n`;
    xml += `        <SEVERITY_OVERRIDE>${this.escapeXml(check.severity_override || '')}</SEVERITY_OVERRIDE>\n`;
    xml += `        <SEVERITY_JUSTIFICATION>${this.escapeXml(check.severity_justification || '')}</SEVERITY_JUSTIFICATION>\n`;
    xml += '      </VULN>';

    return xml;
  }
}
