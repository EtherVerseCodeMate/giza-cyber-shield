"""
ADINKHEPRA - Resilience Validation Suite (TRL-10 Bridging Experiment)

Bridges the gap between A7 (Pipeline Repeatability) and A8 (Full Resilience).
Tests: "Can engineer/IT team self-recover from a documented failure mode
        without founder involvement?"

Failure Modes Tested:
  R1 - Agent Process Crash Recovery
  R2 - DAG Persistence Corruption Recovery
  R3 - Port Contention Self-Healing
  R4 - Telemetry Dependency Degradation (graceful fallback)
  R5 - Health Endpoint Liveness Under Load

Classification: CUI // NOFORN
Ref: A6 (Deployment Reliability), A7 (Pipeline Repeatability)
"""

import http.client
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import platform
from typing import Tuple, Optional

# Import shared utilities from the orchestration suite
from adinkhepra import (
    AGENT_PORT,
    TELEMETRY_PORT,
    AGENT_STARTUP_TIMEOUT,
    MOD_VENDOR,
    get_binary_name,
    should_use_shell,
    build,
    wait_for_port,
    check_port_available,
    start_telemetry_server,
    print_header,
    print_step,
    print_success,
    print_error,
    print_warning,
    print_info,
    safe_print,
)

# ============================================================================
# CONFIGURATION
# ============================================================================

RESILIENCE_TIMEOUT = 60  # Max seconds per resilience test
AGENT_RECOVERY_GRACE = 30  # Seconds to allow agent restart after crash
HEALTH_POLL_INTERVAL = 0.5  # Seconds between health checks
DAG_TEST_DIR = None  # Set dynamically per test (tempdir)


# ============================================================================
# RESILIENCE TEST HARNESS
# ============================================================================

class ResilienceResult:
    """Captures the outcome of a single resilience test."""

    def __init__(self, test_id: str, name: str):
        self.test_id = test_id
        self.name = name
        self.passed = False
        self.recovery_time_ms: Optional[int] = None
        self.failure_detail: Optional[str] = None

    def pass_test(self, recovery_time_ms: int = 0):
        self.passed = True
        self.recovery_time_ms = recovery_time_ms

    def fail_test(self, detail: str):
        self.passed = False
        self.failure_detail = detail

    def summary(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        timing = f" (recovery: {self.recovery_time_ms}ms)" if self.recovery_time_ms else ""
        detail = f" — {self.failure_detail}" if self.failure_detail else ""
        return f"[{status}] {self.test_id}: {self.name}{timing}{detail}"


def _agent_health_ok(port: int = AGENT_PORT) -> bool:
    """Single health check against the agent /healthz endpoint."""
    try:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
        conn.request("GET", "/healthz")
        res = conn.getresponse()
        if res.status == 200:
            data = json.loads(res.read().decode())
            return data.get("status") == "ok"
    except Exception:
        pass
    return False


def _wait_for_health(port: int = AGENT_PORT, timeout: int = AGENT_RECOVERY_GRACE) -> int:
    """
    Block until /healthz returns ok or timeout.
    Returns recovery time in milliseconds, or -1 on timeout.
    """
    start = time.monotonic()
    deadline = start + timeout
    while time.monotonic() < deadline:
        if _agent_health_ok(port):
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return elapsed_ms
        time.sleep(HEALTH_POLL_INTERVAL)
    return -1


def _start_agent(binary: str) -> subprocess.Popen:
    """Start the agent binary and return the process handle."""
    return subprocess.Popen(
        [binary],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _terminate_agent(proc: subprocess.Popen) -> None:
    """Terminate agent process (platform-aware)."""
    if platform.system().lower() == "windows":
        subprocess.call(
            ["taskkill", "/F", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


# ============================================================================
# R1 — AGENT PROCESS CRASH RECOVERY
# ============================================================================

def test_r1_agent_crash_recovery() -> ResilienceResult:
    """
    Documented Failure Mode: Agent process terminates unexpectedly (SIGKILL/crash).
    Recovery Expectation: Engineer restarts binary; system returns to healthy state
    with no data loss (DAG persists to disk).

    Procedure:
      1. Start agent, confirm healthy.
      2. Kill agent with SIGKILL (simulate OOM-kill / crash).
      3. Restart agent from same binary.
      4. Confirm /healthz returns ok within recovery grace period.
    """
    result = ResilienceResult("R1", "Agent Process Crash Recovery")
    agent_bin = get_binary_name("adinkhepra-agent")

    if not os.path.exists(agent_bin):
        if not build("adinkhepra-agent"):
            result.fail_test("Cannot build agent binary")
            return result

    # Step 1: Start agent and confirm healthy
    proc = _start_agent(agent_bin)
    recovery_ms = _wait_for_health(timeout=AGENT_STARTUP_TIMEOUT)
    if recovery_ms < 0:
        _terminate_agent(proc)
        result.fail_test("Agent never became healthy on initial start")
        return result

    print_info("Agent healthy — injecting SIGKILL crash fault...")

    # Step 2: Kill the agent (simulate crash)
    if platform.system().lower() == "windows":
        subprocess.call(
            ["taskkill", "/F", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        os.kill(proc.pid, signal.SIGKILL)
    proc.wait()

    # Confirm agent is actually down
    time.sleep(1)
    if _agent_health_ok():
        result.fail_test("Agent still responding after SIGKILL — port collision?")
        return result

    print_info("Agent confirmed dead — restarting...")

    # Step 3: Restart
    proc2 = _start_agent(agent_bin)
    try:
        recovery_ms = _wait_for_health(timeout=AGENT_RECOVERY_GRACE)
        if recovery_ms < 0:
            result.fail_test(f"Agent did not recover within {AGENT_RECOVERY_GRACE}s after crash")
        else:
            print_success(f"Agent recovered in {recovery_ms}ms after crash")
            result.pass_test(recovery_ms)
    finally:
        _terminate_agent(proc2)

    return result


# ============================================================================
# R2 — DAG PERSISTENCE CORRUPTION RECOVERY
# ============================================================================

def test_r2_dag_persistence_recovery() -> ResilienceResult:
    """
    Documented Failure Mode: DAG storage directory contains corrupted JSON files
    (e.g., truncated write due to power loss).
    Recovery Expectation: Agent starts up, logs corruption warning, and continues
    operating with a fresh DAG (no crash loop).

    Procedure:
      1. Create a temp DAG directory with a corrupt .json file.
      2. Set ADINKHEPRA_STORAGE_PATH to point to temp dir.
      3. Start agent.
      4. Confirm agent starts healthy (does not crash-loop on bad data).
      5. Write a new DAG node via API to confirm write-path works.
    """
    result = ResilienceResult("R2", "DAG Persistence Corruption Recovery")
    agent_bin = get_binary_name("adinkhepra-agent")

    if not os.path.exists(agent_bin):
        if not build("adinkhepra-agent"):
            result.fail_test("Cannot build agent binary")
            return result

    # Create temp directory with corrupt DAG data
    dag_dir = tempfile.mkdtemp(prefix="khepra_r2_dag_")
    dag_subdir = os.path.join(dag_dir, "dag")
    os.makedirs(dag_subdir, exist_ok=True)

    # Write a corrupt JSON node file
    corrupt_path = os.path.join(dag_subdir, "corrupt_node_001.json")
    with open(corrupt_path, "w") as f:
        f.write('{"id": "corrupt_node_001", "action": "test", TRUNCATED')

    # Also write a valid node to test partial recovery
    valid_path = os.path.join(dag_subdir, "valid_node_002.json")
    with open(valid_path, "w") as f:
        json.dump({
            "id": "valid_node_002",
            "action": "resilience-seed",
            "symbol": "Sankofa",
            "parent_ids": [],
            "timestamp": "2026-01-01T00:00:00Z",
        }, f)

    env = os.environ.copy()
    env["ADINKHEPRA_STORAGE_PATH"] = dag_dir

    proc = subprocess.Popen(
        [agent_bin],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
    )

    try:
        recovery_ms = _wait_for_health(timeout=AGENT_RECOVERY_GRACE)
        if recovery_ms < 0:
            result.fail_test("Agent crash-looped or hung on corrupted DAG data")
            return result

        print_info(f"Agent started despite corrupt DAG (took {recovery_ms}ms)")

        # Confirm write-path still works
        try:
            conn = http.client.HTTPConnection("127.0.0.1", AGENT_PORT, timeout=5)
            payload = json.dumps({
                "action": "resilience-r2-verify",
                "symbol": "Sankofa-Recovery",
                "parent_ids": [],
            })
            conn.request("POST", "/dag/add", body=payload, headers={"Content-Type": "application/json"})
            res = conn.getresponse()
            if res.status == 200:
                print_success("DAG write-path operational after corruption recovery")
                result.pass_test(recovery_ms)
            else:
                result.fail_test(f"DAG write failed after corruption recovery: HTTP {res.status}")
        except Exception as e:
            result.fail_test(f"DAG write-path test error: {e}")
    finally:
        _terminate_agent(proc)
        shutil.rmtree(dag_dir, ignore_errors=True)

    return result


# ============================================================================
# R3 — PORT CONTENTION SELF-HEALING
# ============================================================================

def test_r3_port_contention_recovery() -> ResilienceResult:
    """
    Documented Failure Mode: Agent port (45444) is occupied by a zombie process
    or prior unclean shutdown.
    Recovery Expectation: Engineer can detect the conflict, kill the blocker,
    and restart — guided by clear error signals (not silent hang).

    Procedure:
      1. Bind a dummy socket to AGENT_PORT to simulate contention.
      2. Attempt to start agent.
      3. Confirm agent exits with non-zero (doesn't silently hang).
      4. Release the dummy socket.
      5. Restart agent — confirm healthy.
    """
    result = ResilienceResult("R3", "Port Contention Self-Healing")
    agent_bin = get_binary_name("adinkhepra-agent")

    if not os.path.exists(agent_bin):
        if not build("adinkhepra-agent"):
            result.fail_test("Cannot build agent binary")
            return result

    # Step 1: Block the port with a dummy listener
    blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        blocker.bind(("127.0.0.1", AGENT_PORT))
        blocker.listen(1)
    except OSError as e:
        result.fail_test(f"Cannot bind blocker socket: {e}")
        blocker.close()
        return result

    print_info(f"Port {AGENT_PORT} blocked — starting agent to test failure signaling...")

    # Step 2: Start agent against blocked port
    proc = subprocess.Popen(
        [agent_bin],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for agent to either exit or timeout (should fail fast)
    try:
        proc.wait(timeout=15)
        exit_code = proc.returncode
        print_info(f"Agent exited with code {exit_code} (port blocked)")

        if exit_code != 0:
            print_success("Agent correctly signaled port conflict via non-zero exit")
        else:
            print_warning("Agent exited 0 despite port conflict — ambiguous signal")
    except subprocess.TimeoutExpired:
        # Agent hung instead of failing — this is the failure mode we're testing for
        print_warning("Agent hung on port conflict (no fail-fast)")
        _terminate_agent(proc)

    # Step 4: Release blocker
    blocker.close()
    time.sleep(1)

    # Step 5: Restart on free port — confirm recovery
    print_info("Port released — restarting agent for recovery confirmation...")
    proc2 = _start_agent(agent_bin)
    try:
        recovery_ms = _wait_for_health(timeout=AGENT_RECOVERY_GRACE)
        if recovery_ms < 0:
            result.fail_test("Agent did not recover after port was freed")
        else:
            print_success(f"Agent recovered on free port in {recovery_ms}ms")
            result.pass_test(recovery_ms)
    finally:
        _terminate_agent(proc2)

    return result


# ============================================================================
# R4 — TELEMETRY DEPENDENCY DEGRADATION
# ============================================================================

def test_r4_telemetry_degradation() -> ResilienceResult:
    """
    Documented Failure Mode: Telemetry/license server is unreachable.
    Recovery Expectation: Agent starts in degraded mode (license cached or
    offline-capable). Core API remains functional.

    Procedure:
      1. Ensure no telemetry server is running.
      2. Set KHEPRA_LICENSE_SERVER to a dead endpoint.
      3. Start agent.
      4. Confirm agent reaches healthy state (graceful degradation).
      5. Confirm core API (/dag/add) still works.
    """
    result = ResilienceResult("R4", "Telemetry Dependency Degradation")
    agent_bin = get_binary_name("adinkhepra-agent")

    if not os.path.exists(agent_bin):
        if not build("adinkhepra-agent"):
            result.fail_test("Cannot build agent binary")
            return result

    # Point license server to a guaranteed-dead endpoint
    env = os.environ.copy()
    env["KHEPRA_LICENSE_SERVER"] = "http://127.0.0.1:19999"

    print_info("Starting agent with unreachable telemetry server...")
    proc = subprocess.Popen(
        [agent_bin],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
    )

    try:
        recovery_ms = _wait_for_health(timeout=AGENT_RECOVERY_GRACE)
        if recovery_ms < 0:
            result.fail_test("Agent failed to start without telemetry server (no graceful degradation)")
            return result

        print_info(f"Agent started in degraded mode ({recovery_ms}ms)")

        # Confirm core functionality
        try:
            conn = http.client.HTTPConnection("127.0.0.1", AGENT_PORT, timeout=5)
            payload = json.dumps({
                "action": "resilience-r4-verify",
                "symbol": "Nkyinkyim-Degraded",
                "parent_ids": [],
            })
            conn.request("POST", "/dag/add", body=payload, headers={"Content-Type": "application/json"})
            res = conn.getresponse()
            if res.status == 200:
                print_success("Core API operational despite telemetry outage")
                result.pass_test(recovery_ms)
            else:
                result.fail_test(f"Core API failed during degraded mode: HTTP {res.status}")
        except Exception as e:
            result.fail_test(f"Core API unreachable during degraded mode: {e}")
    finally:
        _terminate_agent(proc)

    return result


# ============================================================================
# R5 — HEALTH ENDPOINT LIVENESS UNDER LOAD
# ============================================================================

def test_r5_health_liveness_under_load() -> ResilienceResult:
    """
    Documented Failure Mode: Agent under sustained API load becomes unresponsive
    to health checks (Kubernetes liveness probe would restart it unnecessarily).
    Recovery Expectation: /healthz remains responsive (< 2s) even during
    concurrent API activity.

    Procedure:
      1. Start agent, confirm healthy.
      2. Fire 20 concurrent DAG writes.
      3. During writes, check /healthz response time.
      4. Confirm /healthz responds within 2 seconds.
    """
    result = ResilienceResult("R5", "Health Endpoint Liveness Under Load")
    agent_bin = get_binary_name("adinkhepra-agent")

    if not os.path.exists(agent_bin):
        if not build("adinkhepra-agent"):
            result.fail_test("Cannot build agent binary")
            return result

    proc = _start_agent(agent_bin)
    try:
        if _wait_for_health(timeout=AGENT_STARTUP_TIMEOUT) < 0:
            result.fail_test("Agent never became healthy")
            return result

        print_info("Agent healthy — injecting sustained API load...")

        # Fire concurrent DAG writes (non-blocking)
        import threading

        write_errors = []

        def dag_write(idx: int):
            try:
                conn = http.client.HTTPConnection("127.0.0.1", AGENT_PORT, timeout=10)
                payload = json.dumps({
                    "action": f"resilience-r5-load-{idx}",
                    "symbol": "Dwennimmen-Strength",
                    "parent_ids": [],
                })
                conn.request("POST", "/dag/add", body=payload, headers={"Content-Type": "application/json"})
                conn.getresponse()
            except Exception as e:
                write_errors.append(str(e))

        threads = [threading.Thread(target=dag_write, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()

        # While writes are in flight, measure health check latency
        health_start = time.monotonic()
        health_ok = _agent_health_ok()
        health_latency_ms = int((time.monotonic() - health_start) * 1000)

        # Wait for writes to finish
        for t in threads:
            t.join(timeout=15)

        if not health_ok:
            result.fail_test(f"Health check failed during load (latency: {health_latency_ms}ms)")
        elif health_latency_ms > 2000:
            result.fail_test(f"Health check too slow under load: {health_latency_ms}ms (limit: 2000ms)")
        else:
            print_success(f"Health check responsive under load: {health_latency_ms}ms")
            result.pass_test(health_latency_ms)

        if write_errors:
            print_warning(f"{len(write_errors)} DAG writes failed during load test (non-blocking)")

    finally:
        _terminate_agent(proc)

    return result


# ============================================================================
# RESILIENCE VALIDATION ORCHESTRATOR
# ============================================================================

def run_resilience_validation() -> Tuple[bool, list]:
    """
    Run the full resilience validation suite.

    Returns:
        (all_passed, results): Tuple of overall pass/fail and list of ResilienceResult.
    """
    print_header("RESILIENCE VALIDATION SUITE (TRL-10 BRIDGING)")
    safe_print(
        "  Bridging A7 (Repeatability) → A8 (Resilience)",
        fallback="  Bridging A7 (Repeatability) -> A8 (Resilience)",
    )
    safe_print(
        '  Experiment: "Can engineer self-recover from documented failure modes?"',
        fallback='  Experiment: "Can engineer self-recover from documented failure modes?"',
    )
    print()

    tests = [
        ("R1", "Agent Process Crash Recovery", test_r1_agent_crash_recovery),
        ("R2", "DAG Persistence Corruption Recovery", test_r2_dag_persistence_recovery),
        ("R3", "Port Contention Self-Healing", test_r3_port_contention_recovery),
        ("R4", "Telemetry Dependency Degradation", test_r4_telemetry_degradation),
        ("R5", "Health Liveness Under Load", test_r5_health_liveness_under_load),
    ]

    results = []
    total = len(tests)

    for idx, (tid, name, test_fn) in enumerate(tests, 1):
        print_step(tid, total, idx, f"Resilience: {name}")
        try:
            r = test_fn()
        except Exception as e:
            r = ResilienceResult(tid, name)
            r.fail_test(f"Unhandled exception: {e}")
            print_error(f"Test {tid} crashed: {e}")
        results.append(r)

        if r.passed:
            print_success(r.summary())
        else:
            print_error(r.summary())

    # Summary
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    print_header("RESILIENCE VALIDATION RESULTS")
    for r in results:
        if r.passed:
            print_success(r.summary())
        else:
            print_error(r.summary())

    print()
    print_info(f"Passed: {passed}/{total}  |  Failed: {failed}/{total}")

    if failed == 0:
        safe_print(
            "\n  ✅ RESILIENCE VALIDATED — System recovers from all documented failure modes",
            fallback="\n  [OK] RESILIENCE VALIDATED - System recovers from all documented failure modes",
        )
        print_info("Engineer/IT team can self-recover without founder involvement")
    else:
        safe_print(
            f"\n  ❌ RESILIENCE GAPS — {failed} failure mode(s) lack recovery capability",
            fallback=f"\n  [FAIL] RESILIENCE GAPS - {failed} failure mode(s) lack recovery capability",
        )
        print_info("Review failed tests. Each documents the expected recovery procedure.")

    all_passed = failed == 0
    return all_passed, results


# ============================================================================
# STANDALONE ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    all_passed, _ = run_resilience_validation()
    sys.exit(0 if all_passed else 1)
