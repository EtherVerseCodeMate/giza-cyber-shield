"""SCP wrapper for tnok.

This file is part of: Tnok - The TOTP port knocker

Copyright (c) 2024-present Assured Information Security (AIS).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
import os
import sys
import time
import subprocess

from tnok.wrappers import find_bin_path, resolve_ssh_scp_destination

SCP_PATH = find_bin_path("scp")
if SCP_PATH is None:
    raise RuntimeError("Unsupported system. Cannot find scp binary in PATH.")


def main_cli():
    """Entry Point."""
    dests = []
    tnok_code = None
    tnok_uid = "admin"
    ssh_port = 22
    print_tnok_usage = False
    tnok_udp = False
    ssh_pos_args = []
    ssh_dash_args = []

    if not sys.argv:
        print_tnok_usage = True

    args = list(sys.argv[1:])  # Make a copy without 0
    while args:
        arg = args.pop(0)
        if arg == "--tnok-code":
            tnok_code = args.pop(0)
        elif arg == "--tnok-uid":
            tnok_uid = args.pop(0)
        elif arg == "--tnok-udp":
            tnok_udp = True
        elif arg in ("-3", "-4", "-6", "-A", "-B", "-C", "-O", "-p", "-q", "-R", "-r", "-s", "-T", "-v"):
            ssh_dash_args.append(arg)
        elif arg == "-P":
            ssh_port = args.pop(0)
            ssh_dash_args.append("-p")
            ssh_dash_args.append(ssh_port)
        elif arg in ("-h", "--help"):
            print_tnok_usage = True
        elif arg and arg.startswith("-"):
            ssh_dash_args.append(arg)
            ssh_dash_args.append(args.pop(0))
        else:
            ssh_pos_args.append(arg)

    if ssh_pos_args:
        for arg in ssh_pos_args:
            if not os.path.exists(arg):
                # Treat as remote and try to resolve
                dest = resolve_ssh_scp_destination(arg.split("@")[-1].split(":")[0])
                if dest:
                    dests.append(dest)
    else:
        print_tnok_usage = True

    if not tnok_code and dests and not print_tnok_usage:
        bin_name = os.path.basename(sys.argv[0])
        if bin_name == "tscp":
            tnok_code = input("Enter 6 digit TOTP code: ")

    rc = 0
    if tnok_code and dests and not print_tnok_usage:
        dests = list(set(dests))  # deduplicate
        for dest in dests:
            if tnok_udp:
                rc = os.system(f"tnok --uid {tnok_uid} --target {dest} --desired-port {ssh_port} --code {tnok_code} -k NokUDP")  # nosemgrep
            else:
                rc = os.system(f"tnok --uid {tnok_uid} --target {dest} --desired-port {ssh_port} --code {tnok_code}")  # nosemgrep
        time.sleep(1)  # nosemgrep

    if rc != 0:
        print("Warning: Knock script failed.")

    rc = os.system(f"{SCP_PATH} {subprocess.list2cmdline(ssh_dash_args)} {subprocess.list2cmdline(ssh_pos_args)}")  # nosemgrep

    if print_tnok_usage:
        print("--tnok-code <TOTP_code>")
        print("--tnok-uid <optional_uid>")

    return rc


if __name__ == "__main__":
    sys.exit(main_cli())
