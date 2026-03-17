"""SSH wrapper for tnok.

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

from tnok.wrappers import find_bin_path, resolve_ssh_scp_destination

SSH_PATH = find_bin_path("ssh")
if SSH_PATH is None:
    raise RuntimeError("Unsupported system. Cannot find ssh binary in PATH.")


def main_cli():
    """Entry Point."""
    dest = None
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
        elif arg in ("-4", "-6", "-A", "-a", "-C", "-f", "-G", "-g", "-K"):
            ssh_dash_args.append(arg)
        elif arg in ("-k", "-M", "-N", "-n", "-q", "-s", "-T", "-t", "-V", "-v", "-X", "-x", "-Y", "-y"):
            ssh_dash_args.append(arg)
        elif arg == "-p":
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
        dest = ssh_pos_args[0]
        if dest:
            dest = dest.split("@")[-1]
    else:
        print_tnok_usage = True

    dest = resolve_ssh_scp_destination(dest)

    if not tnok_code and dest and not print_tnok_usage:
        bin_name = os.path.basename(sys.argv[0])
        if bin_name == "tssh":
            tnok_code = input("Enter 6 digit TOTP code: ")

    rc = 0
    if tnok_code and dest and not print_tnok_usage:
        if tnok_udp:
            rc = os.system(f"tnok --uid {tnok_uid} --target {dest} --desired-port {ssh_port} --code {tnok_code} -k NokUDP")  # nosemgrep
        else:
            rc = os.system(f"tnok --uid {tnok_uid} --target {dest} --desired-port {ssh_port} --code {tnok_code}")  # nosemgrep
        time.sleep(1)  # nosemgrep

    if rc != 0:
        print("Warning: Knock script failed.")

    rc = os.system(f"{SSH_PATH} {' '.join(ssh_dash_args)} {' '.join(ssh_pos_args)}")  # nosemgrep

    if print_tnok_usage:
        print("--tnok-code <TOTP_code>")
        print("--tnok-uid <optional_uid>")

    return rc


if __name__ == "__main__":
    sys.exit(main_cli())
