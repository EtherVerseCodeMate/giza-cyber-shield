import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, Lock, Zap, GitBranch, FileCheck } from "lucide-react";

const Homepage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-lg sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/lovable-uploads/94f06ba5-2c93-4be0-a03f-e3fff4157ca6.png"
              alt="SouHimBou AI"
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl font-black tracking-tight text-white uppercase">
                SouHimBou <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                PQC-MCP Server · by NouchiX
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/EtherVerseCodeMate/giza-cyber-shield/blob/main/docs/khepra-mcp-quickstart.md"
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors hidden sm:block"
            >
              Quickstart
            </a>
            <Button
              onClick={() => navigate('/onboarding')}
              className="bg-cyan-300 hover:bg-cyan-200 text-zinc-950 font-black uppercase tracking-wide text-sm px-5"
            >
              Run the MCP quickstart
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-zinc-800">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-24">
          {/* Left */}
          <div className="flex flex-col justify-center space-y-6">
            <div className="flex items-center gap-3">
              <span className="rounded border border-cyan-400/30 bg-cyan-400/5 px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                MCP Registry · io.github.etherversecodemate/khepra-mcp
              </span>
            </div>

            <h1 className="text-4xl font-semibold tracking-normal text-white md:text-6xl leading-tight">
              Secure AI agent actions
              <br />
              with signed MCP evidence.
            </h1>

            <p className="max-w-xl text-lg leading-8 text-zinc-300">
              SouHimBou AI and KHEPRA wrap Model Context Protocol tool calls with
              validation, post-quantum signatures, and replayable audit evidence
              for regulated teams.
            </p>

            {/* Proof points */}
            <ul className="space-y-2 text-sm text-zinc-400">
              {[
                "Local stdio MCP server — works with Claude, Cursor, Windsurf today",
                "OCI package for registry distribution",
                "Dilithium-3 signed tool responses (NIST FIPS 204)",
                "DAG-oriented tamper-evident audit chain",
                "CMMC 2.0 / NIST SP 800-171 evidence alignment",
                "Patent filed from a combat deployment — USPTO #73565085",
              ].map((pt) => (
                <li key={pt} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  {pt}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row pt-2">
              <Button
                onClick={() => navigate('/onboarding')}
                className="bg-cyan-300 hover:bg-cyan-200 text-zinc-950 font-black uppercase tracking-wide px-6 py-5"
              >
                <Zap className="h-4 w-4 mr-2" />
                Run the MCP quickstart
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dod')}
                className="border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white px-6 py-5"
              >
                Book a 48-hour evidence assessment
              </Button>
            </div>
          </div>

          {/* Right — smoke test output */}
          <div className="self-center border border-zinc-800 bg-zinc-900/60 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-zinc-500">
              <span>Smoke test output</span>
              <span className="text-emerald-400">● PASS</span>
            </div>
            <pre className="text-sm leading-6 text-cyan-100 overflow-x-auto whitespace-pre-wrap">
{`go run ./cmd/khepra-mcp
./scripts/mcp-smoke-test.ps1

{
  "server": "khepra-mcp",
  "version": "1.0.0",
  "protocolVersion": "2024-11-05",
  "toolCount": 9,
  "ping": "pong"
}`}
            </pre>
            <div className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">
              Every tool response is Dilithium-3 signed and DAG-attested.
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1. Install",
                color: "text-cyan-300",
                icon: GitBranch,
                desc: "Run from source with `go run ./cmd/khepra-mcp` or pull the OCI image. Configure in your `.mcp.json` — works immediately with Claude Code, Cursor, and Windsurf.",
              },
              {
                step: "2. Verify",
                color: "text-amber-300",
                icon: FileCheck,
                desc: "The smoke test sends initialize, tools/list, and ping. Every response is signed. Every call is logged to the DAG. Nothing touches stdout except JSON-RPC.",
              },
              {
                step: "3. Publish",
                color: "text-emerald-300",
                icon: Shield,
                desc: "Build the OCI image with Dockerfile.mcp and push to GHCR. The `io.modelcontextprotocol.server.name` label and server.json namespace are pre-aligned for registry ownership verification.",
              },
            ].map(({ step, color, icon: Icon, desc }) => (
              <div key={step}>
                <p className={`text-sm font-semibold uppercase tracking-[0.14em] ${color}`}>{step}</p>
                <Icon className={`h-6 w-6 mt-3 mb-2 ${color}`} />
                <p className="text-sm leading-6 text-zinc-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RISK CLASSIFICATION */}
      <section className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <h2 className="text-2xl font-semibold text-white mb-2">Risk-classified execution.</h2>
          <p className="text-zinc-400 text-sm mb-8 max-w-xl">
            The manifest is the sole source of truth. Every tool call is routed by its risk class
            before execution — no side-effects without policy, no destructive action without confirmation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                cls: "read-only",
                color: "border-emerald-500/30 bg-emerald-900/10",
                label: "text-emerald-300",
                tools: ["acp_status", "nhi_inventory", "nhi_orphans", "nhi_excessive", "nhi_expired"],
                desc: "In-process. No side effects. Runs immediately.",
              },
              {
                cls: "sandboxed",
                color: "border-amber-500/30 bg-amber-900/10",
                label: "text-amber-300",
                tools: ["ert_scan"],
                desc: "Isolated environment with resource limits. Falls back to in-process when Docker unavailable (with warning).",
              },
              {
                cls: "destructive",
                color: "border-red-500/30 bg-red-900/10",
                label: "text-red-300",
                tools: ["acp_issue", "acp_revoke", "nhi_revoke"],
                desc: "Requires explicit ConfirmationGate approval. DAG-attested. Denied if gate is unconfigured.",
              },
            ].map(({ cls, color, label, tools, desc }) => (
              <div key={cls} className={`border rounded-lg p-5 space-y-3 ${color}`}>
                <p className={`text-xs font-bold uppercase tracking-widest ${label}`}>{cls}</p>
                <div className="flex flex-wrap gap-1">
                  {tools.map((t) => (
                    <code key={t} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{t}</code>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 leading-5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPLIANCE BUYER */}
      <section className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">Turn agent activity into evidence.</h2>
              <p className="text-zinc-300 leading-7">
                KHEPRA records what the agent requested, which policy applied, how the tool
                executed, and which signed result returned to the host. That evidence exports
                into a compliance packet mapped to CMMC Level 2 and NIST SP 800-171 control expectations.
              </p>
              <p className="text-zinc-400 text-sm">
                Traditional audit workflows don't capture autonomous agent actions.
                KHEPRA does — with post-quantum signatures that remain verifiable past 2030.
              </p>
              <a
                href="https://adinkhepra.com"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-100 transition-colors"
              >
                Request the AI Agent Evidence Gap Assessment
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-5 space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-widest">Sample signed envelope</p>
              <pre className="text-xs text-zinc-300 leading-5 overflow-x-auto whitespace-pre-wrap">
{`{
  "tool_name": "nhi_inventory",
  "attestation_id": "dag-node-a3f9c1",
  "signature": "ML-DSA-65::...",
  "created_at": "2026-05-19T00:00:00Z",
  "provenance": "local-stdio",
  "schema_version": "1.0.0"
}`}
              </pre>
              <p className="text-xs text-zinc-600">
                Every envelope is anchored to the DAG chain. Tamper-evident. Replayable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT LINES */}
      <section className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <h2 className="text-2xl font-semibold text-white mb-8">The full stack.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                product: "KHEPRA Protocol",
                site: "core layer",
                color: "border-zinc-700",
                desc: "Signing, routing, attestation, DAG provenance. The trust substrate everything runs on.",
                buyers: "AI platform · security engineers",
              },
              {
                product: "SouHimBou AI",
                site: "souhimbou.ai",
                color: "border-cyan-500/50",
                desc: "PQC-MCP Server. MCP flight recorder, prompt/tool-call monitoring, agent behavior security.",
                buyers: "Agentic AI · security ops teams",
              },
              {
                product: "AdinKhepra ASAF",
                site: "adinkhepra.com",
                color: "border-blue-500/50",
                desc: "CMMC 2.0 / STIG / FedRAMP evidence automation. The compliance autopilot for DIB.",
                buyers: "GRC · compliance · DIB leadership",
              },
              {
                product: "Phantom Node",
                site: "enterprise",
                color: "border-purple-500/50",
                desc: "On-premise sovereign runtime for air-gapped and edge regulated networks.",
                buyers: "Air-gapped · edge operators",
              },
            ].map(({ product, site, color, desc, buyers }) => (
              <div key={product} className={`border rounded-lg p-5 space-y-3 bg-zinc-900/30 ${color}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-white text-sm">{product}</p>
                  <span className="text-[10px] text-zinc-500 shrink-0">{site}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-5">{desc}</p>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">{buyers}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="bg-zinc-950 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
            {[
              "USPTO Patent Pending #73565085",
              "NIST FIPS 203 / 204 (ML-KEM / ML-DSA)",
              "Iron Bank · DISA Approved",
              "HPE Tier 2 Partner",
              "NSF I-Corps Validated",
              "U.S. Army National Guard",
            ].map((badge) => (
              <span key={badge} className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-cyan-600" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div>© 2026 NouchiX · SouHimBou AI · KHEPRA Protocol</div>
          <div className="flex gap-6">
            <a href="https://nouchix.com" className="hover:text-zinc-300 transition-colors">NouchiX.com</a>
            <a href="https://adinkhepra.com" className="hover:text-zinc-300 transition-colors">AdinKhepra.com</a>
            <span>contact@nouchix.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
