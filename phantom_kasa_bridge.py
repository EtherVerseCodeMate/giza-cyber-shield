#!/usr/bin/env python3
"""
phantom_kasa_bridge.py
──────────────────────
Phantom CounterIntel Node — Intelligence Bridge
NouchiX SecRed Knowledge Inc. | ASAF Edge Sensor Node v1.0

Tails live threat feeds from Suricata, Cowrie, Pi-hole, and AIDE.
Routes structured threat events to KASA Maat Guardian via /agi/chat.
Parses Maat's response and executes Khopesh Blade actions (firewall, remediation).
Records every decision in Seshat Chronicle via /dag/state (Dilithium3 attestation).

Architecture:
    [Suricata eve.json]  ─┐
    [Cowrie cowrie.json] ─┤──► EventParser ──► MaatGateway ──► KhopeshActuator
    [Pi-hole pihole.log] ─┤                        │                    │
    [AIDE check.log]     ─┘                        ▼                    ▼
                                          Seshat DAG Record      iptables/remediation
                                          (Dilithium3 signed)

Run: systemd unit phantom-bridge.service
     or: python3 phantom_kasa_bridge.py
"""

import json
import logging
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Thread, Lock
from typing import Optional
import requests

# ── Configuration ─────────────────────────────────────────────────────────────
KASA_URL         = os.getenv("KASA_URL", "http://127.0.0.1:45444")
KASA_TIMEOUT     = int(os.getenv("KASA_TIMEOUT", "10"))
POLL_INTERVAL    = float(os.getenv("POLL_INTERVAL", "2.0"))   # seconds between tail cycles
MAX_EVENTS_BURST = int(os.getenv("MAX_EVENTS_BURST", "10"))   # max events per cycle (Pi 2B throttle)
ENABLE_ACTUATOR  = os.getenv("ENABLE_ACTUATOR", "true").lower() == "true"
LOG_LEVEL        = os.getenv("LOG_LEVEL", "INFO")

FEEDS = {
    "suricata": Path(os.getenv("PHANTOM_SURICATA_LOG", "/var/log/suricata/eve.json")),
    "cowrie":   Path(os.getenv("PHANTOM_COWRIE_LOG",   "/var/log/cowrie/cowrie.json")),
    "pihole":   Path(os.getenv("PHANTOM_PIHOLE_LOG",   "/var/log/pihole/pihole.log")),
    "aide":     Path(os.getenv("PHANTOM_AIDE_LOG",     "/var/log/aide/aide_check.log")),
}

BRIDGE_LOG = Path("/var/log/khepra/phantom_bridge.log")
DAG_LOG    = Path("/var/log/khepra/dag_attestations.jsonl")

# Severity thresholds — only send HIGH+ to Maat to conserve Pi 2B CPU
SEVERITY_THRESHOLD = os.getenv("SEVERITY_THRESHOLD", "MEDIUM")
SEVERITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# ── Logging ───────────────────────────────────────────────────────────────────
BRIDGE_LOG.parent.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(BRIDGE_LOG)),
    ],
)
log = logging.getLogger("phantom-bridge")

# ── Data Models ───────────────────────────────────────────────────────────────
@dataclass
class ThreatEvent:
    source:     str           # suricata | cowrie | pihole | aide
    sensor:     str           # Wedjat Eye label
    severity:   str           # LOW | MEDIUM | HIGH | CRITICAL
    event_type: str           # alert | login_attempt | dns_query | fim_change
    src_ip:     Optional[str]
    dst_ip:     Optional[str]
    dst_port:   Optional[int]
    message:    str
    raw:        dict = field(default_factory=dict)
    timestamp:  str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class MaatDecision:
    action:        str        # BLOCK | REMEDIATE | MONITOR | ESCALATE | IGNORE
    target_ip:     Optional[str]
    confidence:    float      # 0.0 – 1.0
    reasoning:     str
    blade:         str        # Khopesh blade: firewall | remediation | monitor | escalate
    pqc_attested:  bool = False
    dag_entry_id:  Optional[str] = None
    timestamp:     str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ── Log Tailer ────────────────────────────────────────────────────────────────
class LogTailer:
    """Stateful log file tailer — tracks byte offset per feed."""

    def __init__(self, path: Path, name: str):
        self.path    = path
        self.name    = name
        self._offset = 0
        self._inode  = None
        self._lock   = Lock()

    def read_new_lines(self) -> list[str]:
        if not self.path.exists():
            return []
        try:
            stat = self.path.stat()
            with self._lock:
                # Detect log rotation (inode change or file shrink)
                if self._inode != stat.st_ino or stat.st_size < self._offset:
                    log.debug(f"[{self.name}] Log rotated — resetting offset")
                    self._offset = 0
                    self._inode  = stat.st_ino

                if stat.st_size == self._offset:
                    return []

                with open(self.path, "r", errors="replace") as f:
                    f.seek(self._offset)
                    lines = f.readlines()
                    self._offset = f.tell()

                return [ln.rstrip("\n") for ln in lines if ln.strip()]
        except (OSError, PermissionError) as e:
            log.warning(f"[{self.name}] Read error: {e}")
            return []

# ── Event Parsers ─────────────────────────────────────────────────────────────
class SuricataParser:
    """Parses Suricata EVE JSON stream — feeds Wedjat/Vuln sensor."""

    SEVERITY_MAP = {1: "CRITICAL", 2: "HIGH", 3: "MEDIUM", 4: "LOW"}

    def parse(self, line: str) -> Optional[ThreatEvent]:
        try:
            evt = json.loads(line)
        except json.JSONDecodeError:
            return None

        if evt.get("event_type") != "alert":
            return None

        alert    = evt.get("alert", {})
        priority = alert.get("severity", 4)
        severity = self.SEVERITY_MAP.get(priority, "LOW")

        return ThreatEvent(
            source     = "suricata",
            sensor     = "Wedjat/Vuln",
            severity   = severity,
            event_type = "alert",
            src_ip     = evt.get("src_ip"),
            dst_ip     = evt.get("dest_ip"),
            dst_port   = evt.get("dest_port"),
            message    = (
                f"[SURICATA] {alert.get('signature', 'Unknown alert')} "
                f"| Category: {alert.get('category', 'N/A')} "
                f"| {evt.get('src_ip')}:{evt.get('src_port')} → "
                f"{evt.get('dest_ip')}:{evt.get('dest_port')}"
            ),
            raw = evt,
        )

class CowrieParser:
    """Parses Cowrie JSON log stream — honeypot intel."""

    HIGH_EVENTS = {
        "cowrie.login.failed", "cowrie.login.success",
        "cowrie.session.connect", "cowrie.command.input",
        "cowrie.session.file_download",
    }

    def parse(self, line: str) -> Optional[ThreatEvent]:
        try:
            evt = json.loads(line)
        except json.JSONDecodeError:
            return None

        event_id = evt.get("eventid", "")
        if event_id not in self.HIGH_EVENTS:
            return None

        severity = "CRITICAL" if "success" in event_id or "file_download" in event_id \
                   else "HIGH"   if "command" in event_id \
                   else "MEDIUM"

        return ThreatEvent(
            source     = "cowrie",
            sensor     = "Wedjat/Drift",
            severity   = severity,
            event_type = event_id,
            src_ip     = evt.get("src_ip"),
            dst_ip     = None,
            dst_port   = evt.get("dst_port"),
            message    = (
                f"[HONEYPOT] {event_id} "
                f"| Attacker: {evt.get('src_ip')} "
                f"| User: {evt.get('username', 'N/A')} "
                f"| {evt.get('message', '')}"
            ),
            raw = evt,
        )

class PiholeParser:
    """Parses Pi-hole DNS query log — C2 beacon / domain intel."""

    # Regex for Pi-hole log format: "mmm dd HH:MM:SS dnsmasq[pid]: TYPE domain FROM/TO ip"
    LOG_RE = re.compile(
        r"(?P<ts>\w+\s+\d+\s[\d:]+)\s\S+\s"
        r"(?P<type>query|reply|blocked)\[.*?\]\s"
        r"(?P<domain>\S+)\s(?:from|to)\s(?P<ip>[\d.]+)"
    )

    SUSPICIOUS_TLDS = {".ru", ".cn", ".tk", ".top", ".xyz", ".pw", ".cc"}
    SUSPICIOUS_PATTERNS = [
        re.compile(r"[a-z0-9]{20,}\."),                    # long random subdomain
        re.compile(r"\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}"),  # IP-in-hostname
        re.compile(r"(base64|cmd|shell|exec|powershell)", re.I),
    ]

    def parse(self, line: str) -> Optional[ThreatEvent]:
        m = self.LOG_RE.search(line)
        if not m:
            return None

        qtype  = m.group("type")
        domain = m.group("domain")
        src_ip = m.group("ip")

        if qtype == "blocked":
            return ThreatEvent(
                source     = "pihole",
                sensor     = "Wedjat/Drift",
                severity   = "HIGH",
                event_type = "dns_blocked",
                src_ip     = src_ip,
                dst_ip     = None,
                dst_port   = 53,
                message    = f"[DNS-SINKHOLE] Blocked domain: {domain} | Requestor: {src_ip}",
                raw        = {"domain": domain, "src_ip": src_ip},
            )

        if qtype == "query":
            severity = "LOW"
            reasons  = []

            tld = "." + domain.split(".")[-1] if "." in domain else ""
            if tld.lower() in self.SUSPICIOUS_TLDS:
                severity = "MEDIUM"
                reasons.append(f"suspicious TLD: {tld}")

            for pat in self.SUSPICIOUS_PATTERNS:
                if pat.search(domain):
                    severity = "HIGH"
                    reasons.append("suspicious domain pattern")
                    break

            if severity == "LOW":
                return None  # Don't flood Maat with benign queries

            return ThreatEvent(
                source     = "pihole",
                sensor     = "Wedjat/Drift",
                severity   = severity,
                event_type = "dns_suspicious",
                src_ip     = src_ip,
                dst_ip     = None,
                dst_port   = 53,
                message    = (
                    f"[DNS-INTEL] Suspicious query: {domain} "
                    f"| From: {src_ip} | Flags: {', '.join(reasons)}"
                ),
                raw = {"domain": domain, "src_ip": src_ip, "flags": reasons},
            )

        return None

class AideParser:
    """Parses AIDE FIM output — feeds Wedjat/FIM sensor."""

    CHANGE_RE = re.compile(r"^(changed|added|removed):\s+(.+)$", re.I)

    def parse(self, line: str) -> Optional[ThreatEvent]:
        m = self.CHANGE_RE.match(line.strip())
        if not m:
            return None

        change_type = m.group(1).upper()
        filepath    = m.group(2).strip()

        # Critical paths get HIGH, others MEDIUM
        critical = any(filepath.startswith(p) for p in [
            "/usr/local/bin", "/bin", "/sbin", "/usr/bin",
            "/etc/sudoers", "/etc/passwd", "/etc/shadow",
            "/opt/khepra", "/etc/khepra",
        ])

        severity = "HIGH" if critical else "MEDIUM"

        return ThreatEvent(
            source     = "aide",
            sensor     = "Wedjat/FIM",
            severity   = severity,
            event_type = f"fim_{change_type.lower()}",
            src_ip     = None,
            dst_ip     = None,
            dst_port   = None,
            message    = (
                f"[FIM] File {change_type}: {filepath}"
                + (" [CRITICAL PATH]" if critical else "")
            ),
            raw = {"change": change_type, "path": filepath},
        )

# ── KASA Gateway ──────────────────────────────────────────────────────────────
class MaatGateway:
    """Submits threat events to KASA Maat Guardian and parses decisions."""

    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout  = timeout
        self.session  = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def health_check(self) -> bool:
        try:
            r = self.session.get(f"{self.base_url}/healthz", timeout=5)
            return r.status_code == 200
        except requests.RequestException:
            return False

    def send_threat(self, event: ThreatEvent) -> Optional[MaatDecision]:
        """
        Post threat event to /agi/chat.
        Maat Guardian returns an action decision.
        """
        prompt = self._build_prompt(event)
        try:
            r = self.session.post(
                f"{self.base_url}/agi/chat",
                json={"message": prompt},
                timeout=self.timeout,
            )
            r.raise_for_status()
            return self._parse_decision(r.json(), event)
        except requests.RequestException as e:
            log.warning(f"Maat gateway error: {e}")
            return None

    def get_dag_state(self) -> dict:
        try:
            r = self.session.get(f"{self.base_url}/dag/state", timeout=5)
            return r.json() if r.ok else {}
        except requests.RequestException:
            return {}

    def get_agi_state(self) -> dict:
        try:
            r = self.session.get(f"{self.base_url}/agi/state", timeout=5)
            return r.json() if r.ok else {}
        except requests.RequestException:
            return {}

    def _build_prompt(self, event: ThreatEvent) -> str:
        return (
            f"PHANTOM NODE THREAT EVENT\n"
            f"Sensor: {event.sensor}\n"
            f"Severity: {event.severity}\n"
            f"Type: {event.event_type}\n"
            f"Source IP: {event.src_ip or 'N/A'}\n"
            f"Destination: {event.dst_ip or 'N/A'}:{event.dst_port or 'N/A'}\n"
            f"Message: {event.message}\n"
            f"Timestamp: {event.timestamp}\n\n"
            f"Recommended Khopesh Blade action? "
            f"Options: BLOCK_IP | REMEDIATE | MONITOR | ESCALATE | IGNORE\n"
            f"Respond with JSON: {{\"action\": \"...\", \"confidence\": 0.0-1.0, \"reasoning\": \"...\"}}"
        )

    def _parse_decision(self, response: dict, event: ThreatEvent) -> MaatDecision:
        """Parse Maat Guardian's response into a structured decision."""
        # Try to extract JSON from the response text
        text = ""
        if isinstance(response, dict):
            text = response.get("response", response.get("message", str(response)))

        try:
            # Strip markdown code fences if present
            clean = re.sub(r"```(?:json)?|```", "", text).strip()
            parsed = json.loads(clean)
            action     = parsed.get("action", "MONITOR").upper()
            confidence = float(parsed.get("confidence", 0.5))
            reasoning  = parsed.get("reasoning", "No reasoning provided")
        except (json.JSONDecodeError, ValueError):
            # Fallback: parse action keyword from text
            action     = "MONITOR"
            confidence = 0.5
            reasoning  = text[:200] if text else "Parse error"
            for kw in ["BLOCK_IP", "BLOCK", "REMEDIATE", "ESCALATE", "IGNORE"]:
                if kw in text.upper():
                    action = kw
                    break

        blade_map = {
            "BLOCK_IP":  "firewall",
            "BLOCK":     "firewall",
            "REMEDIATE": "remediation",
            "MONITOR":   "monitor",
            "ESCALATE":  "escalate",
            "IGNORE":    "monitor",
        }

        return MaatDecision(
            action     = action,
            target_ip  = event.src_ip,
            confidence = confidence,
            reasoning  = reasoning,
            blade      = blade_map.get(action, "monitor"),
        )

# ── Khopesh Actuator ──────────────────────────────────────────────────────────
class KhopeshActuator:
    """
    Executes Maat Guardian decisions via the appropriate Khopesh Blade.
    Blades available on Pi 2B edge node:
      - firewall:    iptables block rule
      - remediation: service restart / config repair
      - monitor:     enhanced logging
      - escalate:    syslog alert + notification
    """

    BLOCKED_IPS: set = set()
    _lock = Lock()

    def execute(self, decision: MaatDecision, event: ThreatEvent) -> bool:
        if not ENABLE_ACTUATOR:
            log.info(f"[ACTUATOR DISABLED] Would execute: {decision.action} on {decision.target_ip}")
            return True

        if decision.confidence < 0.6:
            log.info(f"[LOW CONFIDENCE {decision.confidence:.2f}] Skipping action: {decision.action}")
            return False

        blade = decision.blade
        log.info(f"[KHOPESH/{blade.upper()}] Executing {decision.action} on {decision.target_ip} (confidence={decision.confidence:.2f})")

        if blade == "firewall" and decision.target_ip:
            return self._blade_firewall(decision.target_ip, event)
        elif blade == "remediation":
            return self._blade_remediation(event)
        elif blade == "escalate":
            return self._blade_escalate(decision, event)
        else:
            return self._blade_monitor(decision, event)

    def _blade_firewall(self, ip: str, event: ThreatEvent) -> bool:
        """Khopesh/Firewall — iptables DROP rule with audit trail."""
        with self._lock:
            if ip in self.BLOCKED_IPS:
                log.debug(f"[FIREWALL] {ip} already blocked")
                return True
            try:
                # Validate IP format first
                import ipaddress
                ipaddress.ip_address(ip)

                subprocess.run(
                    ["iptables", "-I", "INPUT", "1", "-s", ip, "-j", "DROP",
                     "-m", "comment", "--comment", f"KASA-MAAT-{int(time.time())}"],
                    check=True, capture_output=True, timeout=5
                )
                self.BLOCKED_IPS.add(ip)
                subprocess.run(["iptables-save"], stdout=open("/etc/iptables/rules.v4", "w"),
                               check=True, timeout=5)
                log.warning(f"[FIREWALL] ✓ BLOCKED: {ip} | Reason: {event.message[:80]}")
                return True
            except (subprocess.CalledProcessError, ValueError, OSError) as e:
                log.error(f"[FIREWALL] iptables error: {e}")
                return False

    def _blade_remediation(self, event: ThreatEvent) -> bool:
        """Khopesh/Remediation — service restart for FIM/config drift events."""
        if event.source == "aide" and "/opt/khepra" in event.message:
            log.warning("[REMEDIATION] KASA binary tampered — triggering integrity check")
            try:
                subprocess.run(
                    ["systemctl", "restart", "kasa-agent"],
                    check=True, capture_output=True, timeout=10
                )
                return True
            except subprocess.CalledProcessError as e:
                log.error(f"[REMEDIATION] Restart failed: {e}")
        return False

    def _blade_escalate(self, decision: MaatDecision, event: ThreatEvent) -> bool:
        """Khopesh/Escalate — high-priority syslog + structured alert."""
        alert_msg = (
            f"PHANTOM-ESCALATION "
            f"node=phantom-node-01 "
            f"sensor={event.sensor} "
            f"severity={event.severity} "
            f"src_ip={event.src_ip} "
            f"action={decision.action} "
            f"confidence={decision.confidence:.2f} "
            f"msg={event.message[:120]}"
        )
        log.critical(f"[ESCALATE] {alert_msg}")
        try:
            subprocess.run(
                ["logger", "-p", "security.crit", "-t", "PHANTOM-KASA", alert_msg],
                check=True, timeout=5
            )
        except Exception:
            pass
        return True

    def _blade_monitor(self, decision: MaatDecision, event: ThreatEvent) -> bool:
        """Khopesh/Monitor — enhanced structured logging only."""
        log.info(f"[MONITOR] {event.sensor} | {event.severity} | {event.message[:100]}")
        return True

# ── Seshat DAG Recorder ───────────────────────────────────────────────────────
class SeshatChronicle:
    """
    Records every Maat decision as a DAG entry in the Seshat Chronicle.
    These are Dilithium3-signed by the KASA agent — this class writes
    the pre-attestation record and reads back the signed entry ID.
    """

    def __init__(self, dag_log: Path, maat: MaatGateway):
        self.dag_log = dag_log
        self.maat    = maat
        dag_log.parent.mkdir(parents=True, exist_ok=True)

    def record(self, event: ThreatEvent, decision: MaatDecision) -> str:
        """Write DAG entry and return entry ID."""
        entry = {
            "schema":    "phantom-dag-v1",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "node":      "phantom-node-01",
            "event":     asdict(event),
            "decision":  asdict(decision),
            "pqc": {
                "algorithm": "Dilithium3",
                "status":    "pending",  # KASA daemon signs asynchronously
                "note":      "Seshat Chronicle will attest via Dilithium3 on next Ouroboros cycle",
            },
        }

        # Write to local JSONL log (pre-attestation)
        with open(self.dag_log, "a") as f:
            f.write(json.dumps(entry) + "\n")

        # Fetch DAG state to confirm entry was recorded by KASA
        dag_state = self.maat.get_dag_state()
        entry_id  = dag_state.get("latest_id", f"local-{int(time.time())}")

        log.debug(f"[SESHAT] DAG entry recorded: {entry_id}")
        return entry_id

# ── Main Bridge Loop ──────────────────────────────────────────────────────────
class PhantomBridge:
    """
    Main intelligence bridge — ties all components together.
    Runs as a daemon, processing threat feeds and routing to KASA.
    """

    def __init__(self):
        self.maat     = MaatGateway(KASA_URL, KASA_TIMEOUT)
        self.actuator = KhopeshActuator()
        self.seshat   = SeshatChronicle(DAG_LOG, self.maat)
        self.tailers  = {
            "suricata": LogTailer(FEEDS["suricata"], "suricata"),
            "cowrie":   LogTailer(FEEDS["cowrie"],   "cowrie"),
            "pihole":   LogTailer(FEEDS["pihole"],   "pihole"),
            "aide":     LogTailer(FEEDS["aide"],     "aide"),
        }
        self.parsers  = {
            "suricata": SuricataParser(),
            "cowrie":   CowrieParser(),
            "pihole":   PiholeParser(),
            "aide":     AideParser(),
        }
        self._severity_idx = SEVERITY_ORDER.index(SEVERITY_THRESHOLD)

    def _severity_meets_threshold(self, severity: str) -> bool:
        try:
            return SEVERITY_ORDER.index(severity) >= self._severity_idx
        except ValueError:
            return False

    def _wait_for_kasa(self, max_wait: int = 60) -> bool:
        """Block until KASA agent is responsive."""
        log.info(f"Waiting for KASA agent at {KASA_URL}...")
        for i in range(max_wait):
            if self.maat.health_check():
                log.info(f"  ✓ KASA agent responding (waited {i}s)")
                return True
            time.sleep(1)
        log.error(f"KASA agent not responding after {max_wait}s")
        return False

    def run(self):
        log.info("═══════════════════════════════════════════════════")
        log.info("  PHANTOM KASA BRIDGE STARTING")
        log.info(f"  KASA:      {KASA_URL}")
        log.info(f"  Threshold: {SEVERITY_THRESHOLD}+")
        log.info(f"  Actuator:  {'ENABLED' if ENABLE_ACTUATOR else 'DISABLED (dry run)'}")
        log.info("═══════════════════════════════════════════════════")

        if not self._wait_for_kasa(max_wait=120):
            log.error("Cannot reach KASA — bridge will run in log-only mode")

        log.info("Monitoring feeds:")
        for name, path in FEEDS.items():
            exists = "✓" if path.exists() else "⚠ (not yet)"
            log.info(f"  {exists} {name}: {path}")

        events_processed = 0
        cycle = 0

        while True:
            cycle += 1
            cycle_events = []

            for feed_name, tailer in self.tailers.items():
                parser = self.parsers[feed_name]
                lines  = tailer.read_new_lines()

                for line in lines[:MAX_EVENTS_BURST]:
                    try:
                        event = parser.parse(line)
                    except Exception as e:
                        log.debug(f"[{feed_name}] Parse error: {e}")
                        continue

                    if event and self._severity_meets_threshold(event.severity):
                        cycle_events.append(event)

            # Process events — throttled for Pi 2B
            for event in cycle_events[:MAX_EVENTS_BURST]:
                try:
                    self._process_event(event)
                    events_processed += 1
                except Exception as e:
                    log.error(f"Event processing error: {e}")

            # Status log every 5 minutes
            if cycle % int(300 / POLL_INTERVAL) == 0:
                dag = self.maat.get_dag_state()
                log.info(
                    f"[STATUS] cycle={cycle} events_total={events_processed} "
                    f"blocked_ips={len(KhopeshActuator.BLOCKED_IPS)} "
                    f"dag_entries={dag.get('entries', '?')}"
                )

            time.sleep(POLL_INTERVAL)

    def _process_event(self, event: ThreatEvent):
        log.info(
            f"[{event.sensor}] [{event.severity}] {event.event_type} "
            f"src={event.src_ip or 'N/A'} | {event.message[:80]}"
        )

        decision = self.maat.send_threat(event)
        if not decision:
            log.warning(f"  Maat returned no decision — defaulting to MONITOR")
            decision = MaatDecision(
                action="MONITOR", target_ip=event.src_ip,
                confidence=0.5, reasoning="Maat unavailable", blade="monitor"
            )

        log.info(
            f"  → Maat: {decision.action} "
            f"[{decision.blade}] "
            f"confidence={decision.confidence:.2f} "
            f"| {decision.reasoning[:60]}"
        )

        # Execute Khopesh Blade
        self.actuator.execute(decision, event)

        # Record in Seshat Chronicle (Dilithium3 attestation)
        entry_id = self.seshat.record(event, decision)
        log.debug(f"  → Seshat DAG: {entry_id}")


# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    bridge = PhantomBridge()
    try:
        bridge.run()
    except KeyboardInterrupt:
        log.info("Bridge stopped by operator")
        sys.exit(0)
    except Exception as e:
        log.critical(f"Bridge fatal error: {e}", exc_info=True)
        sys.exit(1)
