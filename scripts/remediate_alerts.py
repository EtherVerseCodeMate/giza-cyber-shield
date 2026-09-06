#!/usr/bin/env python3
import json
import re
import subprocess
import os

ALERTS_FILE = 'alerts.json'

def run_command(cmd, cwd=None):
    print(f"Running: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True, cwd=cwd)
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")

def parse_alerts():
    if not os.path.exists(ALERTS_FILE):
        print(f"File {ALERTS_FILE} not found.")
        return

    with open(ALERTS_FILE, 'r') as f:
        alerts = json.load(f)

    open_alerts = [a for a in alerts if a.get('state') == 'open']
    print(f"Found {len(open_alerts)} open alerts.")

    # Group updates by directory and ecosystem
    updates = {
        'go': {},  # {dir: {package: version}}
        'npm': {}  # {dir: {package: version}}
    }

    for alert in open_alerts:
        msg = alert.get('most_recent_instance', {}).get('message', {}).get('text', '')
        path = alert.get('most_recent_instance', {}).get('location', {}).get('path', '')
        
        if not msg or not path:
            continue
            
        # Parse package and fixed version
        pkg_match = re.search(r'Package:\s*([^\n]+)', msg)
        fix_match = re.search(r'Fixed Version:\s*([^\n]+)', msg)
        
        if pkg_match and fix_match:
            pkg = pkg_match.group(1).strip()
            fixed_version = fix_match.group(1).strip()
            
            # Format version correctly (Go uses v prefix usually, but Trivy sometimes gives it without v)
            if path.endswith('go.mod'):
                ecosystem = 'go'
                if not fixed_version.startswith('v'):
                    fixed_version = 'v' + fixed_version
            elif path.endswith('package.json'):
                ecosystem = 'npm'
            elif path.endswith('yarn.lock'):
                ecosystem = 'npm'
                path = path.replace('yarn.lock', 'package.json')
            else:
                continue

            dir_path = os.path.dirname(path)
            if not dir_path:
                dir_path = '.'

            if pkg not in updates[ecosystem].setdefault(dir_path, {}):
                updates[ecosystem][dir_path][pkg] = fixed_version
            else:
                # If multiple alerts for same package with different fixed versions, take the latest (alphanumeric for simplicity here, though semver parsing is better)
                if fixed_version > updates[ecosystem][dir_path][pkg]:
                    updates[ecosystem][dir_path][pkg] = fixed_version

    # Apply Go updates
    for dir_path, pkgs in updates['go'].items():
        print(f"\n--- Applying Go updates in {dir_path} ---")
        for pkg, version in pkgs.items():
            cmd = ['go', 'get', f"{pkg}@{version}"]
            run_command(cmd, cwd=dir_path)
        
        print("Running go mod tidy...")
        run_command(['go', 'mod', 'tidy'], cwd=dir_path)

    # Apply NPM updates
    for dir_path, pkgs in updates['npm'].items():
        print(f"\n--- Applying NPM updates in {dir_path} ---")
        # To avoid massive argument lists or conflicts, update them one by one or in batches.
        for pkg, version in pkgs.items():
            cmd = ['npm', 'install', f"{pkg}@{version}"]
            run_command(cmd, cwd=dir_path)

if __name__ == '__main__':
    parse_alerts()
