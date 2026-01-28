import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, CheckCircle, AlertTriangle, XCircle, Server, Database, Globe } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";

const STIGCheck = () => {
  const [scanResults, setScanResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [targetSystem, setTargetSystem] = useState("");

  const mockResults = [
    {
      id: "V-220699",
      title: "Windows Server 2022 must have password complexity enabled",
      severity: "HIGH",
      status: "COMPLIANT",
      category: "Authentication",
      system: "Windows Server 2022",
      description: "Password complexity requirements must be configured to ensure strong authentication.",
      evidence: "Group Policy configured: Computer Configuration\\Windows Settings\\Security Settings\\Account Policies\\Password Policy"
    },
    {
      id: "V-220701",
      title: "Audit policy for logon events must be configured",
      severity: "MEDIUM", 
      status: "NON_COMPLIANT",
      category: "Auditing",
      system: "Windows Server 2022",
      description: "Audit logon events must be enabled to track authentication attempts.",
      evidence: "Current setting: No Auditing | Required: Success and Failure"
    },
    {
      id: "V-220705",
      title: "Guest account must be disabled",
      severity: "HIGH",
      status: "COMPLIANT", 
      category: "Access Control",
      system: "Windows Server 2022",
      description: "The built-in Guest account must be disabled to prevent unauthorized access.",
      evidence: "Account Status: Disabled"
    }
  ];

  const handleScan = async () => {
    setIsScanning(true);
    // Simulate scan delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    setScanResults(mockResults);
    setIsScanning(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "COMPLIANT":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "NON_COMPLIANT":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">STIG Compliance Check</h1>
            <p className="text-muted-foreground">
              Real-time STIG validation for Windows, Linux, and network infrastructure
            </p>
          </div>
          <Shield className="h-8 w-8 text-primary" />
        </div>

        {/* Scan Interface */}
        <Card>
          <CardHeader>
            <CardTitle>System Scan</CardTitle>
            <CardDescription>
              Enter target system or IP range to perform STIG compliance validation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="10.0.0.0/24 or server.domain.mil"
                value={targetSystem}
                onChange={(e) => setTargetSystem(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleScan} disabled={isScanning} className="btn-cyber">
                <Search className="h-4 w-4 mr-2" />
                {isScanning ? "Scanning..." : "Start STIG Scan"}
              </Button>
            </div>
            
            {/* Quick Scan Options */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setTargetSystem("Windows Server 2022")}
              >
                <Server className="h-4 w-4 mr-1" />
                Windows Server
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setTargetSystem("Ubuntu 20.04")}
              >
                <Database className="h-4 w-4 mr-1" />
                Ubuntu Linux
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setTargetSystem("Network Infrastructure")}
              >
                <Globe className="h-4 w-4 mr-1" />
                Network Devices
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {scanResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Scan Results</h2>
              <div className="flex gap-2">
                <Badge variant="success">
                  {scanResults.filter(r => r.status === "COMPLIANT").length} Compliant
                </Badge>
                <Badge variant="destructive">
                  {scanResults.filter(r => r.status === "NON_COMPLIANT").length} Non-Compliant
                </Badge>
              </div>
            </div>

            {scanResults.map((result) => (
              <Card key={result.id} className="card-cyber">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <CardTitle className="text-lg">{result.id}</CardTitle>
                        <Badge variant={getSeverityColor(result.severity)}>
                          {result.severity}
                        </Badge>
                      </div>
                      <CardDescription className="font-medium">
                        {result.title}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{result.system}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {result.description}
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs font-mono text-muted-foreground">
                      <strong>Evidence:</strong> {result.evidence}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {result.category}
                    </Badge>
                    {result.status === "NON_COMPLIANT" && (
                      <Button size="sm" variant="outline">
                        Auto-Remediate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default STIGCheck;