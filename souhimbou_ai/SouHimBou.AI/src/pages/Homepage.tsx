import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Brain, Activity, ChevronRight, Crown, Heart, Users, Scan, Database, Radio, Eye, Lock } from "lucide-react";
import InteractiveDemoVideo from "@/components/InteractiveDemoVideo";
import EmailCaptureForm from "@/components/EmailCaptureForm";
import RevenueStrategies from "@/components/billing/RevenueStrategies";
import ReferralProgram from "@/components/billing/ReferralProgram";
import CacheStatusBadge from "@/components/CacheStatusBadge";

const Homepage = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: "ASAF Sessions Recorded", value: "Live", icon: Eye, color: "text-green-400" },
    { label: "Drift Detection", value: "Real-Time", icon: Activity, color: "text-purple-400" },
    { label: "PQC Signatures", value: "ML-DSA-65", icon: Lock, color: "text-cyan-400" },
    { label: "Phantom Node PoC", value: "Active", icon: Radio, color: "text-emerald-400" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-cyan-500/20 bg-black/20 backdrop-blur-lg relative z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src="/lovable-uploads/94f06ba5-2c93-4be0-a03f-e3fff4157ca6.png"
                alt="SouHimBou AI Logo"
                className="h-12 w-auto"
              />
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  SouHimBou.ai
                </h1>
                <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30">
                  PROOF OF CONCEPT
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <CacheStatusBadge />
              <div className="text-right hidden md:block">
                <div className="text-sm text-gray-300">
                  {currentTime.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">ZULU TIME</div>
              </div>
              <Button
                onClick={() => navigate('/billing')}
                variant="outline"
                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hidden lg:flex"
              >
                <Shield className="h-4 w-4 mr-2" />
                Pricing
              </Button>
              <Button
                onClick={() => navigate('/onboarding')}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                <Eye className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-blue-600/10 animate-pulse"></div>
        <div className="container mx-auto px-6 py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Hero Text */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-cyan-400 tracking-wide uppercase">
                    PQC-MCP Flight Recorder — Proof of Concept Live
                  </p>
                </div>

                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="text-white">Security Camera for</span>
                  <br />
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    AI Agents
                  </span>
                </h1>

                <p className="text-xl text-gray-300 leading-relaxed">
                  Every MCP tool call from Claude, Cursor, and Copilot — intercepted, signed with Dilithium3, and anchored into a tamper-evident DAG audit chain.
                  Your AI agents now have a flight recorder.
                </p>

                {/* PoC Status — replaces old "Development" disclaimer */}
                <div className="border border-emerald-500/50 rounded-lg bg-emerald-900/20 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <Radio className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-emerald-400">
                        ✅ Proof of Concept Deployed
                      </h3>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        The ASAF framework is running live on a <strong>Raspberry Pi Phantom Node</strong> connected to a consumer Spectrum router.
                        ML-DSA-65 key rotation, spectral fingerprint addressing, and air-gap mode — operational on ARM edge hardware.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-cyan-500/30 rounded-lg bg-cyan-900/20 p-6 space-y-3">
                  <h3 className="text-lg font-semibold text-cyan-400">
                    What's Running Right Now
                  </h3>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">✓ ASAF Session Recording</span>
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">✓ MCP Tool Interception</span>
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">✓ Drift Detection</span>
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">✓ Phantom Node (Raspberry Pi)</span>
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">✓ PQC Key Rotation</span>
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded">🔒 Prompt Injection Scanning</span>
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">🔬 Accepting Design Partners</span>
                  </div>
                </div>
              </div>

              <EmailCaptureForm />

              {/* Primary CTA */}
              <div className="pt-6">
                <Button
                  size="lg"
                  onClick={() => navigate('/onboarding')}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold py-4 px-8 text-lg border border-cyan-500/50"
                >
                  <Eye className="h-6 w-6 mr-3" />
                  Start Free Flight Recording
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Free forever for local recording — upgrade for PQC signing and edge deployment
                </p>
              </div>
            </div>

            {/* Right Side - Interactive Demo Video */}
            <div className="space-y-6">
              <InteractiveDemoVideo />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-black/20 backdrop-blur-lg">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="text-center space-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <stat.icon className={`h-8 w-8 mx-auto ${stat.color}`} />
                <div className="text-2xl lg:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Referral Program Section */}
      <section className="py-20 bg-black/20">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-white">Earn Rewards Through Referrals</h2>
            <p className="text-xl text-gray-300">Share the platform and get rewarded</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ReferralProgram />
          </div>
        </div>
      </section>

      {/* Pricing Section — SouHimBou-specific tiers */}
      <section className="py-20 bg-black/10">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-white">PQC-MCP Flight Recorder Plans</h2>
            <p className="text-xl text-gray-300">From free local recording to sovereign edge deployment</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Scout — Free */}
            <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-6 space-y-6 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                FREE FOREVER
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Scout</h3>
                <div className="text-3xl font-bold text-white">$0<span className="text-sm text-gray-400">/month</span></div>
                <p className="text-xs text-gray-400">Local ASAF recording — no credit card</p>
              </div>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-center"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>Unlimited ASAF session recording</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>MCP tool call interception</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>DAG audit trail (local)</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>Basic drift detection alerts</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>Community support</li>
              </ul>
              <Button
                className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                onClick={() => navigate('/onboarding')}
              >
                Start Recording
              </Button>
            </div>

            {/* Sentinel — $49/mo */}
            <div className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 border border-cyan-500 rounded-lg p-6 space-y-6 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
                MOST POPULAR
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Sentinel</h3>
                <div className="text-3xl font-bold text-cyan-400">$49<span className="text-sm text-gray-400">/month</span></div>
                <p className="text-xs text-gray-400">PQC-signed flight recording</p>
              </div>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-center"><div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>Everything in Scout</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>ML-DSA-65 signed DAG nodes</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>Prompt injection scanning (6 patterns)</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>Real-time SSE event streaming</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>Behavioral anomaly scoring</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>ADINKHEPRA attestation seal</li>
              </ul>
              <Button
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                onClick={() => navigate('/onboarding')}
              >
                Upgrade to Sentinel
              </Button>
            </div>

            {/* Phantom — $299/mo */}
            <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-purple-500 rounded-lg p-6 space-y-6 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
                EDGE DEPLOYMENT
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Phantom</h3>
                <div className="text-3xl font-bold text-purple-400">$299<span className="text-sm text-gray-400">/month</span></div>
                <p className="text-xs text-gray-400">Sovereign edge nodes — air-gapped</p>
              </div>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-center"><div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>Everything in Sentinel</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>Phantom Node deployment (Pi / ARM)</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>Auto PQC key rotation (Kyber + Dilithium)</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>Air-gap / offline mode</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>Custom Adinkra symbol addressing</li>
                <li className="flex items-center"><div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>Up to 10 team seats + Slack</li>
              </ul>
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
                onClick={() => navigate('/onboarding')}
              >
                Deploy Phantom Node
              </Button>
              <p className="text-xs text-gray-500 text-center">Includes design partner onboarding</p>
            </div>
          </div>

          <div className="mt-12 text-center space-y-3">
            <p className="text-gray-400 text-sm">
              All plans include: DAG audit chain • MCP tool interception • Dilithium3 signing • Community support
            </p>
            <p className="text-cyan-400 text-sm font-medium">
              Looking for CMMC Compliance instead? Visit <a href="https://adinkhepra.com" className="underline hover:text-cyan-300">adinkhepra.com</a>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="demo" className="py-20 bg-gradient-to-r from-cyan-900/30 to-blue-900/30">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold text-white">
              🛡️ Your AI Agents Deserve a Flight Recorder
            </h2>
            <p className="text-xl text-gray-300">
              The ASAF framework is no longer theoretical. Proof of Concept is live on edge hardware.
              Start recording your AI agent sessions today — free forever at the Scout tier.
            </p>

            {/* CTA Options */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {/* Free Recording CTA */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-600/50 rounded-lg p-6 space-y-4">
                <Eye className="h-12 w-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-bold text-emerald-400">Scout — Free</h3>
                <p className="text-sm text-gray-300">Local flight recording for every AI agent</p>
                <Button
                  size="lg"
                  onClick={() => navigate('/onboarding')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Start Recording
                </Button>
              </div>

              {/* PQC Signing CTA */}
              <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-500/50 rounded-lg p-6 space-y-4">
                <Lock className="h-12 w-12 text-cyan-400 mx-auto" />
                <h3 className="text-xl font-bold text-cyan-400">Sentinel — $49/mo</h3>
                <p className="text-sm text-gray-300">PQC-signed, tamper-evident audit trails</p>
                <Button
                  size="lg"
                  onClick={() => navigate('/billing')}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Get Sentinel
                </Button>
              </div>

              {/* Edge Deployment CTA */}
              <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/50 rounded-lg p-6 space-y-4">
                <Radio className="h-12 w-12 text-purple-400 mx-auto" />
                <h3 className="text-xl font-bold text-purple-400">Phantom — $299/mo</h3>
                <p className="text-sm text-gray-300">Sovereign edge deployment on your hardware</p>
                <Button
                  size="lg"
                  onClick={() => navigate('/billing')}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                >
                  <Radio className="h-4 w-4 mr-2" />
                  Deploy Phantom
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cyan-500/20 bg-black/20 backdrop-blur-lg py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="text-sm text-gray-400">
            © 2026 SouHimBou.ai — PQC-MCP Flight Recorder by NouchiX (Sacred Knowledge Inc.) | Patent Pending USPTO #73565085
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;