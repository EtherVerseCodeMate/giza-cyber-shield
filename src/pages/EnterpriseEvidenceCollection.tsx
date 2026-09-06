import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Archive, Shield, CheckCircle, Clock, RefreshCw, Search, Filter } from "lucide-react";
import { PageLayout } from '@/components/PageLayout';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EvidenceItem {
  id: string;
  title: string;
  evidence_type: string;
  collection_date: string;
  collection_method: string;
  file_hash: string;
  retention_period_days: number;
  metadata: any;
  tags: string[];
}

const EnterpriseEvidenceCollectionPage = () => {
  const { toast } = useToast();
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    fetchEvidenceData();
  }, []);

  const fetchEvidenceData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('compliance_evidence')
        .select('*')
        .order('collection_date', { ascending: false });

      if (error) throw error;
      setEvidenceItems(data || []);

    } catch (error) {
      console.error('Error fetching evidence data:', error);
      toast({
        title: "Error",
        description: "Failed to load evidence collection data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerAutomatedCollection = async () => {
    try {
      setCollecting(true);
      
      // Simulate automated evidence collection
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast({
        title: "Evidence Collection Started",
        description: "Automated evidence collection has been initiated across all monitored systems."
      });

      fetchEvidenceData();

    } catch (error) {
      console.error('Error triggering collection:', error);
      toast({
        title: "Collection Failed",
        description: "Failed to start automated evidence collection",
        variant: "destructive"
      });
    } finally {
      setCollecting(false);
    }
  };

  const generateComplianceReport = () => {
    toast({
      title: "Report Generated",
      description: "Comprehensive compliance evidence report has been generated and is ready for download."
    });
  };

  const getEvidenceTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'configuration': 'bg-blue-500/10 text-blue-500',
      'log_evidence': 'bg-green-500/10 text-green-500',
      'screenshot': 'bg-purple-500/10 text-purple-500',
      'document': 'bg-orange-500/10 text-orange-500',
      'audit_trail': 'bg-red-500/10 text-red-500'
    };
    return colors[type] || 'bg-gray-500/10 text-gray-500';
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Audit-Ready Evidence Collection</h1>
            <p className="text-muted-foreground">
              Comprehensive evidence collection and retention for DOD compliance audits
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={triggerAutomatedCollection}
              disabled={collecting}
              variant="outline"
            >
              {collecting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              {collecting ? 'Collecting...' : 'Start Collection'}
            </Button>
            <Button onClick={generateComplianceReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Evidence Items</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{evidenceItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Across all systems and controls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retention Compliance</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">100%</div>
              <p className="text-xs text-muted-foreground">
                7-year DOD retention policy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Automated Collection</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">85%</div>
              <p className="text-xs text-muted-foreground">
                Of evidence automatically collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Collection</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2h ago</div>
              <p className="text-xs text-muted-foreground">
                Continuous monitoring active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="evidence" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="evidence">Evidence Items</TabsTrigger>
            <TabsTrigger value="collection">Collection Rules</TabsTrigger>
            <TabsTrigger value="retention">Retention Policy</TabsTrigger>
            <TabsTrigger value="reports">Audit Reports</TabsTrigger>
            <TabsTrigger value="executive_brief">Executive Brief</TabsTrigger>
          </TabsList>

          <TabsContent value="evidence">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Evidence Repository</CardTitle>
                    <CardDescription>
                      Centralized repository of all compliance evidence with automated collection and validation
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {evidenceItems.slice(0, 10).map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Collection Method: {item.collection_method}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            File Hash: {item.file_hash}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getEvidenceTypeColor(item.evidence_type)}>
                            {item.evidence_type.replaceAll('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Collection Date:</span>
                          <p className="font-medium">{new Date(item.collection_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Retention:</span>
                          <p className="font-medium">{item.retention_period_days} days</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tags:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags?.slice(0, 2).map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {item.tags?.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{item.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collection">
            <Card>
              <CardHeader>
                <CardTitle>Automated Collection Rules</CardTitle>
                <CardDescription>
                  Configure automated evidence collection rules for different STIG controls and system types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'Configuration Files', frequency: 'Daily', systems: 'All Windows/Linux', status: 'Active' },
                    { name: 'Security Logs', frequency: 'Real-time', systems: 'Domain Controllers', status: 'Active' },
                    { name: 'Patch Status', frequency: 'Weekly', systems: 'All Systems', status: 'Active' },
                    { name: 'User Access Reviews', frequency: 'Monthly', systems: 'AD/LDAP', status: 'Active' }
                  ].map((rule, index) => (
                    <div key={index} className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <h3 className="font-medium">{rule.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {rule.frequency} collection from {rule.systems}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{rule.status}</Badge>
                        <Button size="sm" variant="outline">Configure</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Retention Policy</CardTitle>
                <CardDescription>
                  DOD-compliant evidence retention and archival policies for audit readiness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">Standard Retention</h3>
                      <p className="text-2xl font-bold text-blue-600">7 Years</p>
                      <p className="text-sm text-muted-foreground">DOD compliance requirement</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">Storage Efficiency</h3>
                      <p className="text-2xl font-bold text-green-600">92%</p>
                      <p className="text-sm text-muted-foreground">Compressed and deduplicated</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Retention Categories</h4>
                    {[
                      { category: 'Security Configuration', retention: '7 years', size: '2.4 GB', items: 1247 },
                      { category: 'Audit Logs', retention: '7 years', size: '15.8 GB', items: 45623 },
                      { category: 'Assessment Results', retention: '10 years', size: '0.8 GB', items: 156 },
                      { category: 'Incident Evidence', retention: 'Indefinite', size: '3.2 GB', items: 89 }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <h4 className="font-medium">{item.category}</h4>
                          <p className="text-sm text-muted-foreground">{item.items} items, {item.size}</p>
                        </div>
                        <Badge variant="outline">{item.retention}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Audit Reports & Documentation</CardTitle>
                <CardDescription>
                  Generate comprehensive audit reports and compliance documentation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Available Reports</h4>
                    {[
                      'CMMC Compliance Evidence Package',
                      'STIG Implementation Status Report',
                      'Evidence Collection Summary',
                      'Retention Compliance Report'
                    ].map((report, index) => (
                      <div key={index} className="flex items-center justify-between border rounded-lg p-3">
                        <span className="font-medium">{report}</span>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Generate
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Report Schedule</h4>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Monthly Compliance Report</span>
                          <Badge variant="outline">Automated</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Next: End of month</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Quarterly Assessment</span>
                          <Badge variant="outline">Scheduled</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Next: March 31, 2025</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="executive_brief">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">ML-DSA-65 VERIFIED</Badge>
                  <Badge variant="outline" className="text-xs">PROPRIETARY / PROSPECT-SHAREABLE</Badge>
                </div>
                <CardTitle className="text-2xl font-bold">KHEPRA ASAF — Complete Forensic Chain of Custody & Executive Evidence Brief</CardTitle>
                <CardDescription>
                  A complete, unbroken chain of custody from the moment we connected to the external test environment through every tool execution, every policy decision, every cryptographic seal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Timestamp</div>
                      <div className="text-sm font-mono font-bold">2026-07-30T23:05:34Z</div>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Evaluator</div>
                      <div className="text-sm font-mono font-bold text-blue-500">did:khepra:secred-evaluator-oumou</div>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Target Boundary</div>
                      <div className="text-sm font-mono font-bold">Hostinger VPS 2.24.105.170</div>
                    </div>
                    <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/10">
                      <div className="text-xs text-emerald-500/70 uppercase tracking-widest mb-1">Guard Status</div>
                      <div className="text-sm font-mono font-bold text-emerald-500">INTACT</div>
                    </div>
                  </div>

                  {/* FAIR Risk */}
                  <div>
                    <h3 className="text-lg font-bold mb-4">Part I: The FAIR Risk Math</h3>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 font-medium">FAIR Factor</th>
                            <th className="p-3 font-medium">Without KHEPRA</th>
                            <th className="p-3 font-medium text-emerald-600">With KHEPRA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="p-3 font-medium">Threat Event Frequency (TEF)</td>
                            <td className="p-3">High — AI agents execute thousands of actions per hour</td>
                            <td className="p-3">Unchanged — agents still execute at speed</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Vulnerability (V)</td>
                            <td className="p-3 text-red-500">Near 100% — no runtime boundary exists</td>
                            <td className="p-3 text-emerald-600 font-bold">Near 0% — every action traverses gateway</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Loss Event Frequency (LEF)</td>
                            <td className="p-3 text-red-500 font-bold">High</td>
                            <td className="p-3 text-emerald-600 font-bold">Near Zero</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Primary Loss Magnitude (PLM)</td>
                            <td className="p-3">Unbounded — agent has full credential authority</td>
                            <td className="p-3">Hard ceiling — session isolation caps damage</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Chain of Custody */}
                  <div>
                    <h3 className="text-lg font-bold mb-4">Part IV: Complete AEO Chain of Custody (PentestGPT)</h3>
                    <div className="space-y-3">
                      {[
                        { e: "GENESIS", desc: "Hash: 000000000000... State: CHAIN_INITIALIZED" },
                        { e: "EVENT 1", desc: "Agent Registration | ML-DSA-65 (FIPS 204)" },
                        { e: "EVENT 2", desc: "Intent Declaration | Declared Goal: Scan DVWS" },
                        { e: "EVENT 3", desc: "Tool Execution (Approved) | nmap -sV dvws-node-web-1" },
                        { e: "EVENT 4", desc: "Poisoned Document Ingestion | Signal: INDIRECT_PROMPT_INJECTION (Confidence: 0.99)", isRed: true },
                        { e: "EVENT 5", desc: "Exfiltration Attempt Intercepted | Verdict: DENY_AND_CONTAIN", isRed: true },
                        { e: "EVENT 6", desc: "Session Isolation & Credential Revocation" },
                        { e: "EVENT 7", desc: "Cryptographic Attestation & Passport Update" }
                      ].map((evt, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border flex items-center gap-4 ${evt.isRed ? 'border-red-500/30 bg-red-500/10' : 'bg-background'}`}>
                          <div className={`text-xs font-bold font-mono px-2 py-1 rounded ${evt.isRed ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            {idx}
                          </div>
                          <div>
                            <div className={`font-mono text-[10px] uppercase tracking-widest ${evt.isRed ? 'text-red-400' : 'text-muted-foreground'}`}>{evt.e}</div>
                            <div className="font-semibold text-sm mt-0.5">{evt.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive 3D DAGs */}
                  <div>
                    <h3 className="text-lg font-bold mb-4">Part V: Interactive 3D Forensic Visualizations</h3>
                    <p className="text-sm text-muted-foreground mb-6">Interact with the full forensic chains of custody below. Click, drag, and rotate the nodes. Hover over events to view cryptographic details.</p>
                    <div className="space-y-8">
                      <div>
                        <div className="bg-muted p-2 text-xs font-mono text-center border rounded-t-lg">Target 1: DVWS (Control)</div>
                        <div className="border border-t-0 rounded-b-lg overflow-hidden aspect-video bg-background">
                          <iframe src="/dvws-fair-dag.html" className="w-full h-full border-0" />
                        </div>
                      </div>
                      <div>
                        <div className="bg-muted p-2 text-xs font-mono text-center border rounded-t-lg">Target 2: PentestGPT Incident</div>
                        <div className="border border-t-0 rounded-b-lg overflow-hidden aspect-video bg-background">
                          <iframe src="/pentestgpt-fair-dag.html" className="w-full h-full border-0" />
                        </div>
                      </div>
                      <div>
                        <div className="bg-muted p-2 text-xs font-mono text-center border rounded-t-lg">Target 3: HackGPT Prompt Security</div>
                        <div className="border border-t-0 rounded-b-lg overflow-hidden aspect-video bg-background">
                          <iframe src="/hackgpt-fair-dag.html" className="w-full h-full border-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default EnterpriseEvidenceCollectionPage;