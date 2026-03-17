"""Common data shared between tnok and tnokd.

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
import re
import sys
import struct
import ctypes
import logging
from typing import Optional

import requests

# flake8: noqa
# mypy: disable-error-code="import-untyped"

MAX_UID = 255
KNOCK_MAGIC = b"tk"
KNOCK_HEADER = "!2sI"
KNOCK_HEADER_LEN = struct.calcsize(KNOCK_HEADER)
TLV_HEADER = "!BH"
TLV_HEADER_LEN = struct.calcsize(TLV_HEADER)
PUB_KEY_TAG = 0xBE
DATA_TAG = 0xEF
MAX_DATA_LEN = 1024


def is_user_admin() -> bool:
    """Determine if the user is admin."""
    try:
        is_admin = os.getuid() == 0
    except AttributeError:
        is_admin = ctypes.windll.shell32.IsUserAnAdmin()
    return is_admin


def perror(msg: str) -> None:
    """Helper to print to stderr."""
    print(msg, file=sys.stderr)


def get_public_ip(timeout: float = 0.5) -> Optional[str]:
    """Get our public IP."""
    try:
        # Why? Because, there are rare instances where UDP and TCP take different
        # paths out of a network. For example, testing on an Android phone with Google Fi
        # revealed an issue sending a UDP knock to open a TCP port: The UDP knock comes from
        # IP "X" and the TCP connection later comes from a different IP "Y". Something about the
        # providers 5G or LTE network seems to route UDP and TCP out different IPs (sometimes)
        # so the tnokd servers allows an IP but it's not the right one.
        resp = requests.get('https://api.ipify.org', timeout=timeout)
        resp.raise_for_status()
        public_ip = resp.content.decode('utf-8')
        return public_ip
    except Exception:
        pass
    return None


def get_target_mac(dst_ip: str):
    """Get the dest MAC for the IP."""
    try:
        # pylint: disable=no-name-in-module
        from scapy.all import Ether, ARP, srp, conf
    except Exception as exc:
        logging.error(f"Unable to import scapy. {exc}. Returning broadcast MAC.")
        return "ff:ff:ff:ff:ff:ff"

    # First check if it's in our arp table
    mac = None
    dst_ip_re = re.compile(r"^.*" + re.escape(dst_ip) + r".*$", re.IGNORECASE)
    with os.popen("arp -a") as fh:
        lines = fh.read().splitlines()
    for line in lines:
        if dst_ip_re.match(line):
            try:
                mac = line.split()[1].strip().replace("-", ":")
            except Exception:
                pass
            break
    if mac:
        return mac

    default_gw = conf.route.route("0.0.0.0")[2]
    arp = ARP(pdst=dst_ip)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp

    attempt = 0
    while attempt < 3:
        try:
            ans = srp(packet, timeout=2, verbose=False)[0]
            mac = ans[0][1].hwsrc
            return mac
        except Exception:
            pass
        attempt += 1

    # Probably a timeout - Use gateway
    arp = ARP(pdst=default_gw)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp

    attempt = 0
    while attempt < 3:
        try:
            ans = srp(packet, timeout=2, verbose=False)[0]
            mac = ans[0][1].hwsrc
            return mac
        except Exception:
            pass
        attempt += 1

    # Unable to determine dest MAC
    logging.error(f"Unable to determine dest MAC for {dst_ip}. Using broadcast.")
    return "ff:ff:ff:ff:ff:ff"
