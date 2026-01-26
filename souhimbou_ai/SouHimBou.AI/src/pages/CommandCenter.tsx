import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Radar, Scan, RotateCcw, FileCheck2,
    Server, Wifi, Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
    Play, Pause, RefreshCw
} from "lucide-react";

// Types
interface Endpoint {
    id: string;
    hostname: string;
    ip: string;
    os: string;
    status: "online" | "offline" | "scanning";
    profile: string;
    lastScan?: string;
}

interface ScanResult {
    controlId: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    status: "pass" | "fail" | "not_applicable";
    finding?: string;
}

interface Attestation {
    id: string;
    timestamp: string;
    signatureAlgorithm: string;
    signature: string;
    verified: boolean;
}

// Mock Data
const mockEndpoints: Endpoint[] = [
    { id: "1", hostname: "DC01-PROD", ip: "10.0.1.10", os: "Windows Server 2022", status: "online", profile: "WIN-T", lastScan: "2026-01-27T00:30:00Z" },
    { id: "2", hostname: "WEB-DMZ-01", ip: "10.0.2.50", os: "RHEL 9", status: "online", profile: "JDN", lastScan: "2026-01-26T22:00:00Z" },
    { id: "3", hostname: "DB-CLUSTER-A", ip: "10.0.3.100", os: "Ubuntu 22.04", status: "scanning", profile: "SATCOM" },
    { id: "4", hostname: "EDGE-NODE-42", ip: "192.168.50.1", os: "Windows 11", status: "offline", profile: "JNN" },
];

const mockScanResults: ScanResult[] = [
    { controlId: "V-253263", title: "Encryption at Rest Required", severity: "critical", status: "fail", finding: "Volume C: not encrypted" },
    { controlId: "V-253275", title: "Password Complexity Policy", severity: "high", status: "pass" },
    { controlId: "V-253280", title: "Audit Log Retention", severity: "medium", status: "fail", finding: "Logs retained for 30 days, require 90" },
    { controlId: "V-253301", title: "Firewall Default Deny", severity: "high", status: "pass" },
    { controlId: "V-253315", title: "SSH Key-Based Auth", severity: "medium", status: "not_applicable" },
];

const CommandCenter = () => {
    const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [isScanning, setIsScanning] = useState(false);

    const startScan = () => {
        setIsScanning(true);
        setScanProgress(0);
        const interval = setInterval(() => {
            setScanProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsScanning(false);
                    return 100;
                }
                return prev + Math.random() * 15;
            });
        }, 500);
    };

    const severityColor = (severity: string) => {
        switch (severity) {
            case "critical": return "bg-red-500/20 text-red-400 border-red-500/50";
            case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/50";
            case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
            case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/50";
            default: return "bg-slate-500/20 text-slate-400 border-slate-500/50";
        }
    };

    const statusIcon = (status: string) => {
        switch (status) {
            case "pass": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case "fail": return <XCircle className="w-4 h-4 text-red-500" />;
            case "not_applicable": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                    KHEPRA COMMAND CENTER
                </h1>
                <p className="text-slate-400 mt-2">Compliance in 4 Clicks • Post-Quantum Attestation</p>
            </div>

            {/* 4-Quadrant Grid */}
            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-200px)]">

                {/* Q1: DISCOVER */}
                <Card className="bg-slate-900/50 border-cyan-500/30 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent">
                        <CardTitle className="flex items-center gap-3 text-cyan-400">
                            <Radar className="w-6 h-6" />
                            DISCOVER
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 overflow-auto max-h-[calc(100%-80px)]">
                        <div className="flex gap-2 mb-4">
                            <Button size="sm" variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20">
                                <RefreshCw className="w-4 h-4 mr-2" /> Auto-Detect
                            </Button>
                            <Button size="sm" variant="outline" className="border-slate-500/50 text-slate-400 hover:bg-slate-500/20">
                                <Wifi className="w-4 h-4 mr-2" /> Import AD/LDAP
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {mockEndpoints.map((ep) => (
                                <div
                                    key={ep.id}
                                    onClick={() => setSelectedEndpoint(ep)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedEndpoint?.id === ep.id
                                            ? "bg-cyan-500/20 border-cyan-500"
                                            : "bg-slate-800/50 border-slate-700 hover:border-cyan-500/50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Server className="w-5 h-5 text-slate-400" />
                                            <div>
                                                <p className="font-medium text-slate-200">{ep.hostname}</p>
                                                <p className="text-xs text-slate-500">{ep.ip} • {ep.os}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{ep.profile}</Badge>
                                            <div className={`w-2 h-2 rounded-full ${ep.status === "online" ? "bg-green-500" :
                                                    ep.status === "scanning" ? "bg-blue-500 animate-pulse" : "bg-red-500"
                                                }`} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Q2: ASSESS */}
                <Card className="bg-slate-900/50 border-orange-500/30 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="border-b border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-transparent">
                        <CardTitle className="flex items-center gap-3 text-orange-400">
                            <Scan className="w-6 h-6" />
                            ASSESS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 overflow-auto max-h-[calc(100%-80px)]">
                        <div className="flex gap-2 mb-4">
                            <Button
                                size="sm"
                                onClick={startScan}
                                disabled={isScanning || !selectedEndpoint}
                                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                            >
                                {isScanning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                {isScanning ? "Scanning..." : "Start Scan"}
                            </Button>
                        </div>

                        {isScanning && (
                            <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-orange-500/30">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">Scanning {selectedEndpoint?.hostname}...</span>
                                    <span className="text-orange-400">{Math.round(scanProgress)}%</span>
                                </div>
                                <Progress value={scanProgress} className="h-2" />
                            </div>
                        )}

                        <div className="space-y-2">
                            {mockScanResults.map((result) => (
                                <div
                                    key={result.controlId}
                                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {statusIcon(result.status)}
                                            <div>
                                                <p className="font-medium text-slate-200 text-sm">{result.controlId}</p>
                                                <p className="text-xs text-slate-500">{result.title}</p>
                                            </div>
                                        </div>
                                        <Badge className={severityColor(result.severity)}>{result.severity}</Badge>
                                    </div>
                                    {result.finding && (
                                        <p className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">{result.finding}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Q3: ROLLBACK */}
                <Card className="bg-slate-900/50 border-purple-500/30 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent">
                        <CardTitle className="flex items-center gap-3 text-purple-400">
                            <RotateCcw className="w-6 h-6" />
                            ROLLBACK
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 overflow-auto max-h-[calc(100%-80px)]">
                        <div className="space-y-3">
                            {[
                                { id: "snap-001", time: "2026-01-27 01:30:00", changes: 12, status: "available" },
                                { id: "snap-002", time: "2026-01-27 00:00:00", changes: 8, status: "available" },
                                { id: "snap-003", time: "2026-01-26 18:00:00", changes: 23, status: "archived" },
                            ].map((snap) => (
                                <div
                                    key={snap.id}
                                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-purple-400" />
                                            <div>
                                                <p className="font-medium text-slate-200">{snap.time}</p>
                                                <p className="text-xs text-slate-500">{snap.changes} configuration changes</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                                            disabled={snap.status === "archived"}
                                        >
                                            <RotateCcw className="w-4 h-4 mr-2" /> Restore
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Q4: PROVE */}
                <Card className="bg-slate-900/50 border-green-500/30 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="border-b border-green-500/20 bg-gradient-to-r from-green-500/10 to-transparent">
                        <CardTitle className="flex items-center gap-3 text-green-400">
                            <FileCheck2 className="w-6 h-6" />
                            PROVE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 overflow-auto max-h-[calc(100%-80px)]">
                        <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-8 h-8 text-green-400" />
                                <div>
                                    <p className="font-bold text-green-400">PQC Attestation</p>
                                    <p className="text-xs text-slate-400">Dilithium3 • NIST FIPS 204</p>
                                </div>
                            </div>
                            <div className="p-2 rounded bg-slate-900/80 font-mono text-xs text-green-300 break-all">
                                SIG:ML-DSA-65:0x7f3a...c4e2
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-green-400">Signature Verified</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/20">
                                Export eMASS
                            </Button>
                            <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/20">
                                Generate SPRS
                            </Button>
                            <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/20">
                                Session Transcript
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CommandCenter;
