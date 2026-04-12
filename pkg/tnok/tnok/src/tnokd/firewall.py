"""Firewall management class.

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
import re
import time
import logging
import threading
import subprocess
from typing import List, Dict

from tnokd import TimedCallbackThread, ip_version
from tnokd.errors import UnsupportedBackend


class FirewallManager:
    """Yup...A manager class."""

    timed_callbacks_lock = threading.Lock()
    timed_callbacks: List[TimedCallbackThread] = []
    valid_backends = ["iptables", "firewalld", "netsh", "NetFirewallRule"]

    def __init__(self, firewall_backend: str):
        """Create a firewall manager using the provided backend."""
        if firewall_backend not in self.valid_backends:
            raise UnsupportedBackend(f"Invalid firewall backend {firewall_backend}")
        self.backend = firewall_backend

    def cleanup(self):
        """Cleanup any timed callbacks."""
        with self.timed_callbacks_lock:
            for timed_cb in self.timed_callbacks:
                timed_cb.expire_now()

        # Wait for them to be done and cleaned up
        waited = 0
        while waited < 5.0:
            time.sleep(0.5)  # nosemgrep
            waited += 0.5
            with self.timed_callbacks_lock:
                if len(self.timed_callbacks) == 0:
                    break

    def find_rule_conflicts(self, protected_ports: List[Dict]) -> bool:
        """Find and error out on rule conflicts."""
        if self.backend == "iptables":
            return self._find_rule_conflicts_iptables(protected_ports)
        if self.backend == "firewalld":
            return self._find_rule_conflicts_firewalld(protected_ports)
        if self.backend == "NetFirewallRule":
            return self._find_rule_conflicts_NetFirewallRule(protected_ports)
        if self.backend == "netsh":
            return self._find_rule_conflicts_netsh(protected_ports)
        raise UnsupportedBackend()

    def allow_port(self, src_ip: str, port: int, protocol: str, timeout: float) -> bool:
        """Permit a single source IP to access a port for a certain amount of time."""
        ret = True
        if protocol.strip().lower() in ("tcp", "both") and not self._is_port_allowed(port, "tcp", src_ip):
            ret = self._run_cmds(self._get_allow_cmd(src_ip, port, "tcp"))
            with self.timed_callbacks_lock:
                self.timed_callbacks.append(TimedCallbackThread(timeout, self._allow_port_timeout, src_ip, port, "tcp"))
        if protocol.strip().lower() in ("udp", "both") and not self._is_port_allowed(port, "udp", src_ip):
            ret = self._run_cmds(self._get_allow_cmd(src_ip, port, "udp"))
            with self.timed_callbacks_lock:
                self.timed_callbacks.append(TimedCallbackThread(timeout, self._allow_port_timeout, src_ip, port, "udp"))
        return ret

    def block_port(self, port: int, protocol: str) -> bool:
        """Block the provided port number and type (tcp, udp, or both)."""
        if protocol.strip().lower() in ("tcp", "both") and not self._is_port_blocked(port, "tcp"):
            if not self._run_cmds(self._get_block_port_cmd(port, "tcp")):
                return False
        if protocol.strip().lower() in ("udp", "both") and not self._is_port_blocked(port, "udp"):
            if not self._run_cmds(self._get_block_port_cmd(port, "udp")):
                return False
        logging.info(f"Port {port} blocked for {protocol} protocol(s)")
        return True

    def unblock_port(self, port: int, protocol: str) -> bool:
        """Unblock the provided port number and type (tcp, udp, or both)."""
        if protocol.strip().lower() in ("tcp", "both"):
            if not self._run_cmds(self._get_unblock_port_cmd(port, "tcp")):
                return False
        if protocol.strip().lower() in ("udp", "both"):
            if not self._run_cmds(self._get_unblock_port_cmd(port, "udp")):
                return False
        logging.info(f"Port {port} unblocked for {protocol} protocol(s)")
        return True

    def block_ip(self, ip: str) -> bool:
        """Block the provided IP in the OS' firewall."""
        if self._is_ip_blocked(ip):
            logging.warning(f"IP {ip} is already blocked in firewall.")
            return True

        if not self._run_cmds(self._get_block_ip_cmd(ip)):
            return False
        logging.info(f"IP {ip} has been blocked")
        return True

    def unblock_ip(self, ip: str) -> bool:
        """Unblock the provided IP in the OS' firewall."""
        if not self._run_cmds(self._get_unblock_ip_cmd(ip)):
            return False
        logging.info(f"IP {ip} has been unblocked")
        return True

    def add_always_allow_ip(self, ip: str) -> bool:
        """Always allow traffic to the system from this IP or network."""
        if not self._run_cmds(self._get_add_always_allow_cmd(ip)):
            return False
        logging.info(f"IP {ip} has been added to the always allow list. All traffic will be allowed from this IP/network.")
        return True

    def remove_always_allow_ip(self, ip: str) -> bool:
        """Remove an IP previously added to the always allow list."""
        if not self._run_cmds(self._get_remove_always_allow_cmd(ip)):
            return False
        logging.info(f"IP {ip} removed from always allow list.")
        return True

    def _get_add_always_allow_cmd(self, src_ip: str) -> List[List[str]]:
        """Get the command to always allow traffic from a source IP."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(src_ip, allow_networks=True) == 4 else "ip6tables"
            return [
                [iptables_bin, "-I", "INPUT", "--src", src_ip, "-j", "ACCEPT"]
            ]
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            return [
                [
                    "powershell.exe", "-c", "New-NetFirewallRule",
                    "-DisplayName", f"\"tnokd allow all for {src_ip}\"", "-Action",
                    "Allow", "-Direction", "Inbound", "-Profile", "Any", "-RemoteAddress", src_ip
                ]
            ]
        if self.backend == "netsh":
            return [
                [
                    "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "add", "rule",
                    f"name=\"tnokd allow all for {src_ip}\"", "dir=in", "action=allow",
                    "enable=yes", "profile=any", f"remoteip={src_ip}"
                ]
            ]
        raise UnsupportedBackend()

    def _get_remove_always_allow_cmd(self, src_ip: str) -> List[List[str]]:
        """Get the command to remove a previously added command to always allow traffic from a source IP."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(src_ip, allow_networks=True) == 4 else "ip6tables"
            return [
                [iptables_bin, "-D", "INPUT", "--src", src_ip, "-j", "ACCEPT"]
            ]
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            return [
                [
                    "powershell.exe", "-c", "Remove-NetFirewallRule",
                    "-DisplayName", f"\"tnokd allow all for {src_ip}\""
                ]
            ]
        if self.backend == "netsh":
            return [
                [
                    "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "delete", "rule",
                    f"name=\"tnokd allow all for {src_ip}\""
                ]
            ]
        raise UnsupportedBackend()

    def _get_disallow_port_cmd(self, src_ip: str, port: int, protocol: str) -> List[List[str]]:
        """Get the disallow command(s) for the current OS."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(src_ip) == 4 else "ip6tables"
            return [
                [iptables_bin, "-D", "INPUT", "-p", protocol, "-m", protocol, "--src", src_ip, "--dport", f"{port}", "-j", "ACCEPT"]
            ]
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            return [
                [
                    "powershell.exe", "-c", "Remove-NetFirewallRule",
                    "-DisplayName", f"\"tnokd allow {protocol} {port} for {src_ip}\""
                ]
            ]
        if self.backend == "netsh":
            return [
                [
                    "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "delete", "rule",
                    f"name=\"tnokd allow {protocol} {port} for {src_ip}\""
                ]
            ]
        raise UnsupportedBackend()

    def _get_allow_cmd(self, src_ip: str, port: int, protocol: str) -> List[List[str]]:
        """Get the allow command(s) for the current OS."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(src_ip) == 4 else "ip6tables"
            return [
                [iptables_bin, "-I", "INPUT", "-p", protocol, "-m", protocol, "--src", src_ip, "--dport", f"{port}", "-j", "ACCEPT"]
            ]
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            return [
                [
                    "powershell.exe", "-c", "New-NetFirewallRule",
                    "-DisplayName", f"\"tnokd allow {protocol} {port} for {src_ip}\"", "-Action",
                    "Allow", "-Direction", "Inbound", "-Profile", "Any", "-Protocol", protocol,
                    "-LocalPort", f"{port}", "-RemoteAddress", src_ip
                ]
            ]
        if self.backend == "netsh":
            return [
                [
                    "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "add", "rule",
                    f"name=\"tnokd allow {protocol} {port} for {src_ip}\"", "dir=in", "action=allow",
                    "enable=yes", "profile=any", f"remoteip={src_ip}", f"localport={port}", f"protocol={protocol}"
                ]
            ]
        raise UnsupportedBackend()

    def _get_block_port_cmd(self, port: int, protocol: str) -> List[List[str]]:
        """Get the block command(s) for the current OS."""
        if self.backend == "iptables":
            # iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
            cmds = [
                ["iptables", "-A", "INPUT", "-p", protocol, "-m", "conntrack",
                 "--ctstate", "RELATED,ESTABLISHED", "--destination-port", f"{port}", "-j", "ACCEPT"],
                ["ip6tables", "-A", "INPUT", "-p", protocol, "-m", "conntrack",
                 "--ctstate", "RELATED,ESTABLISHED", "--destination-port", f"{port}", "-j", "ACCEPT"],
                ["iptables", "-A", "INPUT", "-p", protocol, "-m", protocol, "--destination-port", f"{port}", "-j", "DROP"],
                ["ip6tables", "-A", "INPUT", "-p", protocol, "-m", protocol, "--destination-port", f"{port}", "-j", "DROP"]
            ]
            if protocol == "tcp":
                # Don't send RST packets
                cmds.extend([
                    ["iptables", "-A", "OUTPUT", "-p", "tcp", "-m", "tcp", "--sport", f"{port}",
                     "--tcp-flags", "RST", "RST", "-j", "DROP"],
                    ["ip6tables", "-A", "OUTPUT", "-p", "tcp", "-m", "tcp", "--sport", f"{port}",
                     "--tcp-flags", "RST", "RST", "-j", "DROP"]
                ])
            return cmds
        if self.backend == "firewalld":
            raise UnsupportedBackend()
        if self.backend == "NetFirewallRule":
            # Windows firewall is default-deny and it is not possible to create a block rule for a port
            # and then make subsequent allow rules (that are more specific) to allow certain IPs
            # A block rule will always override any allow rule no matter what
            # See:
            # https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules#rule-precedence-for-inbound-rules
            #
            # Because of the default-deny nature of windows, we don't actually need to ever block the port. It's blocked by default.
            return []
        if self.backend == "netsh":
            return []
        raise UnsupportedBackend()

    def _get_unblock_port_cmd(self, port: int, protocol: str) -> List[List[str]]:
        """Get the unblock command(s) for the current OS."""
        if self.backend == "iptables":
            cmds = [
                ["iptables", "-D", "INPUT", "-p", protocol, "-m", protocol, "--destination-port", f"{port}", "-j", "DROP"],
                ["ip6tables", "-D", "INPUT", "-p", protocol, "-m", protocol, "--destination-port", f"{port}", "-j", "DROP"],
                ["iptables", "-D", "INPUT", "-p", protocol, "-m", "conntrack",
                 "--ctstate", "RELATED,ESTABLISHED", "--destination-port", f"{port}", "-j", "ACCEPT"],
                ["ip6tables", "-D", "INPUT", "-p", protocol, "-m", "conntrack",
                 "--ctstate", "RELATED,ESTABLISHED", "--destination-port", f"{port}", "-j", "ACCEPT"],
            ]
            if protocol == "tcp":
                cmds.extend([
                    ["iptables", "-D", "OUTPUT", "-p", "tcp", "-m", "tcp", "--sport", f"{port}",
                     "--tcp-flags", "RST", "RST", "-j", "DROP"],
                    ["ip6tables", "-D", "OUTPUT", "-p", "tcp", "-m", "tcp", "--sport", f"{port}",
                     "--tcp-flags", "RST", "RST", "-j", "DROP"]
                ])
            return cmds
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            # Windows firewall is default-deny and it is not possible to create a block rule for a port
            # and then make subsequent allow rules (that are more specific) to allow certain IPs
            # A block rule will always override any allow rule no matter what
            # See:
            # https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules#rule-precedence-for-inbound-rules
            #
            # Because of the default-deny nature of windows, we don't actually need to ever unblock the port
            # since we never block it in the first place. It's blocked by default.
            return []
        if self.backend == "netsh":
            return []
        raise UnsupportedBackend()

    def _get_block_ip_cmd(self, ip: str) -> List[List[str]]:
        """Get the IP block command(s) for the current OS."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(ip) == 4 else "ip6tables"
            return [
                [iptables_bin, "-I", "INPUT", "--src", ip, "-j", "DROP"]
            ]
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            return [
                [
                    "powershell.exe", "-c", "New-NetFirewallRule",
                    "-DisplayName", f"\"tnokd block {ip}\"", "-Action",
                    "Block", "-Direction", "Inbound", "-Profile", "Any",
                    "-RemoteAddress", ip
                ]
            ]
        if self.backend == "netsh":
            return [
                [
                    "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "add", "rule",
                    f"name=\"tnokd block {ip}\"", "dir=in", "action=block",
                    "enable=yes", "profile=any", f"remoteip={ip}"
                ]
            ]
        raise UnsupportedBackend()

    def _get_unblock_ip_cmd(self, ip: str) -> List[List[str]]:
        """Get the IP unblock command(s) for the current OS."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(ip) == 4 else "ip6tables"
            return [
                [iptables_bin, "-D", "INPUT", "--src", ip, "-j", "DROP"]
            ]
        if self.backend == "firewalld":
            raise NotImplementedError()
        if self.backend == "NetFirewallRule":
            return [
                [
                    "powershell.exe", "-c", "Remove-NetFirewallRule",
                    "-DisplayName", f"\"tnokd block {ip}\""
                ]
            ]
        if self.backend == "netsh":
            return [
                [
                    "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "delete", "rule",
                    f"name=\"tnokd block {ip}\""
                ]
            ]
        raise UnsupportedBackend()

    def _is_port_allowed(self, port: int, protocol: str, src_ip: str) -> bool:
        """Check if the firewall rule already exists to allow this port for this source IP."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(src_ip) == 4 else "ip6tables"
            cmd = [iptables_bin, "-C", "INPUT", "-p", protocol, "-m", protocol, "--src", src_ip, "--dport", f"{port}", "-j", "ACCEPT"]
        elif self.backend == "firewalld":
            raise NotImplementedError()
        elif self.backend == "NetFirewallRule":
            cmd = ["powershell.exe", "-c", "Get-NetFirewallRule", "-DisplayName", f"\"tnokd allow {protocol} {port} for {src_ip}\""]
        elif self.backend == "netsh":
            cmd = ["powershell.exe", "-c", "netsh", "advfirewall", "firewall", "show", "rule", f"name=\"tnokd allow {protocol} {port} for {src_ip}\""]
        else:
            raise UnsupportedBackend()
        return self._run_cmds([cmd], suppress_errors=True)

    def _is_port_blocked(self, port: int, protocol: str) -> bool:
        """Check the firewall to see if the port is already blocked by us."""
        if self.backend == "iptables":
            cmds = [
                ["iptables", "-C", "INPUT", "-p", protocol, "-m", protocol, "--destination-port", f"{port}", "-j", "DROP"],
                ["ip6tables", "-C", "INPUT", "-p", protocol, "-m", protocol, "--destination-port", f"{port}", "-j", "DROP"]
            ]
        elif self.backend == "firewalld":
            raise NotImplementedError()
        elif self.backend == "NetFirewallRule":
            cmds = [
                ["powershell.exe", "-c", "Get-NetFirewallRule", "-DisplayName", f"\"tnokd block {protocol} {port}\""]
            ]
        elif self.backend == "netsh":
            cmds = [
                ["powershell.exe", "-c", "netsh", "advfirewall", "firewall", "show", "rule", f"name=\"tnokd block {protocol} {port}\""]
            ]
        else:
            raise UnsupportedBackend()

        for cmd in cmds:
            if self._run_cmds([cmd], suppress_errors=True):
                return True
        return False

    def _is_ip_blocked(self, ip: str) -> bool:
        """Check the firewall to see if the IP is already blocked by us."""
        if self.backend == "iptables":
            iptables_bin = "iptables" if ip_version(ip) == 4 else "ip6tables"
            cmd = [iptables_bin, "-C", "INPUT", "--src", ip, "-j", "DROP"]
        elif self.backend == "firewalld":
            raise NotImplementedError()
        elif self.backend == "NetFirewallRule":
            cmd = ["powershell.exe", "-c", "Get-NetFirewallRule", "-DisplayName", f"\"tnokd block {ip}\""]
        elif self.backend == "netsh":
            cmd = ["powershell.exe", "-c", "netsh", "advfirewall", "firewall", "show", "rule", f"name=\"tnokd block {ip}\""]
        else:
            raise UnsupportedBackend()
        return self._run_cmds([cmd], suppress_errors=True)

    @staticmethod
    def _run_cmds(cmds: List[List[str]], suppress_errors: bool = False) -> bool:
        """Run a list of commands."""
        success = True
        for cmd in cmds:
            logging.debug(f"Running command: {' '.join(cmd)}")
            try:
                subprocess.check_output(cmd, stderr=subprocess.STDOUT)  # nosemgrep
            except subprocess.CalledProcessError as exc:
                if not suppress_errors:
                    logging.error(f"Failed to run command [{exc.returncode}]: {' '.join(cmd)}")
                    logging.debug("Command Output:\n" + "=" * 80 + f"\n{exc.output.decode()}\n" + "=" * 80 + "\n")
                success = False
        return success

    def _allow_port_timeout(self, obj: TimedCallbackThread, src_ip: str, port: int, protocol: str) -> None:
        """When the timer times out, unpermit the port."""
        logging.info(f"Timer expired for {protocol} {src_ip}:{port}. Closing.")
        with self.timed_callbacks_lock:
            self.timed_callbacks.remove(obj)

        # The allow timeout triggered so now we need to disallow the port again
        self._run_cmds(self._get_disallow_port_cmd(src_ip, port, protocol))

    def _check_iptables_save_output(self, output: bytes, protected_ports: List[Dict], binary: str = "iptables") -> bool:
        """Check for conflicting rules in iptables output."""
        conflicting = False
        lines = output.decode().splitlines()
        for port_schema in protected_ports:
            port = port_schema.number
            port_re = re.compile(r"^.*dport " + f"{port}" + r".*$", re.IGNORECASE)
            for line in lines:
                if port_re.match(line):
                    conflicting = True
                    logging.error(f"Port {port} found in firewall rule: \n\n\t{binary} {line}\n\n\tERROR: This may conflict with tnokd operation.\n")

        return conflicting

    def _find_rule_conflicts_iptables(self, protected_ports: List[Dict]) -> bool:
        """Find rule conflicts on linux with iptables."""
        try:
            output = subprocess.check_output(["iptables-save"], stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to get iptables rules. {exc}")
            logging.debug(f"Command output:\n{exc.output.decode()}")
            return True
        conflicting_ipv4 = self._check_iptables_save_output(output, protected_ports)

        try:
            output = subprocess.check_output(["ip6tables-save"], stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to get ip6tables rules. {exc}")
            logging.debug(f"Command output:\n{exc.output.decode()}")
            return True
        conflicting_ipv6 = self._check_iptables_save_output(output, protected_ports, binary="ip6tables")

        if conflicting_ipv4 or conflicting_ipv6:
            return True
        return False

    def _find_rule_conflicts_firewalld(self, protected_ports: List[Dict]) -> bool:
        """Find rule conflicts on linux with firewalld."""
        raise NotImplementedError()

    def _find_rule_conflicts_netsh(self, protected_ports: List[Dict]) -> bool:
        """Find rule conflicts on win32 with netsh."""
        conflicting = False
        try:
            output = subprocess.check_output([
                "powershell.exe", "-c", "netsh", "advfirewall", "firewall", "show", "rule", "name=all"],
                stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc:
            logging.error("Unable to list netsh firewall rules: {exc}")
            logging.error(exc.output.decode())
            return True

        lines = [x.strip() for x in output.decode().splitlines() if x.strip()]
        enabled_inbound_ports = []
        rule_name = None
        for line in lines:
            try:
                if "Rule Name" in line:
                    rule_name = line.split(":", maxsplit=1)[1].strip()
                    enabled = None
                    direction = None
                    local_port = None

                if rule_name is None:
                    continue

                if enabled is None and "Enabled" in line:
                    enabled = line.split(":", maxsplit=1)[1].strip()
                if direction is None and "Direction" in line:
                    direction = line.split(":", maxsplit=1)[1].strip()
                if local_port is None and "LocalPort" in line:
                    local_port = line.split(":", maxsplit=1)[1].strip()

                if enabled == "Yes" and direction == "In" and local_port is not None:
                    enabled_inbound_ports.append(int(local_port))
                    rule_name = None
            except Exception as exc:
                logging.debug(f"Failed to parse netsh firewall line: {exc}")
                logging.debug(f"Line: {line}")
                rule_name = None
                continue

        for port_schema in protected_ports:
            port = port_schema.number
            if port in enabled_inbound_ports:
                conflicting = True
                logging.error(f"Inbound port {port} found enabled in netsh firewall.\n\n\tERROR: This may conflict with tnokd operation.\n")
                logging.error(f"Make sure to remove any allow rules for port {port} prior to running tnokd.")

        return conflicting

    # pylint: disable=invalid-name
    def _find_rule_conflicts_NetFirewallRule(self, protected_ports: List[Dict]) -> bool:
        """Find rule conflicts on win32 with NetFirewallRule."""
        conflicting = False
        for port_schema in protected_ports:
            port = port_schema.number
            try:
                # nosemgrep
                output = subprocess.check_output([
                    "powershell.exe", "-c",
                    "Get-NetFirewallPortFilter | Where-Object {$_.LocalPort -eq " +
                    f"{port}" + "} | Get-NetFirewallRule | select Name,Enabled,Direction | Format-List"],
                    stderr=subprocess.STDOUT)
            except subprocess.CalledProcessError:
                continue

            obj = {}
            lines = [x.strip() for x in output.decode().splitlines() if x.strip()]
            for line in lines:
                try:
                    key, value = [x.strip() for x in line.split(":", maxsplit=1)]
                except Exception:
                    continue
                obj[key] = value

            if obj.get("Enabled", "") == "True" and obj.get("Direction", "") == "Inbound":
                conflicting = True
                logging.error(f"Port {port} found in firewall rule: {obj.get('Name', '')}\n\n\tERROR: This may conflict with tnokd operation.\n")
                logging.error(f"Make sure to remove any allow rules for port {port} prior to running tnokd.")

        return conflicting
