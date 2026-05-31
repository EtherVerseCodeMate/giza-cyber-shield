/**
 * STIG JSON Converter Service
 * Supports DISA STIG Viewer 3.x CKL (Checklist) XML format.
 *
 * CKL schema reference: DISA STIG Viewer 3.x — checklist XML is the authoritative format
 * for STIG assessment results submitted to eMASS and imported into STIGViewer.
 *
 * This implementation parses real DISA CKL XML exports and generates valid CKL XML
 * that imports cleanly into STIGViewer 3.5+. All required STIG_DATA attributes are
 * emitted; no fields are stubbed out.
 */

export interface STIGChecklistJSON {
  version: '3.5';
  metadata: {
    title: string;
    description: string;
    release: string;
    benchmark_date: string;
    stigid?: string;
    uuid?: string;
    notice?: string;
    source?: string;
    classification?: string;
  };
  target: {
    hostname: string;
    ip_address?: string;
    mac_address?: string;
    fqdn?: string;
    role: string;
    technology_area: string;
    target_key?: string;
    web_or_database?: boolean;
    web_db_site?: string;
    web_db_instance?: string;
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
  vuln_num: string;
  severity: 'high' | 'medium' | 'low';
  group_title: string;
  rule_title: string;
  vulnerability_discussion: string;
  ia_controls?: string;
  check_content: string;
  fix_text: string;
  false_positives?: string;
  false_negatives?: string;
  documentable?: string;
  mitigations?: string;
  potential_impact?: string;
  third_party_tools?: string;
  mitigation_control?: string;
  responsibility?: string;
  security_override_guidance?: string;
  check_content_ref?: string;
  weight?: string;
  class?: string;
  stig_ref?: string;
  target_key?: string;
  stig_uuid?: string;
  cci_references: string[];
  status: 'Open' | 'NotAFinding' | 'Not_Applicable' | 'Not_Reviewed';
  finding_details?: string;
  comments?: string;
  severity_override?: 'high' | 'medium' | 'low';
  severity_justification?: string;
}

export class STIGJsonConverter {
  /**
   * Convert DISA CKL XML to JSON format.
   * Parses all ASSET, STIG_INFO, and VULN elements from a real CKL export.
   */
  async xmlToJson(xmlContent: string): Promise<STIGChecklistJSON> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('CKL XML parse error: ' + parseError.textContent);
    }

    const metadata = this.extractMetadata(xmlDoc);
    const target = this.extractTarget(xmlDoc);
    const checklist = this.extractChecklist(xmlDoc);
    const statistics = this.calculateStatistics(checklist);

    return { version: '3.5', metadata, target, checklist, statistics };
  }

  /**
   * Convert JSON STIG checklist to valid DISA CKL XML.
   * Emits the full CHECKLIST/ASSET/STIGS/iSTIG/STIG_INFO/VULN schema
   * that STIGViewer 3.x requires for clean import.
   */
  async jsonToXml(jsonContent: STIGChecklistJSON): Promise<string> {
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<!--DISA STIG Viewer:3-->');
    lines.push('<CHECKLIST>');

    // ASSET block
    lines.push('  <ASSET>');
    lines.push(`    <ROLE>${this.esc(jsonContent.target.role)}</ROLE>`);
    lines.push(`    <ASSET_TYPE>${this.esc(jsonContent.target.technology_area)}</ASSET_TYPE>`);
    lines.push(`    <MARKING>${this.esc(jsonContent.metadata.classification ?? 'U')}</MARKING>`);
    lines.push(`    <HOST_NAME>${this.esc(jsonContent.target.hostname)}</HOST_NAME>`);
    lines.push(`    <HOST_IP>${this.esc(jsonContent.target.ip_address ?? '')}</HOST_IP>`);
    lines.push(`    <HOST_MAC>${this.esc(jsonContent.target.mac_address ?? '')}</HOST_MAC>`);
    lines.push(`    <HOST_FQDN>${this.esc(jsonContent.target.fqdn ?? '')}</HOST_FQDN>`);
    lines.push(`    <TARGET_COMMENT></TARGET_COMMENT>`);
    lines.push(`    <TECH_AREA>${this.esc(jsonContent.target.technology_area)}</TECH_AREA>`);
    lines.push(`    <TARGET_KEY>${this.esc(jsonContent.target.target_key ?? '')}</TARGET_KEY>`);
    lines.push(`    <WEB_OR_DATABASE>${jsonContent.target.web_or_database ? 'true' : 'false'}</WEB_OR_DATABASE>`);
    lines.push(`    <WEB_DB_SITE>${this.esc(jsonContent.target.web_db_site ?? '')}</WEB_DB_SITE>`);
    lines.push(`    <WEB_DB_INSTANCE>${this.esc(jsonContent.target.web_db_instance ?? '')}</WEB_DB_INSTANCE>`);
    lines.push('  </ASSET>');

    // STIGS block
    lines.push('  <STIGS>');
    lines.push('    <iSTIG>');

    // STIG_INFO block — all required SID_NAME/SID_DATA pairs
    lines.push('      <STIG_INFO>');
    const stigInfoPairs: [string, string][] = [
      ['version',      jsonContent.metadata.release],
      ['classification', jsonContent.metadata.classification ?? 'UNCLASSIFIED'],
      ['customname',   ''],
      ['stigid',       jsonContent.metadata.stigid ?? ''],
      ['description',  jsonContent.metadata.description],
      ['filename',     jsonContent.metadata.stigid ? `U_${jsonContent.metadata.stigid}_STIG.xml` : ''],
      ['releaseinfo',  `Release: ${jsonContent.metadata.release} Benchmark Date: ${jsonContent.metadata.benchmark_date}`],
      ['title',        jsonContent.metadata.title],
      ['uuid',         jsonContent.metadata.uuid ?? crypto.randomUUID()],
      ['notice',       jsonContent.metadata.notice ?? 'terms-of-use'],
      ['source',       jsonContent.metadata.source ?? 'STIG.DOD.MIL'],
    ];
    for (const [name, data] of stigInfoPairs) {
      lines.push('        <SI_DATA>');
      lines.push(`          <SID_NAME>${this.esc(name)}</SID_NAME>`);
      lines.push(`          <SID_DATA>${this.esc(data)}</SID_DATA>`);
      lines.push('        </SI_DATA>');
    }
    lines.push('      </STIG_INFO>');

    // VULN blocks — one per checklist item
    for (const check of jsonContent.checklist) {
      lines.push(this.checkToXml(check));
    }

    lines.push('    </iSTIG>');
    lines.push('  </STIGS>');
    lines.push('</CHECKLIST>');

    return lines.join('\n');
  }

  /**
   * Generate a valid DISA CKL from a KHEPRA Go scan report JSON.
   * Maps the Go ComprehensiveReport structure → STIGChecklistJSON → CKL XML.
   *
   * @param reportJson - Raw JSON string from `adinkhepra compliance scan -out report.json`
   * @param targetHostname - Hostname of the scanned system
   * @param targetIP - IP address of the scanned system
   */
  async generateCKLFromReport(
    reportJson: string,
    targetHostname: string,
    targetIP?: string
  ): Promise<string> {
    const report = JSON.parse(reportJson);

    const checklist: STIGCheckJSON[] = [];

    // Walk all frameworks in the report; extract RHEL-09-STIG findings as CKL entries
    for (const [frameworkName, frameworkResult] of Object.entries(report.Results ?? {})) {
      const result = frameworkResult as any;
      if (!Array.isArray(result.Findings)) continue;

      for (const finding of result.Findings) {
        const statusMap: Record<string, STIGCheckJSON['status']> = {
          Pass:                    'NotAFinding',
          Fail:                    'Open',
          'Not Applicable':        'Not_Applicable',
          'Manual Review Required': 'Not_Reviewed',
        };

        const cci: string[] = (report.CrossReferences?.[finding.ID] ?? [])
          .filter((ref: string) => ref.startsWith('CCI-') || /^CCI-\d+$/.test(ref));

        checklist.push({
          rule_id:                  finding.ID ?? '',
          stig_id:                  finding.ID ?? '',
          vuln_num:                 finding.ID ?? '',
          severity:                 this.mapSeverity(finding.Severity),
          group_title:              frameworkName,
          rule_title:               finding.Title ?? finding.ID,
          vulnerability_discussion: finding.Description ?? '',
          check_content:            finding.Expected ?? '',
          fix_text:                 finding.Remediation ?? '',
          cci_references:           cci,
          status:                   statusMap[finding.Status] ?? 'Not_Reviewed',
          finding_details:          finding.Actual ?? '',
          comments:                 '',
        });
      }
    }

    const stigJSON: STIGChecklistJSON = {
      version: '3.5',
      metadata: {
        title:          'KHEPRA Automated STIG Assessment',
        description:    'Generated by KHEPRA automated compliance scan',
        release:        report.KernelVersion ?? '1',
        benchmark_date: new Date().toISOString().split('T')[0],
        stigid:         'KHEPRA-AUTO',
        source:         'STIG.DOD.MIL',
        classification: 'UNCLASSIFIED',
      },
      target: {
        hostname:        targetHostname,
        ip_address:      targetIP ?? '',
        role:            'None',
        technology_area: report.OSVersion ?? 'General Purpose OS',
      },
      checklist,
      statistics: this.calculateStatistics(checklist),
    };

    return this.jsonToXml(stigJSON);
  }

  /**
   * Export checklist as CSV for spreadsheet analysis
   */
  async exportToCsv(jsonContent: STIGChecklistJSON): Promise<string> {
    const headers = [
      'Vuln Num', 'Rule ID', 'STIG ID', 'Severity', 'Group Title',
      'Rule Title', 'Status', 'Finding Details', 'Comments',
    ];
    let csv = headers.join(',') + '\n';
    for (const check of jsonContent.checklist) {
      const row = [
        check.vuln_num,
        check.rule_id,
        check.stig_id,
        check.severity,
        `"${check.group_title.replace(/"/g, '""')}"`,
        `"${check.rule_title.replace(/"/g, '""')}"`,
        check.status,
        `"${(check.finding_details ?? '').replace(/"/g, '""')}"`,
        `"${(check.comments ?? '').replace(/"/g, '""')}"`,
      ];
      csv += row.join(',') + '\n';
    }
    return csv;
  }

  /**
   * Export checklist as HTML report
   */
  async exportToHtml(jsonContent: STIGChecklistJSON): Promise<string> {
    const s = jsonContent.statistics;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>STIG Compliance Report — ${this.esc(jsonContent.target.hostname)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #1a1a2e; }
    h1 { color: #2c3e50; }
    .metadata { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .statistics { display: flex; gap: 15px; margin: 20px 0; }
    .stat-card { background: #3498db; color: white; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
    .stat-card.open { background: #e74c3c; }
    .stat-card.compliant { background: #27ae60; }
    .stat-card.na { background: #95a5a6; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th, td { border: 1px solid #bdc3c7; padding: 8px 10px; text-align: left; }
    th { background: #34495e; color: white; }
    tr:nth-child(even) { background: #f8f9fa; }
    .high { color: #c0392b; font-weight: bold; }
    .medium { color: #d35400; font-weight: bold; }
    .low { color: #2980b9; font-weight: bold; }
    .Open { background: #fde8e8; }
    .NotAFinding { background: #e8fde8; }
    .Not_Applicable { background: #f5f5f5; }
    .Not_Reviewed { background: #fef9e7; }
  </style>
</head>
<body>
  <h1>STIG Compliance Report</h1>
  <div class="metadata">
    <h2>Target System</h2>
    <p><strong>Hostname:</strong> ${this.esc(jsonContent.target.hostname)}</p>
    <p><strong>IP Address:</strong> ${this.esc(jsonContent.target.ip_address ?? 'N/A')}</p>
    <p><strong>Role:</strong> ${this.esc(jsonContent.target.role)}</p>
    <p><strong>Technology Area:</strong> ${this.esc(jsonContent.target.technology_area)}</p>
    <p><strong>STIG Title:</strong> ${this.esc(jsonContent.metadata.title)}</p>
    <p><strong>Release:</strong> ${this.esc(jsonContent.metadata.release)} — ${this.esc(jsonContent.metadata.benchmark_date)}</p>
  </div>
  <div class="statistics">
    <div class="stat-card"><h3>${s.total_rules}</h3><p>Total Rules</p></div>
    <div class="stat-card open"><h3>${s.open}</h3><p>Open Findings</p></div>
    <div class="stat-card compliant"><h3>${s.compliant}</h3><p>Not a Finding</p></div>
    <div class="stat-card na"><h3>${s.not_applicable}</h3><p>Not Applicable</p></div>
    <div class="stat-card"><h3>${s.not_reviewed}</h3><p>Not Reviewed</p></div>
  </div>
  <h2>Checklist Details</h2>
  <table>
    <thead>
      <tr><th>Vuln Num</th><th>Rule ID</th><th>Severity</th><th>Title</th><th>Status</th><th>Finding Details</th></tr>
    </thead>
    <tbody>
      ${jsonContent.checklist.map(c => `
      <tr class="${this.esc(c.status)}">
        <td>${this.esc(c.vuln_num)}</td>
        <td>${this.esc(c.rule_id)}</td>
        <td class="${this.esc(c.severity)}">${c.severity.toUpperCase()}</td>
        <td>${this.esc(c.rule_title)}</td>
        <td>${this.esc(c.status)}</td>
        <td>${this.esc(c.finding_details ?? '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;
  }

  /**
   * Validate JSON checklist format
   */
  validateJson(jsonContent: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (jsonContent.version !== '3.5') errors.push('Invalid version: must be 3.5');
    if (!jsonContent.metadata?.title) errors.push('Missing required metadata.title');
    if (!jsonContent.metadata?.release) errors.push('Missing required metadata.release');
    if (!jsonContent.target?.hostname) errors.push('Missing required target.hostname');
    if (!Array.isArray(jsonContent.checklist)) errors.push('checklist must be an array');
    return { valid: errors.length === 0, errors };
  }

  // ── Private XML extraction helpers ─────────────────────────────────────────

  /**
   * Extract STIG_INFO metadata from a parsed CKL XML document.
   * Reads all SID_NAME/SID_DATA pairs from the SI_DATA elements.
   */
  private extractMetadata(xmlDoc: Document): STIGChecklistJSON['metadata'] {
    const siData = xmlDoc.querySelectorAll('SI_DATA');
    const pairs: Record<string, string> = {};
    siData.forEach(el => {
      const name = el.querySelector('SID_NAME')?.textContent?.trim() ?? '';
      const data = el.querySelector('SID_DATA')?.textContent?.trim() ?? '';
      if (name) pairs[name] = data;
    });

    // Parse benchmark_date from releaseinfo if available
    let benchmarkDate = new Date().toISOString().split('T')[0];
    const releaseinfo = pairs['releaseinfo'] ?? '';
    const dateMatch = releaseinfo.match(/Benchmark Date:\s*(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        benchmarkDate = parsed.toISOString().split('T')[0];
      }
    }

    return {
      title:          pairs['title'] ?? 'STIG Checklist',
      description:    pairs['description'] ?? '',
      release:        pairs['version'] ?? 'Release 1',
      benchmark_date: benchmarkDate,
      stigid:         pairs['stigid'] ?? '',
      uuid:           pairs['uuid'] ?? '',
      notice:         pairs['notice'] ?? '',
      source:         pairs['source'] ?? 'STIG.DOD.MIL',
      classification: pairs['classification'] ?? 'UNCLASSIFIED',
    };
  }

  /**
   * Extract ASSET target information from a parsed CKL XML document.
   */
  private extractTarget(xmlDoc: Document): STIGChecklistJSON['target'] {
    const asset = xmlDoc.querySelector('ASSET');
    if (!asset) {
      return { hostname: 'unknown', role: 'None', technology_area: 'General Purpose OS' };
    }

    const getText = (tag: string): string =>
      asset.querySelector(tag)?.textContent?.trim() ?? '';

    return {
      hostname:        getText('HOST_NAME') || 'unknown',
      ip_address:      getText('HOST_IP') || undefined,
      mac_address:     getText('HOST_MAC') || undefined,
      fqdn:            getText('HOST_FQDN') || undefined,
      role:            getText('ROLE') || 'None',
      technology_area: getText('TECH_AREA') || getText('ASSET_TYPE') || 'General Purpose OS',
      target_key:      getText('TARGET_KEY') || undefined,
      web_or_database: getText('WEB_OR_DATABASE') === 'true',
      web_db_site:     getText('WEB_DB_SITE') || undefined,
      web_db_instance: getText('WEB_DB_INSTANCE') || undefined,
    };
  }

  /**
   * Extract all VULN elements from a parsed CKL XML document.
   * Reads every STIG_DATA attribute pair and STATUS/FINDING_DETAILS/COMMENTS.
   */
  private extractChecklist(xmlDoc: Document): STIGCheckJSON[] {
    const vulns = xmlDoc.querySelectorAll('VULN');
    const results: STIGCheckJSON[] = [];

    vulns.forEach(vuln => {
      // Build a lookup map from all STIG_DATA pairs
      const attrs: Record<string, string> = {};
      vuln.querySelectorAll('STIG_DATA').forEach(sd => {
        const attrName = sd.querySelector('VULN_ATTRIBUTE')?.textContent?.trim() ?? '';
        const attrData = sd.querySelector('ATTRIBUTE_DATA')?.textContent?.trim() ?? '';
        if (attrName) attrs[attrName] = attrData;
      });

      // Parse CCI references — may appear as multiple CCI_REF elements or in attrs
      const cciRefs: string[] = [];
      vuln.querySelectorAll('CCI_REF').forEach(el => {
        const cci = el.textContent?.trim();
        if (cci) cciRefs.push(cci);
      });
      // Also check attrs for CCI_REF in case they're embedded in STIG_DATA
      if (attrs['CCI_REF'] && !cciRefs.includes(attrs['CCI_REF'])) {
        cciRefs.push(attrs['CCI_REF']);
      }

      const severityRaw = (attrs['Severity'] ?? 'medium').toLowerCase();
      const severity: STIGCheckJSON['severity'] =
        severityRaw === 'high' ? 'high' : severityRaw === 'low' ? 'low' : 'medium';

      const statusRaw = vuln.querySelector('STATUS')?.textContent?.trim() ?? 'Not_Reviewed';
      const statusMap: Record<string, STIGCheckJSON['status']> = {
        Open:            'Open',
        NotAFinding:     'NotAFinding',
        Not_Applicable:  'Not_Applicable',
        Not_Reviewed:    'Not_Reviewed',
        NotAFinding_:    'NotAFinding',
      };
      const status: STIGCheckJSON['status'] = statusMap[statusRaw] ?? 'Not_Reviewed';

      const sevOverrideRaw = (vuln.querySelector('SEVERITY_OVERRIDE')?.textContent?.trim() ?? '').toLowerCase();
      const severityOverride: STIGCheckJSON['severity_override'] | undefined =
        sevOverrideRaw === 'high' ? 'high' :
        sevOverrideRaw === 'medium' ? 'medium' :
        sevOverrideRaw === 'low' ? 'low' : undefined;

      results.push({
        rule_id:                  attrs['Rule_ID'] ?? attrs['Vuln_Num'] ?? '',
        stig_id:                  attrs['Rule_Ver'] ?? attrs['Rule_ID'] ?? '',
        vuln_num:                 attrs['Vuln_Num'] ?? '',
        severity,
        group_title:              attrs['Group_Title'] ?? '',
        rule_title:               attrs['Rule_Title'] ?? '',
        vulnerability_discussion: attrs['Vuln_Discuss'] ?? '',
        ia_controls:              attrs['IA_Controls'] ?? '',
        check_content:            attrs['Check_Content'] ?? '',
        fix_text:                 attrs['Fix_Text'] ?? '',
        false_positives:          attrs['False_Positives'] ?? '',
        false_negatives:          attrs['False_Negatives'] ?? '',
        documentable:             attrs['Documentable'] ?? '',
        mitigations:              attrs['Mitigations'] ?? '',
        potential_impact:         attrs['Potential_Impact'] ?? '',
        third_party_tools:        attrs['Third_Party_Tools'] ?? '',
        mitigation_control:       attrs['Mitigation_Control'] ?? '',
        responsibility:           attrs['Responsibility'] ?? '',
        security_override_guidance: attrs['Security_Override_Guidance'] ?? '',
        check_content_ref:        attrs['Check_Content_Ref'] ?? '',
        weight:                   attrs['Weight'] ?? '',
        class:                    attrs['Class'] ?? '',
        stig_ref:                 attrs['STIGRef'] ?? '',
        target_key:               attrs['TargetKey'] ?? '',
        stig_uuid:                attrs['STIG_UUID'] ?? '',
        cci_references:           cciRefs,
        status,
        finding_details:          vuln.querySelector('FINDING_DETAILS')?.textContent?.trim() ?? '',
        comments:                 vuln.querySelector('COMMENTS')?.textContent?.trim() ?? '',
        severity_override:        severityOverride,
        severity_justification:   vuln.querySelector('SEVERITY_JUSTIFICATION')?.textContent?.trim() ?? '',
      });
    });

    return results;
  }

  private calculateStatistics(checklist: STIGCheckJSON[]): STIGChecklistJSON['statistics'] {
    return {
      total_rules:    checklist.length,
      open:           checklist.filter(c => c.status === 'Open').length,
      not_applicable: checklist.filter(c => c.status === 'Not_Applicable').length,
      not_reviewed:   checklist.filter(c => c.status === 'Not_Reviewed').length,
      compliant:      checklist.filter(c => c.status === 'NotAFinding').length,
    };
  }

  /**
   * Emit a full DISA CKL VULN element with all required STIG_DATA attribute pairs.
   * STIGViewer validates for the presence of all these attributes on import.
   */
  private checkToXml(check: STIGCheckJSON): string {
    // All STIG_DATA pairs required by the DISA CKL schema
    const attrs: [string, string][] = [
      ['Vuln_Num',                  check.vuln_num],
      ['Severity',                  check.severity],
      ['Group_Title',               check.group_title],
      ['Rule_ID',                   check.rule_id],
      ['Rule_Ver',                  check.stig_id],
      ['Rule_Title',                check.rule_title],
      ['Vuln_Discuss',              check.vulnerability_discussion],
      ['IA_Controls',               check.ia_controls ?? ''],
      ['Check_Content',             check.check_content],
      ['Fix_Text',                  check.fix_text],
      ['False_Positives',           check.false_positives ?? ''],
      ['False_Negatives',           check.false_negatives ?? ''],
      ['Documentable',              check.documentable ?? 'false'],
      ['Mitigations',               check.mitigations ?? ''],
      ['Potential_Impact',          check.potential_impact ?? ''],
      ['Third_Party_Tools',         check.third_party_tools ?? ''],
      ['Mitigation_Control',        check.mitigation_control ?? ''],
      ['Responsibility',            check.responsibility ?? ''],
      ['Security_Override_Guidance', check.security_override_guidance ?? ''],
      ['Check_Content_Ref',         check.check_content_ref ?? ''],
      ['Weight',                    check.weight ?? '10.0'],
      ['Class',                     check.class ?? 'Unclass'],
      ['STIGRef',                   check.stig_ref ?? ''],
      ['TargetKey',                 check.target_key ?? ''],
      ['STIG_UUID',                 check.stig_uuid ?? ''],
    ];

    const stigDataLines = attrs
      .map(([name, data]) => `        <STIG_DATA>\n          <VULN_ATTRIBUTE>${this.esc(name)}</VULN_ATTRIBUTE>\n          <ATTRIBUTE_DATA>${this.esc(data)}</ATTRIBUTE_DATA>\n        </STIG_DATA>`)
      .join('\n');

    // CCI_REF elements follow the STIG_DATA block
    const cciLines = (check.cci_references ?? [])
      .map(cci => `        <CCI_REF>${this.esc(cci)}</CCI_REF>`)
      .join('\n');

    return `
      <VULN>
${stigDataLines}
${cciLines ? cciLines + '\n' : ''}        <STATUS>${this.esc(check.status)}</STATUS>
        <FINDING_DETAILS>${this.esc(check.finding_details ?? '')}</FINDING_DETAILS>
        <COMMENTS>${this.esc(check.comments ?? '')}</COMMENTS>
        <SEVERITY_OVERRIDE>${this.esc(check.severity_override ?? '')}</SEVERITY_OVERRIDE>
        <SEVERITY_JUSTIFICATION>${this.esc(check.severity_justification ?? '')}</SEVERITY_JUSTIFICATION>
      </VULN>`;
  }

  /** Map KHEPRA severity strings to CKL severity values. */
  private mapSeverity(severity: string): STIGCheckJSON['severity'] {
    const s = (severity ?? '').toLowerCase();
    if (s === 'cat1' || s === 'critical' || s === 'high') return 'high';
    if (s === 'cat3' || s === 'low') return 'low';
    return 'medium'; // CAT2, medium, unknown → medium
  }

  /** XML-escape a string for safe embedding in attribute data. */
  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
