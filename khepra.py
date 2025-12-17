import os
import subprocess
import sys
import platform

def get_binary_name(component):
    system = platform.system().lower()
    ext = ".exe" if system == "windows" else ""
    return f"bin/{component}{ext}"

def build(component, fips=False):
    print(f"[Python] Building {component} (FIPS={fips})...")
    binary = get_binary_name(component)
    cmd_path = f"./cmd/{component.replace('khepra-', '')}"
    
    # Adjust for agent since it's in cmd/agent but binary is khepra-agent
    if component == "khepra-agent":
        cmd_path = "./cmd/agent"
    elif component == "khepra":
        cmd_path = "./cmd/khepra"

    # Go build command
    cmd = ["go", "build", "-mod=vendor", "-o", binary]
    
    # Inject FIPS experiment if requested
    env = os.environ.copy()
    if fips:
        env["GOEXPERIMENT"] = "boringcrypto"
        # boringcrypto usually requires CGO
        env["CGO_ENABLED"] = "1" 
        print("      > [FIPS] Enabled GOEXPERIMENT=boringcrypto + CGO_ENABLED=1")

    cmd.append(cmd_path)
    
    try:
        subprocess.check_call(cmd, env=env)
        print(f"[Python] Build successful: {binary}")
    except subprocess.CalledProcessError:
        print(f"[Python] Error: Failed to build {component}")
        sys.exit(1)
    except FileNotFoundError:
         print("[Python] Error: 'go' command not found. Please install Go 1.22+.")
         sys.exit(1)

def run(component, args):
    binary = get_binary_name(component)
    if not os.path.exists(binary):
        print(f"[Python] Binary {binary} not found. Building first...")
        build(component)
    
    print(f"[Python] Running {component} with args: {args}")
    try:
        # Replace current process with the binary executable
        # On Windows, os.execv is tricky with paths, subprocess is safer for a wrapper
        subprocess.call([binary] + args)
    except KeyboardInterrupt:
        pass

import json
import time
import http.client
import signal

def should_use_shell():
    return platform.system().lower() == "windows"

def validate():
    print("=" * 60)
    print("KHEPRA VALIDATION SUITE")
    print("=" * 60)

    # 1. Run Unit Tests
    print("\n[1/4] Running Unit Tests...")
    test_code = subprocess.call(["go", "test", "-count=1", "-mod=vendor", "./pkg/...", "./cmd/..."])
    if test_code != 0:
        print("❌ Unit tests failed.")
        sys.exit(1)
    print("✅ Unit tests passed.")

    # 2. Test CLI PQC Key Generation
    print("\n[2/4] Testing PQC Key Generation (CLI)...")
    build("khepra")
    cli_bin = get_binary_name("khepra")
    
    # Run keygen to a temporary location
    # Run keygen to a temporary location
    try:
        subprocess.check_output([cli_bin, "keygen", "-out", "test_key", "-comment", "test-run"], stderr=subprocess.STDOUT)
        
        # New naming convention check
        if os.path.exists("test_key_dilithium") and os.path.exists("test_key_dilithium.pub"):
            print("✅ PQC Key generation successful.")
            # Cleanup
            try:
                os.remove("test_key_dilithium")
                os.remove("test_key_dilithium.pub")
                os.remove("test_key_dilithium.pub.khepra.json")
                os.remove("test_key_kyber")
                os.remove("test_key_kyber.pub")
            except: pass
        else:
            print("❌ PQC Key generation failed: output files missing.")
            print(f"Checked for: test_key_dilithium, test_key_dilithium.pub")
            sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"❌ CLI execution failed: {e.output.decode()}")
        sys.exit(1)

    # 3. Test Agent Lifecycle & API
    print("\n[3/4] Testing Agent API (Integration)...")
    build("khepra-agent")
    agent_bin = get_binary_name("khepra-agent")
    
    # Start Agent in background
    print("      Starting Agent on port 45444...")
    # Allow port reuse or wait a bit if previously running
    time.sleep(1)
    
    agent_proc = subprocess.Popen([agent_bin], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    try:
        # Wait for agent to come up
        attempts = 10
        conn = None
        while attempts > 0:
            try:
                conn = http.client.HTTPConnection("127.0.0.1", 45444, timeout=1)
                conn.request("GET", "/healthz")
                res = conn.getresponse()
                if res.status == 200:
                    data = json.load(res)
                    if data.get("ok"):
                        print("✅ Agent health check passed.")
                        break
            except Exception:
                time.sleep(0.5)
                attempts -= 1
        
        if attempts == 0:
            print("❌ Agent failed to start or is unreachable.")
            sys.exit(1)

        # Test DAG Addition
        print("      Testing DAG attestation...")
        payload = json.dumps({
            "action": "validate-laptop",
            "symbol": "Adinkra-Test",
            "parent_ids": []
        })
        conn.request("POST", "/dag/add", body=payload, headers={"Content-Type": "application/json"})
        res = conn.getresponse()
        if res.status == 200:
            print("✅ DAG write successful.")
        else:
            print(f"❌ DAG write failed: {res.status}")
            sys.exit(1)

    finally:
        # 4. Teardown
        print("\n[4/4] Teardown...")
        # Kill all instances of khepra-agent.exe to be safe on Windows
        if platform.system().lower() == "windows":
            subprocess.call(["taskkill", "/F", "/IM", "khepra-agent.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            agent_proc.terminate()
            agent_proc.wait()
        
    print("\n✨ ALL SYSTEMS GO. KHEPRA IS READY ON THIS MACHINE.")
    print("=" * 60)
    
    # Auto-launch stack
    launch()

def launch():
    print("\n[🚀] LAUNCHING KHEPRA FULL STACK...")
    
    # 1. Start Agent
    agent_bin = get_binary_name("khepra-agent")
    if not os.path.exists(agent_bin):
        build("khepra-agent")
        
    print(f"      > Starting Backend: {agent_bin} (Port 45444)")
    agent_proc = subprocess.Popen([agent_bin], cwd=".")

    # 2. Start Frontend
    print(f"      > Starting Frontend: npm run dev (Port 3000)")
    # Use shell=True for npm to resolve correctly on Windows
    frontend_proc = subprocess.Popen(["npm", "run", "dev"], shell=True, cwd=".")

    print("\n   >>> PRESS CTRL+C TO STOP THE STACK <<<")
    
    try:
        while True:
            time.sleep(1)
            if agent_proc.poll() is not None:
                print("❌ Agent died unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n[🛑] Stopping Stack...")
        
        # Kill Agent
        if platform.system().lower() == "windows":
            subprocess.call(["taskkill", "/F", "/IM", "khepra-agent.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            agent_proc.terminate()
            
        # Kill Frontend (Best Effort)
        frontend_proc.terminate()
        sys.exit(0)

def main():
    if len(sys.argv) < 2:
        print("Usage: python khepra.py [command]")
        print("Commands:")
        print("  validate         -> Run full test suite then LAUNCH stack")
        print("  launch           -> Launch Agent + Frontend")
        print("  agent  [args...] -> Runs the KHEPRA agent")
        print("  cli    [args...] -> Runs the KHEPRA CLI tool")
        print("  build            -> Rebuilds binaries")
        print("  test             -> Runs Go tests")
        print("  tnok             -> Starts Tnok Stealth Gateway (tnokd)")
        sys.exit(1)

    command = sys.argv[1].lower()
    extra_args = sys.argv[2:]

    if command == "build":
        fips_mode = "--fips" in extra_args
        build("khepra", fips=fips_mode)
        build("khepra-agent", fips=fips_mode)
    elif command == "agent":
        run("khepra-agent", extra_args)
    elif command == "cli":
        run("khepra", extra_args)
    elif command == "launch":
        launch()
    elif command == "test":
        print("[Python] Running tests...")
        subprocess.call(["go", "test", "-count=1", "-mod=vendor", "./pkg/...", "./cmd/..."])
    elif command == "validate":
        validate()
    elif command == "tnok":
        print("\n[KHEPRA] 🛡️  Initializing Tnok Stealth Gateway (CSfC Mode)...")
        tnok_path = "./pkg/tnok/tnok"
        
        # 1. Install Tnok in editable mode (if not already)
        print(f"      > Installing Tnok from {tnok_path}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-e", tnok_path], stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            print("❌ Failed to install Tnok. Ensure 'pkg/tnok/tnok' exists and has pyproject.toml.")
            sys.exit(1)

        # 2. Run Tnok Daemon
        print("      > Starting Tnok Daemon (tnokd)...")
        print("      > ℹ️  Use 'tnokd --help' to see options.")
        try:
            # We run tnokd.exe (Windows) or tnokd (Linux) - assuming it's in path after pip install
            # Using sys.executable -m tnokd is safer if it supports it, but pyproject says:
            # tnokd = "tnokd.__main__:main_cli"
            # So we can run: python -m tnokd.__main__
            subprocess.call([sys.executable, "-m", "tnokd.__main__"] + extra_args)
        except KeyboardInterrupt:
            print("\n[KHEPRA] Tnok Stealth Gateway Shutdown.")
    else:
        # Default to CLI if command unknown
        run("khepra", sys.argv[1:])

if __name__ == "__main__":
    main()
