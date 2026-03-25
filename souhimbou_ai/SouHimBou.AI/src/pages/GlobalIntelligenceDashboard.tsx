import React, { useState } from 'react';
import {
    ShieldAlert,
    Activity,
    GlobeLock,
    Network,
    Cpu,
    BrainCircuit,
    TrendingDown,
    LockKeyhole,
    Radar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarHeader } from "@/components/ui/sidebar";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

// Mock Data for the 5 Features
const threatData = [
    { time: '00:00', threats: 120 },
    { time: '04:00', threats: 210 },
    { time: '08:00', threats: 180 },
    { time: '12:00', threats: 320 },
    { time: '16:00', threats: 250 },
    { time: '20:00', threats: 410 },
    { time: '24:00', threats: 290 },
];

const quantumReadinessData = [
    { name: 'Financial', readiness: 65 },
    { name: 'Healthcare', readiness: 42 },
    { name: 'Defense', readiness: 88 },
    { name: 'Retail', readiness: 25 },
    { name: 'Your Org', readiness: 75 },
];

const shadowItData = [
    { name: 'Authorized', value: 75 },
    { name: 'Phantom/Shadow', value: 25 },
];
const COLORS = ['#10b981', '#f43f5e'];

const GlobalIntelligenceDashboard = () => {
    return (
        <div className="min-h-screen bg-black text-[#e8f1f2]">
            <SidebarHeader title="Global Telemetry Intelligence" />

            <main className="pt-24 pb-12 px-6 lg:px-12 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                            Global Intelligence Hub
                        </h1>
                        <p className="text-gray-400 mt-2 max-w-2xl">
                            Enterprise telemetry aggregation powered by Souhimbou-AI. Transforming anonymous metadata into actionable, TRL 10 predictive intelligence.
                        </p>
                    </div>
                    <Badge variant="outline" className="border-indigo-500 text-indigo-400 bg-indigo-500/10 px-4 py-1.5 backdrop-blur-md">
                        <RadioWaveIcon /> LIVE TELEMETRY SENSORS ACTIVE
                    </Badge>
                </div>

                {/* Feature 1 & 2 Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* 1. Zero-Day Vulnerability Correlator */}
                    <Card className="bg-[#111] border-gray-800 backdrop-blur-xl hover:border-red-500/50 transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <CardHeader>
                            <div className="flex justify-between items-center mb-2">
                                <CardTitle className="text-xl flex items-center gap-2 text-gray-200">
                                    <ShieldAlert className="text-red-500 h-6 w-6" />
                                    Zero-Day Vulnerability Correlator
                                </CardTitle>
                                <Badge className="bg-red-500/20 text-red-400">Early Warning System</Badge>
                            </div>
                            <CardDescription className="text-gray-400">
                                Instantly flags assets running vulnerable cryptography (e.g. RSA, weak Dilithium) across your network prior to exploitation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-black/50 p-4 rounded-lg flex items-center justify-between border border-gray-800">
                                <div className="space-y-1">
                                    <p className="text-sm text-gray-500">Cross-Network Vulnerable Assets</p>
                                    <p className="text-3xl font-bold text-red-500">14<span className="text-sm text-red-500/50">/1,204</span></p>
                                </div>
                                <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700">
                                    Isolate Assets
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Quantum Readiness Index */}
                    <Card className="bg-[#111] border-gray-800 backdrop-blur-xl hover:border-indigo-500/50 transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <CardHeader>
                            <div className="flex justify-between items-center mb-2">
                                <CardTitle className="text-xl flex items-center gap-2 text-gray-200">
                                    <GlobeLock className="text-indigo-400 h-6 w-6" />
                                    Quantum Readiness Index
                                </CardTitle>
                                <Badge className="bg-indigo-500/20 text-indigo-400">Industry Benchmarking</Badge>
                            </div>
                            <CardDescription className="text-gray-400">
                                Compare your PQC migration speed against telemetry aggregated anonymously from sector competitors.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={quantumReadinessData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="readiness" radius={[4, 4, 0, 0]}>
                                        {quantumReadinessData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Your Org' ? '#6366f1' : '#374151'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Feature 3 & 4 Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* 3. Attack Surface Predictive Analytics */}
                    <Card className="bg-[#111] border-gray-800 backdrop-blur-xl hover:border-cyan-500/50 transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <CardHeader>
                            <div className="flex justify-between items-center mb-2">
                                <CardTitle className="text-xl flex items-center gap-2 text-gray-200">
                                    <BrainCircuit className="text-cyan-400 h-6 w-6" />
                                    Predictive AI Analytics
                                </CardTitle>
                                <Badge className="bg-cyan-500/20 text-cyan-400">ML Trained</Badge>
                            </div>
                            <CardDescription className="text-gray-400">
                                Souhimbou-AI continuously learns from global telemetry to predict which configurations most frequently lead to breaches.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-cyan-950/30 rounded border border-cyan-900/50">
                                    <div className="flex items-center gap-3">
                                        <TrendingDown className="h-5 w-5 text-cyan-400" />
                                        <div>
                                            <p className="text-sm font-medium text-cyan-100">Predicted Config Failure</p>
                                            <p className="text-xs text-cyan-500">STIG V-222403 misconfiguration highly correlated with lateral movement.</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="border-cyan-800 text-cyan-400 hover:bg-cyan-950">
                                        Auto-Remediate
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 4. Dynamic Cloud Threat Intelligence Feed */}
                    <Card className="bg-[#111] border-gray-800 backdrop-blur-xl hover:border-purple-500/50 transition-all duration-500 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <CardHeader>
                            <div className="flex justify-between items-center mb-2">
                                <CardTitle className="text-xl flex items-center gap-2 text-gray-200">
                                    <Network className="text-purple-400 h-6 w-6" />
                                    Cloud Threat Intel Feed
                                </CardTitle>
                                <Badge className="bg-purple-500/20 text-purple-400">First-Party Sensor Data</Badge>
                            </div>
                            <CardDescription className="text-gray-400">
                                Pulls real-time telemetry from the distributed Khepra network to identify emerging configuration threats before databases are updated.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={threatData}>
                                    <defs>
                                        <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="time" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="threats" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorThreats)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                </div>

                {/* Feature 5 Row */}
                {/* 5. Automatic "Phantom" Hardware Discovery */}
                <Card className="bg-[#111] border-gray-800 backdrop-blur-xl hover:border-emerald-500/50 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <CardHeader>
                        <div className="flex justify-between items-center mb-2">
                            <CardTitle className="text-xl flex items-center gap-2 text-gray-200">
                                <Radar className="text-emerald-400 h-6 w-6" />
                                Automatic "Phantom" Hardware Discovery
                            </CardTitle>
                            <Badge className="bg-emerald-500/20 text-emerald-400">Shadow IT Detection</Badge>
                        </div>
                        <CardDescription className="text-gray-400 max-w-3xl">
                            Leverages container runtime metadata and geographic hints to map rogue nodes operating within your infrastructure boundaries without authorization. Ideal for Proof-of-Value (PoV) trials.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row items-center gap-8">
                        <div className="h-[200px] w-full md:w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={shadowItData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {shadowItData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 space-y-4">
                            <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <Cpu className="h-5 w-5 text-rose-500" />
                                    <span className="font-semibold text-rose-100">Phantom Node Detected</span>
                                </div>
                                <p className="text-sm text-gray-400 mb-2">AWS Region: us-gov-west-1 • 14 Deprecated Certificates</p>
                                <div className="w-full bg-gray-900 rounded-full h-2">
                                    <div className="bg-rose-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                                </div>
                                <p className="text-xs text-rose-500/70 mt-1 text-right">High Risk</p>
                            </div>

                            <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <LockKeyhole className="h-5 w-5 text-rose-400" />
                                    <span className="font-semibold text-rose-100">Unauthorized Key Generation</span>
                                </div>
                                <p className="text-sm text-gray-400 mb-2">Runtime: podman • Found non-compliant RSA-2048 signing</p>
                                <div className="w-full bg-gray-900 rounded-full h-2">
                                    <div className="bg-rose-400 h-2 rounded-full" style={{ width: '60%' }}></div>
                                </div>
                                <p className="text-xs text-rose-400/70 mt-1 text-right">Medium Risk</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </main>
        </div>
    );
};

// Simple animated icon for header
const RadioWaveIcon = () => (
    <span className="relative flex h-3 w-3 inline-block mr-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
    </span>
);

export default GlobalIntelligenceDashboard;
