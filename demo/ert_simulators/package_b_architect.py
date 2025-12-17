import time
import sys
import random

def print_slow(str):
    for char in str:
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(0.005)
    print("")

def spin_cursor(duration):
    chars = "/-\|" 
    end_time = time.time() + duration
    while time.time() < end_time:
        for char in chars:
            sys.stdout.write(f"\r[*] Building Graph... {char}")
            sys.stdout.flush()
            time.sleep(0.1)

print("\033[96m") # Cyan text
print("================================================================")
print(" KHEPRA PROTOCOL // TIER II: OPERATIONAL WEAPONS SYSTEM")
print(" DIGITAL TWIN & SUPPLY CHAIN HUNTER v1.1.0")
print("================================================================")
print("\033[0m")

input("Press ENTER to Activate Graph Construction...")

print_slow("[*] Connecting to Enterprise CMDB...")
print_slow("[*] Ingesting AWS CloudTrail Logs...")
print_slow("[*] Ingesting Jira/ServiceNow Workflows...")

print("")
spin_cursor(3)
print("\r[*] Building Graph... COMPLETE          ")

print_slow("\n[+] CONOPS DIGITAL TWIN ACTIVE")
print_slow("    -> Nodes: 14,203")
print_slow("    -> Edges: 89,441 (Data Flows)")
print_slow("    -> Shadow IT Detected: 4 Enclaves")

print("\n[*] Starting 'Supply Chain Hunter' Deep Scan...")
vendors = ["SolarWinds_Plugin_v12", "Log4j_Legacy", "PyTorch_Training_Data", "Payment_Gateway_API"]
risks = ["HIGH", "CRITICAL", "LOW", "MEDIUM"]

for v in vendors:
    status = random.choice(risks)
    color = "\033[91m" if status in ["HIGH", "CRITICAL"] else "\033[92m"
    print(f"    Scanning {v}...", end="")
    time.sleep(0.4)
    print(f"{color} [RISK: {status}]\033[0m")
    if status == "CRITICAL":
        print(f"      \033[93m-> ALERT: Maintaining Entity linked to sanctioned nation-state.\033[0m")

print("\n[*] Calculating Friction Heatmap...")
time.sleep(1)
print(">>> HOTSPOT: DevOps Team has 'Accountable' role but 0 'Access' to Prod Keys.")
print(">>> EXPOSURE: 3rd Party Vendor has Unmonitored Write Access to CI/CD Pipeline.")

print_slow("\n[+] Architecture & Supply Chain Assessment Complete.")
