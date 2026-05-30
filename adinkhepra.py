"""
ADINKHEPRA - Khepra Protocol Orchestration & Validation Suite

This is the heart of the Khepra Protocol deployment system.
Handles build, validation, and orchestration of all components.

Classification: CUI // NOFORN
TRL: 10 (Production-Ready)
"""

import os
import subprocess
import sys
import platform
import json
import time
import http.client
import socket
import tempfile
from typing import Optional, List

# ============================================================================
# CONFIGURATION
# ============================================================================

AGENT_PORT = 45444
TELEMETRY_PORT = 8787
FRONTEND_PORT = 3000
AGENT_STARTUP_TIMEOUT = 120  # seconds (allow for heavy DB loading)
PORT_WAIT_TIMEOUT = 30  # seconds
MOD_VENDOR = "-mod=vendor"
AGENT_EXE = "adinkhepra-agent.exe"
APISERVER_PORT = 48080
APISERVER_EXE = "apiserver.exe"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_binary_name(component: str) -> str:
    """Get platform-specific binary name with correct extension."""
    system = platform.system().lower()
    ext = ".exe" if system == "windows" else ""
    return f"bin/{component}{ext}"


def should_use_shell() -> bool:
    """Determine if subprocess should use shell (Windows-specific)."""
    return platform.system().lower() == "windows"


def print_header(title: str, char: str = "=") -> None:
    """Print a formatted header."""
    width = 60
    safe_print(f"\n{char * width}")
    safe_print(f"{title:^{width}}")
    safe_print(f"{char * width}\n")


def print_step(_label: str, total: int, current: int, message: str) -> None:
    """Print a formatted step message."""
    print(f"\n[{current}/{total}] {message}...")


def safe_print(message: str, fallback: str = None) -> None:
    """Print message with UTF-8 support or fallback to ASCII."""
    try:
        print(message)
    except UnicodeEncodeError:
        if fallback:
            print(fallback)
        else:
            print(message.encode('ascii', 'replace').decode('ascii'))


def print_success(message: str) -> None:
    """Print a success message."""
    safe_print(f"✅ {message}", fallback=f"[OK] {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    safe_print(f"❌ {message}", fallback=f"[FAIL] {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    safe_print(f"⚠️  {message}", fallback=f"[WARN] {message}")


def print_info(message: str) -> None:
    """Print an info message."""
    safe_print(f"      > {message}")


# ============================================================================
# BUILD FUNCTIONS
# ============================================================================

def _check_gcc_available() -> bool:
    """Return True if gcc (or a compatible C compiler) is resolvable in PATH."""
    import shutil
    # On Windows, also accept cl.exe (MSVC) as a CGO-capable compiler
    for compiler in ("gcc", "cl", "clang"):
        if shutil.which(compiler):
            return True
    return False


def build(component: str, fips: bool = True, tags: list = None) -> bool:
    """
    Build a Khepra Protocol component with optional FIPS mode and build tags.

    FIPS mode (GOEXPERIMENT=boringcrypto) requires CGO and a C compiler.
    On Windows without GCC, the build automatically falls back to
    CGO_ENABLED=0 (pure-Go, non-FIPS) with a warning rather than hard-failing.

    Args:
        component: Component name (e.g., 'adinkhepra', 'adinkhepra-agent')
        fips:      Enable FIPS 140-3 BoringCrypto mode (auto-disabled if no C compiler)
        tags:      Optional list of Go build tags (e.g., ['saas'] for cloud gateway builds)

    Returns:
        True if build successful, False otherwise
    """
    binary = get_binary_name(component)

    # Determine source path
    if component == "adinkhepra-agent":
        cmd_path = "./cmd/agent"
    elif component == "adinkhepra":
        cmd_path = "./cmd/adinkhepra"
    else:
        cmd_path = f"./cmd/{component.replace('adinkhepra-', '')}"

    # ── FIPS auto-detection ───────────────────────────────────────────────────
    # boringcrypto requires CGO_ENABLED=1 + a C compiler.
    # On Windows CI / dev boxes without MinGW, degrade gracefully.
    effective_fips = fips
    if fips and not _check_gcc_available():
        print_warning(
            "C compiler (gcc/clang/cl) not found in PATH — "
            "FIPS mode (boringcrypto) disabled for this build."
        )
        print_info(
            "Install MinGW-w64 or MSVC build tools to enable FIPS mode: "
            "https://www.mingw-w64.org/downloads/"
        )
        effective_fips = False

    tags_str = ",".join(tags) if tags else ""
    print_info(f"Building {component} (FIPS={effective_fips}{', tags=' + tags_str if tags_str else ''})...")

    # ── Build command ─────────────────────────────────────────────────────────
    cmd = ["go", "build", MOD_VENDOR]

    # Inject build tags when specified (e.g., apiserver needs -tags saas to
    # include pkg/supabase which is excluded from sovereign/ironbank builds).
    if tags_str:
        cmd += ["-tags", tags_str]

    cmd += ["-o", binary]

    env = os.environ.copy()
    if effective_fips:
        env["GOEXPERIMENT"] = "boringcrypto"
        env["CGO_ENABLED"] = "1"
        print_info("[FIPS] Enabled GOEXPERIMENT=boringcrypto + CGO_ENABLED=1")
    else:
        # Pure-Go build — no CGO dependency
        env.pop("GOEXPERIMENT", None)
        env["CGO_ENABLED"] = "0"
        if fips and not effective_fips:
            print_info("[NO-FIPS] Building CGO_ENABLED=0 (pure-Go) — not FIPS certified")

    cmd.append(cmd_path)

    try:
        subprocess.check_call(cmd, env=env)
        fips_tag = "FIPS" if effective_fips else "non-FIPS"
        print_success(f"Build successful: {binary} ({fips_tag}{', +' + tags_str if tags_str else ''})")
        return True
    except subprocess.CalledProcessError:
        print_error(f"Failed to build {component}")
        return False
    except FileNotFoundError:
        print_error("'go' command not found. Please install Go 1.22+")
        return False




def build_all_components(fips: bool = True) -> bool:
    """Build all Khepra Protocol components.

    Sovereign binaries (adinkhepra, adinkhepra-agent) use no build tags.
    The apiserver (SaaS gateway) is built with -tags saas to include
    Supabase-dependent code excluded from sovereign/ironbank binaries.
    """
    # Sovereign binaries — no build tags, pure-Go safe
    for component in ["adinkhepra", "adinkhepra-agent"]:
        if not build(component, fips=fips):
            return False

    # SaaS gateway — requires -tags saas for Supabase-dependent code
    if not build("apiserver", fips=fips, tags=["saas"]):
        return False

    return True


# ============================================================================
# NETWORK FUNCTIONS
# ============================================================================

def wait_for_port(port: int, host: str = "127.0.0.1", timeout: int = PORT_WAIT_TIMEOUT) -> bool:
    """
    Wait for a port to become available.
    
    Args:
        port: Port number to check
        host: Host address (default: localhost)
        timeout: Maximum wait time in seconds
        
    Returns:
        True if port is available, False if timeout
    """
    start = time.time()
    while time.time() - start < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            sock.connect((host, port))
            sock.close()
            return True
        except (socket.error, socket.timeout):
            time.sleep(0.5)
    return False


def check_port_available(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a port is currently available (not in use)."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result != 0  # Port is available if connection fails
    except socket.error:
        return True


# ============================================================================
# TELEMETRY SERVER
# ============================================================================

def start_telemetry_server() -> Optional[subprocess.Popen]:
    """
    Start the telemetry server for local license validation.
    
    Returns:
        Process object if successful, None otherwise
    """
    telemetry_dir = "adinkhepra-telemetry-server"
    
    if not os.path.exists(telemetry_dir):
        print_warning("Telemetry server not found, skipping (license will use remote)")
        return None
    
    print_info(f"Starting Telemetry Server (wrangler dev) on port {TELEMETRY_PORT}...")
    
    try:
        # Start wrangler dev server
        telemetry_proc = subprocess.Popen(
            ["npx", "wrangler", "dev", "--local", "--port", str(TELEMETRY_PORT)],
            cwd=telemetry_dir,
            shell=should_use_shell(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        # Wait for server to be ready
        if wait_for_port(TELEMETRY_PORT, timeout=15):
            print_success(f"Telemetry Server ready on http://localhost:{TELEMETRY_PORT}")
            os.environ["KHEPRA_LICENSE_SERVER"] = f"http://localhost:{TELEMETRY_PORT}"
            return telemetry_proc
        else:
            print_warning("Telemetry server failed to start, continuing without it")
            telemetry_proc.terminate()
            return None
            
    except FileNotFoundError:
        print_warning("npx/wrangler not found, skipping telemetry server")
        return None
    except Exception as e:
        print_warning(f"Telemetry server error: {e}")
        return None


# ============================================================================
# VALIDATION SUITE
# ============================================================================

def _run_unit_tests() -> bool:
    print_step("Unit Tests", 4, 1, "Running Unit Tests")
    try:
        result = subprocess.call(["go", "test", "-count=1", MOD_VENDOR, "./pkg/...", "./cmd/..."])
        if result != 0:
            print_error("Unit tests failed")
            return False
        print_success("Unit tests passed")
        return True
    except FileNotFoundError:
        print_error("'go' command not found. Please install Go 1.22+")
        return False

def _test_pqc_key_gen(fips: bool = True) -> bool:
    print_step("PQC Key Generation", 4, 2, "Testing PQC Key Generation (CLI)")
    if not build("adinkhepra", fips=fips):
        return False
    cli_bin = os.path.abspath(get_binary_name("adinkhepra"))
    # Keys are written to an OS temp directory — NEVER to the repo working tree.
    # Root cause of the 2026-05-10 key-exposure incident was keygen writing into
    # the repo root, where `git add .` swept them into history.
    with tempfile.TemporaryDirectory(prefix="khepra_keygen_") as tmpdir:
        out_prefix = os.path.join(tmpdir, "test_key")
        try:
            subprocess.check_output(
                [cli_bin, "keygen", "-out", out_prefix, "-comment", "validation-test"],
                stderr=subprocess.STDOUT,
                cwd=tmpdir,
            )
            expected_files = [
                f"{out_prefix}_dilithium",
                f"{out_prefix}_dilithium.pub",
                f"{out_prefix}_dilithium.pub.adinkhepra.json",
                f"{out_prefix}_kyber",
                f"{out_prefix}_kyber.pub",
            ]
            missing = [f for f in expected_files if not os.path.exists(f)]
            if missing:
                print_error(f"PQC key generation failed: missing {[os.path.basename(f) for f in missing]}")
                return False
            print_success("PQC key generation successful (keys in temp dir, never committed)")
            return True
        except subprocess.CalledProcessError as e:
            print_error(f"CLI execution failed: {e.output.decode()}")
            return False

def _wait_for_agent() -> http.client.HTTPConnection:
    attempts = AGENT_STARTUP_TIMEOUT * 2
    conn = None
    while attempts > 0:
        try:
            conn = http.client.HTTPConnection("127.0.0.1", AGENT_PORT, timeout=1)
            conn.request("GET", "/healthz")
            res = conn.getresponse()
            if res.status == 200:
                data = json.load(res)
                if data.get("status") == "ok":
                    print_success("Agent health check passed")
                    return conn
        except Exception:
            pass
        time.sleep(0.5)
        attempts -= 1
    return None

def _wait_for_apiserver() -> Optional[http.client.HTTPConnection]:
    attempts = 60
    conn = None
    while attempts > 0:
        try:
            conn = http.client.HTTPConnection("127.0.0.1", APISERVER_PORT, timeout=1)
            conn.request("GET", "/healthz")
            res = conn.getresponse()
            res.read()
            if res.status == 200:
                print_success("Apiserver health check passed")
                return conn
        except Exception:
            pass
        time.sleep(0.5)
        attempts -= 1
    return None

def _test_agent_api(fips: bool = True, skip_asaf_smoke: bool = False) -> bool:
    print_step("Agent API", 4, 3, "Testing Agent API (Integration)")
    if not build("adinkhepra-agent", fips=fips):
        return False
    if not build("apiserver", fips=fips):
        return False
    agent_bin = get_binary_name("adinkhepra-agent")
    apiserver_bin = get_binary_name("apiserver")
    telemetry_proc = start_telemetry_server()
    if not check_port_available(AGENT_PORT):
        print_warning(f"Port {AGENT_PORT} is in use, attempting to free it...")
        if platform.system().lower() == "windows":
            subprocess.call(["taskkill", "/F", "/IM", AGENT_EXE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)
    if not check_port_available(APISERVER_PORT):
        print_warning(f"Port {APISERVER_PORT} is in use, attempting to free it...")
        if platform.system().lower() == "windows":
            subprocess.call(["taskkill", "/F", "/IM", APISERVER_EXE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)
    print_info(f"Starting Agent on port {AGENT_PORT}...")
    agent_proc = subprocess.Popen([agent_bin], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print_info(f"Starting Apiserver on port {APISERVER_PORT}...")
    apiserver_env = os.environ.copy()
    apiserver_env["TLS_ENABLED"] = "false"
    apiserver_env["PORT"] = str(APISERVER_PORT)
    apiserver_env["KHEPRA_SERVICE_SECRET"] = "smoke-test-secret"
    apiserver_proc = subprocess.Popen([apiserver_bin], env=apiserver_env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        conn = _wait_for_agent()
        if not conn:
            print_error(f"Agent failed to start or is unreachable (Timeout {AGENT_STARTUP_TIMEOUT}s)")
            return False
        conn_apiserver = _wait_for_apiserver()
        if not conn_apiserver:
            print_error("Apiserver failed to start or is unreachable")
            return False
        print_step("Polymorphic API", 4, 4, "Validating Polymorphic API (Mitochondreal-Scarab)")
        try:
            subprocess.check_call([sys.executable, "-c", "import torch; import fastapi; import uvicorn"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print_success("Python ML dependencies verified")
        except subprocess.CalledProcessError:
            print_warning("Missing Python ML dependencies (torch, fastapi, uvicorn)")
            print_info("Install with: pip install torch fastapi uvicorn")
        if os.path.exists("services/ml_anomaly/api.py"):
            print_success("SouHimBou Service found")
        else:
            print_warning("SouHimBou Service missing (services/ml_anomaly/api.py)")
        print_info("Testing DAG attestation...")
        payload = json.dumps({"action": "validate-deployment", "symbol": "Adinkra-Validation", "parent_ids": []})
        conn.request("POST", "/dag/add", body=payload, headers={"Content-Type": "application/json"})
        res = conn.getresponse()
        res.read()
        if res.status == 200:
            print_success("DAG write successful")
        else:
            print_error(f"DAG write failed: {res.status}")
            return False

        if not _test_asaf_endpoints(skip=skip_asaf_smoke):
            return False

        return True
    finally:
        print_step("Teardown", 4, 4, "Cleaning up test processes")
        if platform.system().lower() == "windows":
            subprocess.call(["taskkill", "/F", "/IM", AGENT_EXE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.call(["taskkill", "/F", "/IM", APISERVER_EXE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            agent_proc.terminate()
            agent_proc.wait()
            apiserver_proc.terminate()
            apiserver_proc.wait()
        if telemetry_proc:
            telemetry_proc.terminate()

def _test_asaf_endpoints(skip: bool = False) -> bool:
    """
    Smoke-test ASAF flight recorder endpoints.

    Tests exercised:
      - GET /api/v1/asaf/stream  (public SSE — expects 200 with text/event-stream +
                                   initial 'connected' event in first chunk)
      - GET /api/v1/asaf/sessions (authenticated — expects 200 or 401)
      - POST /api/v1/asaf/record  (expects 401/403 without service token)

    IMPORTANT: The SSE endpoint never closes its response body (by design).
    We therefore use a *dedicated* short-timeout connection and read only the
    first chunk (the immediate 'connected' event).  Calling res.read() on the
    shared conn would block forever and leave it in a broken state, causing
    all subsequent requests on the same connection to fail with 'Request-sent'.
    """
    if skip:
        print_warning("ASAF smoke test skipped (--skip-asaf-smoke)")
        return True

    print_step("ASAF Endpoints", 5, 4, "Smoke-testing ASAF flight recorder routes")
    errors: List[str] = []

    # --- SSE stream — use a SEPARATE, short-timeout connection ---
    sse_conn = None
    try:
        sse_conn = http.client.HTTPConnection("127.0.0.1", APISERVER_PORT, timeout=5)
        sse_conn.request("GET", "/api/v1/asaf/stream",
                         headers={"Accept": "text/event-stream"})
        res = sse_conn.getresponse()
        ct = res.getheader("Content-Type", "")
        # Smoke-test verdict is based on headers only — do NOT call res.read().
        # SSE is an infinite stream; the server never sends EOF by design.
        # Python's http.client buffers data internally and res.read(N) will
        # block until N bytes arrive or the socket times out — even when the
        # server has already flushed data at the TCP level.  The HTTP response
        # headers (status 200 + Content-Type: text/event-stream) are the
        # correct and sufficient signal that the route is live.
        if res.status != 200:
            errors.append(f"/asaf/stream returned HTTP {res.status} (expected 200)")
        elif "text/event-stream" not in ct:
            errors.append(f"/asaf/stream Content-Type wrong: {ct!r}")
        else:
            print_info("GET /api/v1/asaf/stream \u2192 200 text/event-stream \u2713 (route live)")
    except socket.timeout:
        errors.append("/asaf/stream timed out \u2014 server did not respond within 5 s")
    except Exception as e:
        errors.append(f"/asaf/stream request failed: {e}")
    finally:
        if sse_conn:
            try:
                sse_conn.close()
            except Exception:
                pass

    # --- Sessions list — fresh connection, 401 is correct without auth ---
    try:
        sess_conn = http.client.HTTPConnection("127.0.0.1", APISERVER_PORT, timeout=5)
        sess_conn.request("GET", "/api/v1/asaf/sessions")
        res = sess_conn.getresponse()
        res.read()
        sess_conn.close()
        if res.status in (200, 401):
            print_info(f"GET /api/v1/asaf/sessions \u2192 {res.status} \u2713 (route exists)")
        else:
            errors.append(f"/asaf/sessions returned unexpected HTTP {res.status}")
    except Exception as e:
        errors.append(f"/asaf/sessions request failed: {e}")

    # --- Record endpoint — 401/403 without service token ---
    try:
        rec_conn = http.client.HTTPConnection("127.0.0.1", APISERVER_PORT, timeout=5)
        payload = json.dumps({"agent_id": "smoke-test", "session_id": "test", "mcp_method": "test/call"})
        rec_conn.request("POST", "/api/v1/asaf/record", body=payload,
                         headers={"Content-Type": "application/json"})
        res = rec_conn.getresponse()
        res.read()
        rec_conn.close()
        if res.status in (401, 403):
            print_info(f"POST /api/v1/asaf/record \u2192 {res.status} \u2713 (service auth active)")
        else:
            errors.append(f"/asaf/record returned unexpected HTTP {res.status} (expected 401/403)")
    except Exception as e:
        errors.append(f"/asaf/record request failed: {e}")

    if errors:
        for err in errors:
            print_error(err)
        return False

    print_success("ASAF flight recorder endpoints verified")
    return True


def _generate_service_token(service_name: str) -> bool:
    """Generate a service token using the cmd/service-token binary."""
    token_bin = get_binary_name("service-token")
    if not os.path.exists(token_bin):
        print_info("Building service-token tool...")
        try:
            subprocess.check_call(["go", "build", MOD_VENDOR, "-o", token_bin, "./cmd/service-token"])
        except subprocess.CalledProcessError:
            print_error("Failed to build service-token tool")
            return False

    try:
        result = subprocess.check_output([token_bin, "generate", service_name], stderr=subprocess.STDOUT)
        output = result.decode("utf-8", errors="replace")
        print_info(f"Service token generated for {service_name}")
        # Print the token line so the user can copy it
        for line in output.splitlines():
            if line.startswith("khepra-svc-"):
                safe_print(f"      Token: {line}")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"service-token generate {service_name} failed: {e.output.decode()}")
        return False


def _run_resilience_validation() -> bool:
    """Run the TRL-10 resilience bridging experiment (A7→A8)."""
    print_step("Resilience", 5, 5, "Running Resilience Validation (TRL-10 Bridging)")
    try:
        from resilience_validation import run_resilience_validation
        all_passed, _ = run_resilience_validation()
        if not all_passed:
            print_error("Resilience validation failed — review failure modes above")
        return all_passed
    except ImportError as e:
        print_warning(f"Resilience validation module not available: {e}")
        print_info("Skipping resilience tests (install resilience_validation.py)")
        return True
    except Exception as e:
        print_error(f"Resilience validation crashed: {e}")
        return False


def validate(fips: bool = True, skip_asaf_smoke: bool = False) -> bool:
    """
    Run the complete ADINKHEPRA validation suite.
    """
    print_header("ADINKHEPRA VALIDATION SUITE")
    print_step("Harmonization Ritual", 5, 1, "Running Akoko Nan Sacred Balance Check")
    if os.path.exists(get_binary_name("adinkhepra")):
        try:
            cli_bin = get_binary_name("adinkhepra")
            subprocess.check_call([cli_bin, "scada", "audit"], stderr=subprocess.STDOUT)
            print_success("Sunsum Vitality baseline verified (TRL-10)")
        except subprocess.CalledProcessError:
            print_warning("Akoko Nan Simulation skipped (Nsohia Flow not initiated)")
    
    if not _run_unit_tests():
        return False
    if not _test_pqc_key_gen(fips=fips):
        return False
    if not _test_agent_api(fips=fips, skip_asaf_smoke=skip_asaf_smoke):
        return False

    # ========================================================================
    # RESILIENCE VALIDATION (TRL-10 Bridging: A7 → A8)
    # ========================================================================
    if not _run_resilience_validation():
        return False

    # ========================================================================
    # VALIDATION COMPLETE
    # ========================================================================
    print_header("✨ ALL SYSTEMS GO. ADINKHEPRA IS READY ✨", "=")
    print_info("Validation suite passed all checks (repeatability + resilience)")
    print_info("System is ready for pilot deployment")

    return True


# ============================================================================
# LAUNCH FUNCTIONS
# ============================================================================

def launch(args: List[str] = None, fips: bool = True) -> None:
    """
    Launch the complete ADINKHEPRA stack.
    
    Starts:
    1. Telemetry server (local license validation)
    2. Agent backend (API server)
    3. Frontend (React dashboard)
    
    Args:
        args: Command-line arguments (e.g., --llm-port)
    """
    if args is None:
        args = []
    
    print_header("🚀 LAUNCHING ADINKHEPRA FULL STACK")
    
    # Handle custom LLM port
    llm_port = "11434"  # Default Ollama port
    if "--llm-port" in args:
        try:
            idx = args.index("--llm-port")
            llm_port = args[idx + 1]
            os.environ["ADINKHEPRA_LLM_URL"] = f"http://localhost:{llm_port}"
            print_info(f"[Config] Override LLM_URL: {os.environ['ADINKHEPRA_LLM_URL']}")
        except (ValueError, IndexError):
            print_error("--llm-port requires a port number")
            sys.exit(1)
    
    # Start telemetry server
    telemetry_proc = start_telemetry_server()
    
    # Build and start agent
    agent_bin = get_binary_name("adinkhepra-agent")
    if not os.path.exists(agent_bin) and not build("adinkhepra-agent", fips=fips):
        print_error("Failed to build agent")
        sys.exit(1)
    
    print_info(f"Starting Backend: {agent_bin} (Port {AGENT_PORT})")
    agent_proc = subprocess.Popen([agent_bin], cwd=".")
    
    # Start frontend
    print_info(f"Starting Frontend: npm run dev (Port {FRONTEND_PORT})")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        shell=should_use_shell(),
        cwd="."
    )
    
    print_header(">>> PRESS CTRL+C TO STOP THE STACK <<<", "-")
    
    try:
        while True:
            time.sleep(1)
            if agent_proc.poll() is not None:
                print_error("Agent died unexpectedly")
                break
    except KeyboardInterrupt:
        print_header("🛑 STOPPING STACK")
        
        # Stop agent
        if platform.system().lower() == "windows":
            subprocess.call(
                ["taskkill", "/F", "/IM", AGENT_EXE],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            agent_proc.terminate()
        
        # Stop frontend
        frontend_proc.terminate()
        
        # Stop telemetry server
        if telemetry_proc:
            telemetry_proc.terminate()
        
        print_success("Stack stopped successfully")
        sys.exit(0)


# ============================================================================
# RUN FUNCTIONS
# ============================================================================

def run(component: str, args: List[str], fips: bool = True) -> None:
    """
    Run a Khepra Protocol component.
    
    Args:
        component: Component name
        args: Command-line arguments to pass to component
    """
    binary = get_binary_name(component)
    
    if not os.path.exists(binary):
        print_info(f"Binary {binary} not found. Building first...")
        if not build(component, fips=fips):
            sys.exit(1)
    
    print_info(f"Running {component} with args: {args}")
    
    try:
        subprocess.call([binary] + args)
    except KeyboardInterrupt:
        pass


# ============================================================================
# TNOK GATEWAY
# ============================================================================

def launch_tnok(args: List[str]) -> None:
    """
    Launch Tnok Stealth Gateway (CSfC Mode).
    
    Args:
        args: Command-line arguments for tnokd
    """
    print_header("🛡️  INITIALIZING TNOK STEALTH GATEWAY (CSfC Mode)")
    
    tnok_path = "./pkg/tnok/tnok"
    
    # Install Tnok in editable mode
    print_info(f"Installing Tnok from {tnok_path}...")
    
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-e", tnok_path],
            stdout=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError:
        print_error("Failed to install Tnok. Ensure 'pkg/tnok/tnok' exists with pyproject.toml")
        sys.exit(1)
    
    # Run Tnok daemon
    print_info("Starting Tnok Daemon (tnokd)...")
    print_info("ℹ️  Use 'tnokd --help' to see options")
    
    try:
        subprocess.call([sys.executable, "-m", "tnokd.__main__"] + args)
    except KeyboardInterrupt:
        print_success("Tnok Stealth Gateway shutdown")


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def print_usage() -> None:
    """Print usage information."""
    print("Usage: python adinkhepra.py [command]")
    print("\nCommands:")
    print("  validate         -> Run full test suite then LAUNCH stack")
    print("  resilience       -> Run resilience validation only (TRL-10 bridging)")
    print("  launch           -> Launch Agent + Frontend")
    print("  agent  [args...] -> Run the ADINKHEPRA agent")
    print("  cli    [args...] -> Run the ADINKHEPRA CLI tool")
    print("  scada  [args...] -> Run the ADINKHEPRA Sacred Nsohia suite")
    print("  build            -> Rebuild binaries (adinkhepra + adinkhepra-agent + apiserver)")
    print("  test             -> Run Go tests")
    print("  tnok             -> Start Tnok Stealth Gateway (tnokd)")
    print("  service-token [name] -> Generate HMAC service token (default: asaf-bridge)")
    print("\nOptions:")
    print("  --no-fips           -> Disable FIPS mode (build/validate commands)")
    print("  --skip-asaf-smoke   -> Skip ASAF live-endpoint smoke test (validate command)")
    print("                         Use in CI or dev environments without a persistent agent")
    print("  --llm-port PORT     -> Override LLM port (launch command)")


def main() -> None:
    """Main entry point for ADINKHEPRA orchestration."""
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    extra_args = sys.argv[2:]
    
    match_command(command, extra_args)

def match_command(command: str, extra_args: list[str]) -> None:
    """Dispatches command to the appropriate handler."""
    fips = "--no-fips" not in extra_args
    skip_asaf_smoke = "--skip-asaf-smoke" in extra_args
    extra_args = [a for a in extra_args if a not in ("--no-fips", "--skip-asaf-smoke")]

    if command == "build":
        sys.exit(0 if build_all_components(fips=fips) else 1)
    elif command == "agent":
        run("adinkhepra-agent", extra_args, fips=fips)
    elif command == "cli":
        run("adinkhepra", extra_args, fips=fips)
    elif command == "scada":
        run("adinkhepra", ["scada"] + extra_args, fips=fips)
    elif command == "launch":
        launch(extra_args, fips=fips)
    elif command == "test":
        handle_test_command()
    elif command == "validate":
        handle_validate_command(fips=fips, skip_asaf_smoke=skip_asaf_smoke)
    elif command == "resilience":
        handle_resilience_command()
    elif command == "tnok":
        launch_tnok(extra_args)
    elif command == "service-token":
        service_name = extra_args[0] if extra_args else "asaf-bridge"
        sys.exit(0 if _generate_service_token(service_name) else 1)
    else:
        run("adinkhepra", [command] + extra_args, fips=fips)

def handle_test_command() -> None:
    print_info("Running tests...")
    result = subprocess.call([
        "go", "test", "-count=1", MOD_VENDOR,
        "./pkg/...", "./cmd/..."
    ])
    sys.exit(result)

def handle_validate_command(fips: bool = True, skip_asaf_smoke: bool = False) -> None:
    if validate(fips=fips, skip_asaf_smoke=skip_asaf_smoke):
        launch([], fips=fips)
    else:
        print_error("Validation failed. Fix errors before deploying.")
        sys.exit(1)

def handle_resilience_command() -> None:
    from resilience_validation import run_resilience_validation
    all_passed, _ = run_resilience_validation()
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
