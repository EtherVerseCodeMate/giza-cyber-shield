"""
SouHimBou.AI — Supabase MCP Integration
========================================

This module gives the Python AI agent (SouHimBou) bidirectional access to:

  1. **Supabase** — read/write anomaly detections, compliance events, agent state,
     and MCP tool call audit logs using the supabase-py client.

  2. **Khepra MCP Bridge** — call Khepra MCP tools programmatically from Python,
     enabling SouHimBou to:
       - Trigger compliance scans when it detects an anomaly
       - Retrieve STIG rules for its explainability layer
       - Export PQC-signed attestations after remediation
       - Stream compliance events back to connected AI tools

Architecture note:
  SouHimBou (Python/ML) is the "Intuition & Soul" of the system.
  It detects threats, scores anomalies, and decides response priority.
  Via this module it can write its findings directly to Supabase so
  the Go KASA agent and AI tools (Claude, Cursor) can act on them.

Usage:
    from supabase_mcp import SouHimBouMCPClient

    client = SouHimBouMCPClient.from_env()
    await client.record_anomaly(
        session_id="...",
        target_id="192.168.1.10",
        anomaly_score=0.94,
        is_anomaly=True,
        confidence=0.87,
        archetype_influence={"Set": 0.72, "Apep": 0.28},
    )
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

import httpx

logger = logging.getLogger(__name__)

# ─── Configuration ──────────────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xjknkjbrjgljuovaazeu.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
KHEPRA_API_URL = os.getenv("KHEPRA_API_URL", "https://souhimbou-ai.fly.dev")
KHEPRA_SERVICE_SECRET = os.getenv("KHEPRA_SERVICE_SECRET", "")
MCP_BRIDGE_URL = os.getenv(
    "MCP_BRIDGE_URL",
    f"{SUPABASE_URL}/functions/v1/mcp-agent-bridge",
)

# ─── Data Models ───────────────────────────────────────────────────────────────

@dataclass
class AnomalyRecord:
    """Anomaly detection result to persist to Supabase."""

    target_id: str
    anomaly_score: float
    is_anomaly: bool
    confidence: float
    archetype_influence: dict[str, float] = field(default_factory=dict)
    features: dict[str, Any] = field(default_factory=dict)
    session_id: str = ""
    source_agent_type: str = "python_souhimbou"
    dag_node_id: str = ""
    id: str = field(default_factory=lambda: str(uuid4()))
    detected_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class ComplianceEventRecord:
    """Compliance finding to persist to Supabase."""

    org_id: str
    control_id: str
    framework: str
    status: str  # COMPLIANT | NON_COMPLIANT | NOT_APPLICABLE
    score: float
    finding_details: dict[str, Any] = field(default_factory=dict)
    scan_id: str = ""
    dag_node_id: str = ""
    pqc_attestation: str = ""
    recorded_by: str = "python_souhimbou"
    id: str = field(default_factory=lambda: str(uuid4()))
    recorded_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ─── Supabase REST Client ──────────────────────────────────────────────────────

class SupabaseClient:
    """Minimal async Supabase REST client for Python agents."""

    def __init__(self, url: str, service_key: str, anon_key: str = ""):
        self.url = url.rstrip("/")
        self._key = service_key or anon_key
        self._client = httpx.AsyncClient(
            base_url=self.url,
            headers={
                "Authorization": f"Bearer {self._key}",
                "apikey": self._key,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            timeout=15.0,
        )

    async def insert(self, table: str, rows: list[dict] | dict) -> list[dict]:
        """Insert one or more rows into a Supabase table."""
        if isinstance(rows, dict):
            rows = [rows]
        resp = await self._client.post(f"/rest/v1/{table}", json=rows)
        resp.raise_for_status()
        return resp.json()

    async def select(
        self,
        table: str,
        filter_str: str = "",
        columns: str = "*",
        limit: int = 100,
    ) -> list[dict]:
        """Query rows from a Supabase table."""
        params: dict[str, Any] = {"select": columns, "limit": limit}
        # PostgREST filter params are passed directly as query params
        if filter_str:
            for part in filter_str.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v
        resp = await self._client.get(f"/rest/v1/{table}", params=params)
        resp.raise_for_status()
        return resp.json()

    async def upsert(
        self, table: str, rows: list[dict] | dict, on_conflict: str = "id"
    ) -> list[dict]:
        """Upsert rows (insert or update on conflict)."""
        if isinstance(rows, dict):
            rows = [rows]
        resp = await self._client.post(
            f"/rest/v1/{table}",
            json=rows,
            params={"on_conflict": on_conflict},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        resp.raise_for_status()
        return resp.json()

    async def ping(self) -> bool:
        """Check connectivity to Supabase."""
        try:
            resp = await self._client.get("/rest/v1/")
            return resp.status_code in (200, 404)
        except Exception:
            return False

    async def close(self) -> None:
        await self._client.aclose()


# ─── MCP Bridge Client ─────────────────────────────────────────────────────────

class MCPBridgeClient:
    """Calls Khepra MCP tools via the mcp-agent-bridge Edge Function."""

    def __init__(self, bridge_url: str, service_key: str):
        self.bridge_url = bridge_url
        self._client = httpx.AsyncClient(
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {service_key}",
            },
            timeout=30.0,
        )
        self._req_id = 0

    def _next_id(self) -> int:
        self._req_id += 1
        return self._req_id

    async def call_tool(
        self, tool_name: str, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        """Invoke an MCP tool via the Edge Function bridge."""
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }
        resp = await self._client.post(self.bridge_url, json=payload)
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            raise RuntimeError(
                f"MCP tool error [{data['error']['code']}]: {data['error']['message']}"
            )
        return data.get("result", {})

    async def list_tools(self) -> list[dict]:
        """List available MCP tools from the bridge."""
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/list",
        }
        resp = await self._client.post(self.bridge_url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("result", {}).get("tools", [])

    async def close(self) -> None:
        await self._client.aclose()


# ─── SouHimBou MCP Client ──────────────────────────────────────────────────────

class SouHimBouMCPClient:
    """
    High-level client combining Supabase persistence with Khepra MCP tool calls.

    SouHimBou uses this to:
      - Write anomaly detections to Supabase (immediate persistence)
      - Trigger compliance scans when anomaly score > threshold
      - Retrieve threat intelligence for explainability
      - Record compliance events after ML-driven remediation
    """

    def __init__(
        self,
        supabase: SupabaseClient,
        mcp_bridge: Optional[MCPBridgeClient] = None,
    ):
        self._supabase = supabase
        self._mcp = mcp_bridge

    @classmethod
    def from_env(cls) -> "SouHimBouMCPClient":
        """Create client from environment variables."""
        supa = SupabaseClient(
            url=SUPABASE_URL,
            service_key=SUPABASE_SERVICE_KEY,
            anon_key=SUPABASE_ANON_KEY,
        )
        bridge: Optional[MCPBridgeClient] = None
        if SUPABASE_SERVICE_KEY and MCP_BRIDGE_URL:
            bridge = MCPBridgeClient(
                bridge_url=MCP_BRIDGE_URL,
                service_key=SUPABASE_SERVICE_KEY,
            )
        return cls(supabase=supa, mcp_bridge=bridge)

    # ── Anomaly Detection ──────────────────────────────────────────────────────

    async def record_anomaly(
        self,
        target_id: str,
        anomaly_score: float,
        is_anomaly: bool,
        confidence: float,
        archetype_influence: dict[str, float] | None = None,
        features: dict[str, Any] | None = None,
        session_id: str = "",
        dag_node_id: str = "",
    ) -> str:
        """
        Persist an anomaly detection to Supabase.

        If anomaly_score > 0.85, automatically triggers a compliance scan
        via the MCP bridge (if available).

        Returns the anomaly record ID.
        """
        record = AnomalyRecord(
            target_id=target_id,
            anomaly_score=anomaly_score,
            is_anomaly=is_anomaly,
            confidence=confidence,
            archetype_influence=archetype_influence or {},
            features=features or {},
            session_id=session_id,
            dag_node_id=dag_node_id,
        )

        try:
            rows = await self._supabase.insert("mcp_anomaly_detections", asdict(record))
            logger.info(
                "Anomaly persisted: id=%s score=%.3f is_anomaly=%s",
                record.id, anomaly_score, is_anomaly,
            )
        except Exception as e:
            logger.warning("Failed to persist anomaly: %s", e)

        # Auto-trigger compliance scan for high-confidence anomalies
        if is_anomaly and anomaly_score > 0.85 and self._mcp:
            asyncio.create_task(
                self._auto_trigger_scan(target_id, anomaly_score, record.id)
            )

        return record.id

    async def _auto_trigger_scan(
        self, target_id: str, anomaly_score: float, anomaly_id: str
    ) -> None:
        """Background task: trigger compliance scan when high anomaly detected."""
        if not self._mcp:
            return
        try:
            result = await self._mcp.call_tool(
                "khepra_run_compliance_scan",
                {
                    "scan_target": target_id,
                    "framework": "CMMC_L2",
                },
            )
            logger.info(
                "Auto-scan triggered for anomaly=%s target=%s score=%.3f result=%s",
                anomaly_id, target_id, anomaly_score, result,
            )
        except Exception as e:
            logger.warning("Auto-scan trigger failed for anomaly=%s: %s", anomaly_id, e)

    # ── Compliance Events ──────────────────────────────────────────────────────

    async def record_compliance_event(
        self,
        org_id: str,
        control_id: str,
        framework: str,
        status: str,
        score: float,
        finding_details: dict[str, Any] | None = None,
        scan_id: str = "",
        dag_node_id: str = "",
        pqc_attestation: str = "",
    ) -> str:
        """Persist a compliance finding from ML analysis to Supabase."""
        record = ComplianceEventRecord(
            org_id=org_id,
            control_id=control_id,
            framework=framework,
            status=status,
            score=score,
            finding_details=finding_details or {},
            scan_id=scan_id,
            dag_node_id=dag_node_id,
            pqc_attestation=pqc_attestation,
        )

        try:
            await self._supabase.insert("mcp_compliance_events", asdict(record))
            logger.info(
                "Compliance event persisted: control=%s status=%s score=%.2f",
                control_id, status, score,
            )
        except Exception as e:
            logger.warning("Failed to persist compliance event: %s", e)

        return record.id

    # ── MCP Tool Calls ─────────────────────────────────────────────────────────

    async def get_compliance_score(
        self, org_id: str, framework: str = "CMMC_L2"
    ) -> dict:
        """Retrieve current compliance score via MCP bridge."""
        if not self._mcp:
            raise RuntimeError("MCP bridge not configured")
        return await self._mcp.call_tool(
            "khepra_get_compliance_score",
            {"org_id": org_id, "framework": framework},
        )

    async def query_stig(
        self, stig_id: str, include_remediation: bool = True
    ) -> dict:
        """Query STIG rule details for ML explainability."""
        if not self._mcp:
            raise RuntimeError("MCP bridge not configured")
        return await self._mcp.call_tool(
            "khepra_query_stig",
            {"stig_id": stig_id, "include_remediation": include_remediation},
        )

    async def export_attestation(
        self, org_id: str, framework: str = "CMMC_L2", fmt: str = "json"
    ) -> dict:
        """Trigger PQC-signed attestation export for C3PAO."""
        if not self._mcp:
            raise RuntimeError("MCP bridge not configured")
        return await self._mcp.call_tool(
            "khepra_export_attestation",
            {"org_id": org_id, "framework": framework, "format": fmt},
        )

    async def get_dag_chain(self, entity_id: str, limit: int = 50) -> dict:
        """Retrieve tamper-evident DAG audit chain."""
        if not self._mcp:
            raise RuntimeError("MCP bridge not configured")
        return await self._mcp.call_tool(
            "khepra_get_dag_chain",
            {"entity_id": entity_id, "limit": limit},
        )

    async def query_threat_intel(
        self, query: str, sources: list[str] | None = None
    ) -> dict:
        """Query threat intelligence for ML feature enrichment."""
        if not self._mcp:
            raise RuntimeError("MCP bridge not configured")
        args: dict[str, Any] = {"query": query}
        if sources:
            args["sources"] = sources
        return await self._mcp.call_tool("khepra_query_threat_intel", args)

    # ── Health ─────────────────────────────────────────────────────────────────

    async def ping(self) -> dict[str, bool]:
        """Check connectivity to Supabase and MCP bridge."""
        supabase_ok = await self._supabase.ping()
        mcp_ok = False
        if self._mcp:
            try:
                tools = await self._mcp.list_tools()
                mcp_ok = len(tools) > 0
            except Exception:
                pass
        return {"supabase": supabase_ok, "mcp_bridge": mcp_ok}

    async def close(self) -> None:
        await self._supabase.close()
        if self._mcp:
            await self._mcp.close()


# ─── FastAPI Integration ────────────────────────────────────────────────────────
# Add these routes to api.py to expose the Supabase MCP integration

MCP_ROUTER_CODE = '''
# Add this to services/ml_anomaly/api.py:

from supabase_mcp import SouHimBouMCPClient

_mcp_client: SouHimBouMCPClient | None = None

def get_mcp_client() -> SouHimBouMCPClient:
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = SouHimBouMCPClient.from_env()
    return _mcp_client


@app.get("/mcp/health")
async def mcp_health():
    """Check Supabase MCP connectivity."""
    client = get_mcp_client()
    status = await client.ping()
    return {"status": "ok" if all(status.values()) else "degraded", **status}


@app.post("/mcp/anomaly")
async def mcp_record_anomaly(body: dict):
    """Record anomaly to Supabase (called after ML inference)."""
    client = get_mcp_client()
    record_id = await client.record_anomaly(
        target_id=body["target_id"],
        anomaly_score=body["anomaly_score"],
        is_anomaly=body["is_anomaly"],
        confidence=body["confidence"],
        archetype_influence=body.get("archetype_influence", {}),
        features=body.get("features", {}),
        session_id=body.get("session_id", ""),
    )
    return {"id": record_id, "status": "recorded"}


@app.post("/mcp/compliance-event")
async def mcp_compliance_event(body: dict):
    """Persist ML-derived compliance finding to Supabase."""
    client = get_mcp_client()
    record_id = await client.record_compliance_event(
        org_id=body["org_id"],
        control_id=body["control_id"],
        framework=body.get("framework", "CMMC_L2"),
        status=body["status"],
        score=body["score"],
        finding_details=body.get("finding_details", {}),
    )
    return {"id": record_id, "status": "recorded"}
'''
