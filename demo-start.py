#!/usr/bin/env python3
"""
demo-start.py -- KHEPRA Demo Launcher
July 10, 2026 -- F6S Pitch Pulse: Security & Defense
Usage: python demo-start.py
IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
"""

import http.server
import json
import mimetypes
import os
import pathlib
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
import webbrowser

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError for box-drawing chars)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = pathlib.Path(__file__).parent.resolve()
CONSOLE_FILE = SCRIPT_DIR / "KHEPRA_OPERATOR_CONSOLE.html"
BIN_DIR = SCRIPT_DIR / "bin"
HTTP_PORT = 3000
APISERVER_PORT = 45444
WATCH_PORT = 8443
VPS_TARGET = "http://2.24.105.170:4280"

# ── ANSI colors ───────────────────────────────────────────────────────────────
C = {
    "cyan":   "\033[96m",
    "green":  "\033[92m",
    "yellow": "\033[93m",
    "red":    "\033[91m",
    "gray":   "\033[90m",
    "white":  "\033[97m",
    "reset":  "\033[0m",
}

def log(tag, msg, color="cyan"):
    print(f"{C[color]}[{tag}]{C['reset']} {msg}")

def banner():
    print(f"\n{C['cyan']}  {'=' * 60}{C['reset']}")
    print(f"{C['cyan']}    KHEPRA Sovereign Security Platform{C['reset']}")
    print(f"{C['cyan']}    NouchiX / SecRed Knowledge Inc. | USPTO #73565085{C['reset']}")
    print(f"{C['cyan']}    F6S Pitch Pulse: Security & Defense -- July 10, 2026{C['reset']}")
    print(f"{C['cyan']}  {'=' * 60}{C['reset']}\n")

# ── Load .env.demo.local ──────────────────────────────────────────────────────
def load_env():
    env_file = SCRIPT_DIR / ".env.demo.local"
    if env_file.exists():
        log("ENV", f"Loading {env_file}", "gray")
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"'))
    else:
        log("WARN", ".env.demo.local not found -- using existing environment", "yellow")

# ── License check ─────────────────────────────────────────────────────────────
def check_license():
    tiers_file = pathlib.Path.home() / ".khepra" / "tiers.json"
    if tiers_file.exists():
        try:
            data = json.loads(tiers_file.read_text())
            log("LICENSE", f"{data.get('tier','?')} tier | expires {data.get('expires_at','?')}", "green")
        except Exception as e:
            log("WARN", f"Could not parse tiers.json: {e}", "yellow")
    else:
        log("WARN", "~/.khepra/tiers.json not found -- running in Community mode", "yellow")

# ── Kill processes on a port (Windows) ───────────────────────────────────────
def kill_port(port: int):
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, timeout=5  # bytes mode — no text= to avoid cp1252 issues
        )
        output = result.stdout.decode("utf-8", errors="ignore")
        pids = set()
        for line in output.splitlines():
            if f":{port} " in line or f":{port}\t" in line:
                parts = line.split()
                if parts:
                    pid = parts[-1]
                    if pid.isdigit() and int(pid) > 4:
                        pids.add(int(pid))
        for pid in pids:
            try:
                subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                               capture_output=True, timeout=3)
            except Exception:
                pass
    except Exception:
        pass

# ── Start a background exe (Windows) ─────────────────────────────────────────
def start_exe(exe: pathlib.Path, args: list[str], label: str) -> subprocess.Popen | None:
    if not exe.exists():
        log("WARN", f"{exe.name} not found at {exe}", "yellow")
        return None
    log("START", f"{exe.name} {' '.join(args)}", "cyan")
    try:
        proc = subprocess.Popen(
            [str(exe)] + args,
            cwd=str(SCRIPT_DIR),
            creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return proc
    except Exception as e:
        log("ERR", f"Failed to start {exe.name}: {e}", "red")
        return None

# ── Health check a URL ────────────────────────────────────────────────────────
def wait_healthy(url: str, retries: int = 6, delay: float = 0.8) -> bool:
    for _ in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status < 500:
                    return True
        except Exception:
            pass
        time.sleep(delay)
    return False

def check_url(url: str, label: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            log("OK", f"{label} reachable (HTTP {r.status})", "green")
            return True
    except Exception:
        log("WARN", f"{label} unreachable -- check VPS / Docker status", "yellow")
        log("WARN", f"  SSH: ssh root@2.24.105.170 'docker ps | grep dvws'", "gray")
        return False

# ── Reverse proxy + static file server ────────────────────────────────────────
# All /api/* requests are forwarded to https://agent.souhimbou.ai (the VPS).
# Static files (HTML/JS/CSS) are served from SCRIPT_DIR.
# Browser only ever talks to http://localhost:3000 → zero CORS issues.

VPS_API = "https://agent.souhimbou.ai"

class ProxyHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # quiet during demo

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers",
                         "Content-Type, Authorization, X-Requested-With, Accept")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, PATCH")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _proxy(self, method: str):
        """Forward /api/* to the VPS; /claude-proxy to Anthropic; static files otherwise."""
        import urllib.parse
        path = self.path  # includes query string

        # ── Claude API proxy (server-side, no browser CORS issue) ───────────────
        # Browser sends POST /claude-proxy with {model, messages, system, max_tokens}
        # Python injects the API key from env and forwards to api.anthropic.com
        if path.startswith("/claude-proxy"):
            ant_key = os.environ.get("ANTHROPIC_API_KEY", "")
            if not ant_key:
                self.send_response(503)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"ANTHROPIC_API_KEY not set in demo environment"}')
                return
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b""
            ant_req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ant_key,
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )
            try:
                ant_resp = urllib.request.urlopen(ant_req, timeout=30)
                data = ant_resp.read()
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except urllib.error.HTTPError as e:
                data = e.read()
                self.send_response(e.code)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(502)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(f'{{"error":"Anthropic proxy error: {e}"}}'.encode())
            return

        if path.startswith("/api/"):
            # ── Proxy to VPS ────────────────────────────────────────────────
            vps_url = VPS_API + path
            body = None
            if method in ("POST", "PUT", "PATCH"):
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length) if length else b""

            # Build upstream request
            req_headers = {
                "Content-Type": self.headers.get("Content-Type", "application/json"),
                "Accept":       self.headers.get("Accept", "*/*"),
                "User-Agent":   "KHEPRA-Demo-Proxy/1.0",
            }
            req = urllib.request.Request(vps_url, data=body,
                                         headers=req_headers, method=method)
            try:
                resp = urllib.request.urlopen(req, timeout=300)
            except urllib.error.HTTPError as e:
                resp = e  # still stream the error body
            except Exception as e:
                self.send_response(502)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(f'{{"error":"proxy error: {e}"}}'.encode())
                return

            # Detect SSE
            ct = resp.headers.get("Content-Type", "")
            is_sse = "text/event-stream" in ct

            self.send_response(resp.status)
            self._send_cors_headers()
            if is_sse:
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("X-Accel-Buffering", "no")
                self.end_headers()
                # Stream SSE line by line
                try:
                    while True:
                        line = resp.readline()
                        if not line:
                            break
                        self.wfile.write(line)
                        self.wfile.flush()
                except Exception:
                    pass
            else:
                data = resp.read()
                self.send_header("Content-Type", ct or "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        else:
            # ── Serve static file ───────────────────────────────────────────
            clean = path.split("?")[0].lstrip("/") or "KHEPRA_OPERATOR_CONSOLE.html"
            file_path = SCRIPT_DIR / clean
            if not file_path.exists() or not file_path.is_file():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"404 Not Found")
                return
            data = file_path.read_bytes()
            ext = file_path.suffix.lower()
            mime = {".html": "text/html; charset=utf-8", ".js": "application/javascript",
                    ".css": "text/css", ".json": "application/json"}.get(ext, "application/octet-stream")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)

    def do_GET(self):  self._proxy("GET")
    def do_POST(self): self._proxy("POST")
    def do_PUT(self):  self._proxy("PUT")
    def do_DELETE(self): self._proxy("DELETE")
    def do_PATCH(self):  self._proxy("PATCH")

def start_http_server():
    server = http.server.HTTPServer(("localhost", HTTP_PORT), ProxyHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return thread, server


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    banner()

    # 1. Load env
    load_env()

    # 2. License
    check_license()

    # 3. Kill stale processes
    print()
    log("CLEAN", f"Freeing ports {APISERVER_PORT}, {WATCH_PORT}", "gray")
    kill_port(APISERVER_PORT)
    kill_port(WATCH_PORT)

    processes: list[subprocess.Popen] = []

    # 4. Start apiserver.exe
    print()
    apiserver_exe = BIN_DIR / "apiserver.exe"
    env = os.environ.copy()
    env["TLS_ENABLED"] = "false"
    if not env.get("KHEPRA_SERVICE_SECRET"):
        import uuid
        env["KHEPRA_SERVICE_SECRET"] = f"khepra-dev-{uuid.uuid4().hex}"
        log("ENV", "KHEPRA_SERVICE_SECRET generated for dev session", "gray")

    proc_api = None
    if apiserver_exe.exists():
        log("START", f"apiserver.exe --> http://localhost:{APISERVER_PORT}", "cyan")
        try:
            proc_api = subprocess.Popen(
                [str(apiserver_exe), "--port", str(APISERVER_PORT), "--tls=false"],
                cwd=str(SCRIPT_DIR),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
            )
            processes.append(proc_api)
            time.sleep(2.5)
            if wait_healthy(f"http://localhost:{APISERVER_PORT}/healthz"):
                log("OK", f"apiserver healthy on :{APISERVER_PORT}", "green")
            else:
                log("WARN", f"apiserver not responding on :{APISERVER_PORT} -- check its window", "yellow")
        except Exception as e:
            log("ERR", f"apiserver.exe failed: {e}", "red")
    else:
        log("WARN", f"apiserver.exe not found at {apiserver_exe}", "yellow")
        log("WARN", "  Build: go build -o bin/apiserver.exe ./cmd/apiserver", "gray")

    # 5. Start adinkhepra watch server
    print()
    watch_exe = BIN_DIR / "adinkhepra.exe"
    if watch_exe.exists():
        log("START", f"adinkhepra watch --> http://localhost:{WATCH_PORT}", "cyan")
        try:
            proc_watch = subprocess.Popen(
                [str(watch_exe), "watch", "-port", str(WATCH_PORT)],
                cwd=str(SCRIPT_DIR),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
            )
            processes.append(proc_watch)
            time.sleep(0.8)
        except Exception as e:
            log("ERR", f"adinkhepra.exe failed: {e}", "red")
    else:
        log("WARN", "adinkhepra.exe not found -- DAG viewer will not stream", "yellow")
        log("WARN", "  Build with: go build -o bin/adinkhepra.exe ./cmd/adinkhepra", "gray")

    # 6. Check VPS target
    print()
    log("CHECK", f"Testing VPS target: {VPS_TARGET}", "gray")
    check_url(VPS_TARGET, "DVWA target")

    # 7. Start HTTP server (CORS fix)
    print()
    log("HTTP", f"Starting console server on http://localhost:{HTTP_PORT}", "cyan")
    try:
        _, http_server = start_http_server()
        time.sleep(0.3)
        log("OK", f"Console server running at http://localhost:{HTTP_PORT}", "green")
    except OSError as e:
        log("ERR", f"Could not bind to port {HTTP_PORT}: {e}", "red")
        log("ERR", "  Kill whatever is on that port and retry.", "red")
        sys.exit(1)

    # 8. Build console URL with optional Claude key
    claude_key = os.environ.get("ANTHROPIC_API_KEY", "")
    console_url = f"http://localhost:{HTTP_PORT}/KHEPRA_OPERATOR_CONSOLE.html"
    if claude_key:
        console_url += f"?key={claude_key}"

    print()
    print(f"  {'-' * 58}")
    print(f"  Console URL : {C['white']}{console_url}{C['reset']}")
    print(f"  API target  : {C['white']}https://agent.souhimbou.ai{C['reset']}")
    print(f"  MCP Server  : {C['white']}https://mcp.souhimbou.ai{C['reset']}")
    if claude_key:
        log("OK", "Imhotep: Claude API key injected", "green")
    else:
        log("WARN", "Imhotep: No ANTHROPIC_API_KEY -- Ollama or scripted fallback", "yellow")
    print(f"  {'-' * 58}\n")

    # 9. Open browser
    webbrowser.open(console_url)
    log("OK", "Browser opened. Demo is live.", "green")
    print()
    print(f"{C['gray']}  Press Ctrl+C to stop the demo server.{C['reset']}\n")

    # 10. Keep alive
    def shutdown(sig, frame):
        print()
        log("STOP", "Shutting down demo server...", "gray")
        http_server.shutdown()
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        log("STOP", "Done.", "gray")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        shutdown(None, None)


if __name__ == "__main__":
    main()
