"""tnokd service config.

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
import logging
import ipaddress
from typing import Optional, List, Any

# flake8: noqa
# mypy: disable-error-code="import-untyped"

from cincoconfig import (
    Schema, Config, StringField, make_type,
    ListField, IntField, BoolField, FloatField, PortField
)

port_schema = Schema()
port_schema.number = PortField(required=True)
port_schema.protocol = StringField(choices=["tcp", "udp", "both"], required=True)
PortConfig = make_type(port_schema, 'PortConfig')

schema = Schema()

# Basic config
schema.listen_interfaces = ListField(StringField(), default=lambda: [])  # nosemgrep
schema.protected_ports = ListField(port_schema, default=lambda: [])  # nosemgrep
schema.port_open_duration = FloatField(default=3600.0, min=0.1)
schema.persist_protected_ports = BoolField(default=False)
schema.linux_firewall_backend = StringField(default="iptables", choices=["iptables", "firewalld"])
schema.win32_firewall_backend = StringField(default="NetFirewallRule", choices=["NetFirewallRule", "netsh"])
schema.knock_timeout = IntField(default=10, min=5)
schema.auth_timeout = IntField(default=15, min=5)
schema.totp_previous_code_window = IntField(default=30, min=0, max=30)
schema.always_allow_from = ListField(StringField(), default=lambda: [])  # nosemgrep

# IP blocking
schema.ip_blocking.max_attempts = IntField(default=3, min=0)
schema.ip_blocking.attempt_within = IntField(default=300, min=30)
schema.ip_blocking.enabled = BoolField(default=True)
schema.ip_blocking.expire_after = IntField(default=0, min=0)
schema.ip_blocking.persist = BoolField(default=True)


def _is_link_local(ip_str: str) -> bool:
    """Check if an IP address is a link-local address."""
    ip = ipaddress.ip_address(ip_str)
    return ip.is_link_local  # nosemgrep


def get_scapy_ifaces(get_all: bool = False) -> List[Any]:
    """Get interfaces from Scapy that could be used as the listen interface."""
    # pylint: disable=no-name-in-module
    from scapy.all import get_working_ifaces
    ret = []
    try:
        for iface in get_working_ifaces():
            ips = iface.ips.get(4, []) + iface.ips.get(6, [])
            if not get_all:
                if not ips or "127.0.0.1" in ips or "::1" in ips:
                    logging.debug(f"Skipping iface {iface.name}. No IP or lo")
                    continue  # Skip lo and ifaces without an IP address
                if iface.dummy:
                    logging.debug(f"Skipping iface {iface.name}. Dummy iface")
                    continue  # Skip dummy interface
                skip = False
                for ip_str in ips:
                    if _is_link_local(ip_str):
                        logging.debug(f"Skipping iface {iface.name}. Link-local address.")
                        skip = True
                if skip:
                    continue

            logging.debug(f"iface {iface.name} has IPS: {', '.join(ips)}")
            ret.append(iface)
    except Exception as exc:
        logging.error(f"Failed to get interfaces: {exc}")
        return []
    return ret


def get_inet_iface_name() -> str:
    """Try to determine the interface that has the host's internet connection."""
    # pylint: disable=no-name-in-module
    from scapy.all import conf
    iface, _, _ = conf.route.route("8.8.8.8")
    return iface


def _set_sane_defaults(config: Config) -> None:
    """Pick sane defaults for values based on OS and interfaces."""
    if sys.platform == "win32":
        if sys.getwindowsversion().major == 6:  # Windows 7
            config.win32_firewall_backend = "netsh"
        # On windows, we can't allow related/established like we can on Linux so just leave the port open for an hour
        config.port_open_duration = 3600.0
    elif sys.platform == "linux":
        # On Linux with iptables, we can add a rule that allows the protected ports to continue
        # working after they are closed if a connection has been established. So we can greatly
        # reduce the window of time the port is open for a given IP.
        config.port_open_duration = 60.0

    # Auto set the interface that makes sense
    config.listen_interfaces = [get_inet_iface_name()]


CONFIG = None


def load_config(path: Optional[str] = None) -> Config:
    """Load the config file."""
    # pylint: disable=global-statement
    global CONFIG
    if CONFIG is not None:
        return CONFIG

    if path is None:
        raise ValueError("Config has not already been loaded. A path is required.")

    CONFIG = schema()
    if os.path.exists(path):
        CONFIG.load(path, format='json')
    else:
        logging.info(f"Default config created at {path}. Make sure to update with interface and protected_ports")
        _set_sane_defaults(CONFIG)
        CONFIG.save(path, format='json')
    return CONFIG
