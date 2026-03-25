"""Wrapper scripts to automate tnok.

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
import socket
from typing import Optional


def _search_dir(path: str, name: str) -> Optional[str]:
    """Search a directory for a file."""
    if not os.path.isdir(path):
        return None

    for fname in os.listdir(path):
        full_path = os.path.join(path, fname)
        if os.path.isdir(full_path):
            continue
        if fname == name:
            return full_path

        # Handle ssh.exe when searching for ssh on Windows for example
        basename, _ext = os.path.splitext(fname)
        if basename == name:
            return full_path

    return None


def _parse_ssh_config_for_name(path: str, name: str) -> Optional[str]:
    """Parse SSH config for a name and return the hostname or IP."""
    lines = None
    try:
        with open(path, "r", encoding='utf-8') as fh:
            lines = fh.read().splitlines()
    except OSError:
        return None

    hostname = None
    ssh_config_hostname = None
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.lower().startswith("host"):
            try:
                ssh_config_hostname = line.split(" ")[1].strip()
            except Exception:
                continue

        if not ssh_config_hostname:
            continue

        if ssh_config_hostname != name:
            ssh_config_hostname = None
            continue

        if line.lower().startswith("hostname"):
            try:
                hostname = line.split(" ")[1]
                return hostname
            except Exception:
                continue

    return None


def find_bin_path(name: str) -> Optional[str]:
    """Find a binaries path by name."""
    self_path = os.path.abspath(os.path.dirname(sys.argv[0]))
    env_path = os.getenv("PATH", None)
    if env_path is None:
        print("Unable to find full path to binary {name}. Could not read PATH environment variable.", file=sys.stderr)
        return None

    path_list = None
    if sys.platform == "win32":
        path_list = env_path.split(";")
    if sys.platform == "linux":
        path_list = env_path.split(":")
    if not path_list:
        print("Empty PATH variable or unsupported platform.", file=sys.stderr)
        return None

    for path_entry in path_list:
        if path_entry == self_path:
            continue  # Don't find ourselves

        bin_path = _search_dir(path_entry, name)
        if bin_path:
            return bin_path

    return None


def resolve_ssh_scp_destination(dest: Optional[str]) -> Optional[str]:
    """Resolve a destination to an IP address."""
    if dest is None:
        return None

    ret = None
    try:
        ret = socket.gethostbyname(dest)
        return ret
    except socket.gaierror:
        # Maybe it's an ssh config entry
        ret = None

    ssh_config_paths = [os.path.join(os.path.expanduser("~"), ".ssh", "config")]

    if sys.platform == "win32":
        program_data = os.getenv("PROGRAMDATA")
        if program_data:
            ssh_config_paths.append(os.path.join(program_data, "ssh", "ssh_config"))
    if sys.platform == "linux":
        ssh_config_paths.append("/etc/ssh/ssh_config")

    for config_path in ssh_config_paths:
        if not os.path.exists(config_path):
            continue

        hostname_or_ip = _parse_ssh_config_for_name(config_path, dest)
        if not hostname_or_ip:
            continue

        try:
            ret = socket.gethostbyname(hostname_or_ip)
            return ret
        except socket.gaierror:
            ret = None  # Just keep looking

    return ret
