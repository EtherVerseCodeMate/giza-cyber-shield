"""tnokd TOTP Port Knocking service.

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
import time
import threading
from typing import Any

from ipaddress import ip_address, IPv4Address, IPv6Address, ip_network, IPv4Network, IPv6Network


class TimedCallbackThread:
    """Call a callback after a certain amount of time on a different thread."""

    def __init__(self, timeout: float, callback, *args):
        """Create the timed callback thread."""
        self.timeout = timeout
        self.callback = callback
        self.args = args
        self.expired = False
        self.thread = threading.Thread(target=self._run)
        self.thread.start()

    def expire_now(self):
        """Expire the timer now."""
        self.expired = True

    def _run(self):
        """Sleep for the set amount of time and call the callback."""
        waited = 0.0
        while not self.expired:
            time.sleep(0.1)  # nosemgrep
            waited += 0.1
            if waited >= self.timeout:
                self.expired = True
        self.callback(self, *self.args)


def ip_version(ip: str, allow_networks: bool = False) -> int:
    """Detect ipv4 or ipv6 address."""
    # Raises ValueError if invalid
    addr: Any = None
    try:
        addr = ip_address(ip)
    except ValueError:
        if not allow_networks:
            raise
        # Raises ValueError if invalid
        addr = ip_network(ip)

    if isinstance(addr, IPv4Address):
        return 4
    if isinstance(addr, IPv6Address):
        return 6
    if isinstance(addr, IPv4Network):
        return 4
    if isinstance(addr, IPv6Network):
        return 6
    raise ValueError(f"Invalid IP address {ip}")
