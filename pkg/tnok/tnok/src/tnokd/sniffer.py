"""Handles packet sniffing with Scapy.

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
import json
import time
import struct
import logging
import threading
from typing import Callable, List, Dict, Any

# flake8: noqa
# mypy: disable-error-code="import-untyped"

# pylint: disable=no-name-in-module
from scapy.all import conf, TCP, UDP, IP, IPv6, AsyncSniffer

from tnokd.config import load_config
from tnoklib.nok import NokAuth
from tnoklib import (
    KNOCK_MAGIC, KNOCK_HEADER, KNOCK_HEADER_LEN,
    PUB_KEY_TAG, DATA_TAG
)
from tnoklib.pkt import (
    send_tcp_ack, send_tcp_fin_ack, send_tcp_rst,
    send_tcp_synack, tcp_send_tlv, udp_send_tlv, recv_tlv
)


class KnockSniffer:
    """Sniff for valid knock packets and notify a callback."""

    def __init__(self, interfaces: List[str], cb: Callable, trace: bool = False):
        """Knock Sniffer."""
        self.ifaces = interfaces
        self.filter = "tcp or udp"
        self.running = False
        self.trace = trace
        self.thread = threading.Thread(target=self._sniff)
        self.error = None
        self.blocked_ips: List[str] = []
        self.blocked_ips_lock = threading.Lock()
        self.ip_knock_dict: Dict[str, Any] = {}
        self.ip_auth_dict: Dict[str, Any] = {}
        self.ip_pre_auth_dict: Dict[str, Any] = {}
        self.knock_callback = cb
        self.config = load_config()

    def start(self):
        """Start the sniffing thread."""
        if self.knock_callback is None:
            raise ValueError("Code check callback is not registered yet.")

        logging.info("Starting sniff thread")
        self.running = True
        self.thread.start()

    def stop(self, timeout: float = 5.0):
        """Stop the sniffing thread."""
        logging.info("Stopping sniff thread")
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=timeout)
            if self.thread.is_alive():
                raise TimeoutError("Timed out waiting for scapy to stop sniffing.")

    def block_ip(self, ip: str) -> None:
        """Block an IP."""
        logging.debug(f"Ignoring packets from {ip} in sniffer thread.")
        with self.blocked_ips_lock:
            self.blocked_ips.append(ip)

    def unblock_ip(self, ip: str) -> None:
        """Unblock the IP from the sniffer."""
        logging.debug(f"Unblocking packets from {ip} in sniffer thread.")
        with self.blocked_ips_lock:
            if ip in self.blocked_ips:
                self.blocked_ips.remove(ip)

    def _get_code_from_knock(self, data: bytes) -> int:
        if len(data) < KNOCK_HEADER_LEN:
            if self.trace:
                logging.debug(f"Data length {len(data)} incorrect. Expected at least {KNOCK_HEADER_LEN} bytes")
            return -1

        magic, code = struct.unpack(KNOCK_HEADER, data[:KNOCK_HEADER_LEN])
        if KNOCK_MAGIC != magic:
            if self.trace:
                logging.debug(f"Magic mismatch. {magic!r} != {KNOCK_MAGIC!r}")
            return -1
        logging.debug(f"Got code {code} from knock data")
        return code

    def _handle_knock_and_check(self, src_ip: str, dst_port: int, code: int) -> bool:
        # Check if the code is valid for anyone
        if self.knock_callback(src_ip, dst_port, code):
            return True
        logging.debug(f"Code {code} not valid for any users")
        return False

    def _timeout_pending(self):
        for key in list(self.ip_knock_dict.keys()):
            item = self.ip_knock_dict[key]
            if item["timeout"] < time.perf_counter():
                logging.debug(f"Timeout knock {key}")
                del self.ip_knock_dict[key]
        for key in list(self.ip_auth_dict.keys()):
            item = self.ip_auth_dict[key]
            if item["timeout"] < time.perf_counter():
                logging.debug(f"Timeout auth {key}")
                del self.ip_auth_dict[key]
        for key in list(self.ip_pre_auth_dict.keys()):
            item = self.ip_pre_auth_dict[key]
            if item["timeout"] < time.perf_counter():
                logging.debug(f"Timeout preauth {key}")
                del self.ip_pre_auth_dict[key]

    def _packet_callback(self, pkt):
        """Call when a packet that matches our filter is received."""
        try:
            self._handle_packet(pkt)
        except Exception as exc:
            logging.exception(f"Unhandled exception processing packet: {exc}")

    def _handle_packet(self, pkt):
        """Call when a packet that matches our filter is received."""
        self._timeout_pending()

        # pylint: disable=undefined-variable
        if IP not in pkt and IPv6 not in pkt:
            return

        src_ipv4 = None
        src_ipv6 = None
        dst_ipv4 = None
        dst_ipv6 = None
        ttl = 0
        if IP in pkt:
            ttl = pkt[IP].ttl
            src_ipv4 = pkt[IP].src
            dst_ipv4 = pkt[IP].dst
            with self.blocked_ips_lock:
                if src_ipv4 in self.blocked_ips:
                    # The IP will be blocked in the firewall too but we're sniffing
                    # so if we don't ignore it here we'll still see blocked IP traffic
                    return
        if IPv6 in pkt:
            ttl = pkt[IPv6].hlim  # IPv6 is hop limit instead of TTL
            src_ipv6 = pkt[IPv6].src
            dst_ipv6 = pkt[IPv6].dst
            with self.blocked_ips_lock:
                if src_ipv6 in self.blocked_ips:
                    # The IP will be blocked in the firewall too but we're sniffing
                    # so if we don't ignore it here we'll still see blocked IP traffic
                    return

        if src_ipv4 is None and src_ipv6 is None:
            return  # Not a packet we care about

        # An attempt to further limit what we care about.
        # All our clients set TTL/hop limit to 255
        if ttl < 200:
            return

        mss = None
        md5 = None
        mood = None
        tcp = False
        src_ip = src_ipv4 if src_ipv4 else src_ipv6
        dst_ip = dst_ipv4 if dst_ipv4 else dst_ipv6
        if TCP in pkt:
            tcp = True
            src_port = pkt[TCP].sport  # SPORTS!
            dst_port = pkt[TCP].dport
            for option in pkt[TCP].options:
                if option[0] == "MD5":
                    md5 = option[1]
                if option[0] == "Mood":
                    mood = option[1]
                if option[0] == "MSS":
                    mss = option[1]
        elif UDP in pkt:
            src_port = pkt[UDP].sport
            dst_port = pkt[UDP].dport
        else:
            return  # Not a packet we care about

        # We can't rely on source port. For the MSS knock, we can't count on all
        # the SYN packets having the same source b/c of firewalls. For the rest
        # of the TCP knocks, we establish the connect after the knock is complete
        # which will be on a different source port.
        #
        # There is a race condition here, in that two people behind the same public
        # IP can't perform the knock at the same time, but it's a short window
        preauth_key = f"{src_ip}:{dst_ip}:{dst_port}"

        # Once auth begins, the source port should be the same so at that point we can
        # use it for our key
        auth_key = f"{src_ip}:{src_port}:{dst_ip}:{dst_port}"

        # If a knock has been completed we're looking for a SYN to start the auth
        if preauth_key in self.ip_pre_auth_dict:
            if not tcp or pkt[TCP].flags != "S":
                # Expect a TCP SYN. UDP will never need pre-auth.
                del self.ip_pre_auth_dict[preauth_key]
                return

            logging.debug(f"Auth started for {auth_key}")
            self.ip_auth_dict[auth_key] = {
                "timeout": time.perf_counter() + self.config.auth_timeout,
                "state": 0,
                "protocol": "TCP",
                "code": self.ip_pre_auth_dict[preauth_key]["code"],
                "auth": NokAuth()
            }
            del self.ip_pre_auth_dict[preauth_key]
            send_tcp_synack(pkt)
            return  # Done for now

        # If this is part of an auth in progress we can handle it here and return
        if auth_key in self.ip_auth_dict:
            # At this point we have packets from systems that have completed the knock sequence
            # for some user of the system. We need to establish comms and get UID and additional
            # IPs to whitelist
            logging.debug(f"Auth progress {auth_key}: {self.ip_auth_dict[auth_key]['state']}")
            try:
                if tcp:
                    data = self._handle_auth_tcp(auth_key, pkt)
                else:
                    data = self._handle_auth_udp(auth_key, pkt)
                if data is not None:
                    uid = data.get("uid", None)
                    allow_ips = data.get("allow_ips", [])
                    code = self.ip_auth_dict[auth_key]["code"]
                    if uid is None or not isinstance(allow_ips, list):
                        raise ValueError("Invalid data from client")

                    # If successful, this call will permit the IPs
                    if self.knock_callback(src_ip, dst_port, code, uid, allow_ips):
                        # Send the OK back
                        msg = {"status": "ok"}
                        data = json.dumps(msg).encode()
                        cipher_data = self.ip_auth_dict[auth_key]["auth"].encrypt(data)
                        if tcp:
                            tcp_send_tlv(pkt, DATA_TAG, cipher_data)
                        else:
                            udp_send_tlv(pkt, DATA_TAG, cipher_data)

                    # Cleanup
                    if tcp:
                        send_tcp_fin_ack(pkt)
                    del self.ip_auth_dict[auth_key]
            except Exception as exc:
                if self.trace:
                    logging.exception(f"Failed auth for {auth_key}: {exc}")
                else:
                    logging.error(f"Failed auth for {auth_key}: {exc}")
                if tcp:
                    send_tcp_rst(pkt)
                del self.ip_auth_dict[auth_key]
            return  # Done handling packet

        #
        # If we get here, we have a packet not associated with an auth in progress
        # So it has to be a knock, or something we don't care about
        #
        if tcp:
            if mss is None:
                return  # no MSS, not us.
            try:
                # More filtering - we always set MSS less than 400
                mss = int(mss)
                if mss >= 400 or mss < 100:
                    return  # Not a value we would use
            except ValueError:
                return  # Not a number somehow...

            if pkt[TCP].flags != "S":
                return  # We only deal with SYN for TCP with knock packets

        payload = b""
        if hasattr(pkt, "load"):
            payload = pkt.load

        if self.trace:
            logging.debug(f"{'tcp' if tcp else 'udp'}: {src_ip}:{src_port} -> {dst_ip}:{dst_port}: [TTL: {ttl}, MSS: {mss}]: {payload[:80]}...")

        if not tcp:
            # Handle UDP knocks
            code = self._get_code_from_knock(payload)
            if code == -1:
                # It's likely just UDP traffic that's not a knock at all
                return

            if self._handle_knock_and_check(src_ip, dst_port, code):
                # With UDP we go directly to the ip_auth_dict
                logging.debug(f"Successful UDP knock for {dst_port}")
                self.ip_auth_dict[auth_key] = {
                    "timeout": time.perf_counter() + self.config.auth_timeout,
                    "state": 0,
                    "protocol": "UDP",
                    "code": code,
                    "auth": NokAuth()
                }
            return

        # Handle TCP knocks
        data = md5 if md5 else mood
        if data:
            code = self._get_code_from_knock(data)
            if code == -1:
                logging.error("Invalid TCP MD5/Mood knock")
                return

            if self._handle_knock_and_check(src_ip, dst_port, code):
                # For TCP we'll move a preauth entry to an auth entry on the next SYN
                # when the real connection is attempted post-knock
                logging.debug(f"Successful TCP (MD5/Mood) knock for {dst_port}")
                self.ip_pre_auth_dict[preauth_key] = {
                    "timeout": time.perf_counter() + self.config.auth_timeout,
                    "code": code
                }
            return

        # We can use the preauth key here for MSS as well. Source port will be different for each knock packet
        if preauth_key not in self.ip_knock_dict:
            self.ip_knock_dict[preauth_key] = {
                "complete": 0,
                "code": ["0", "0", "0", "0", "0", "0"],
                "timeout": time.perf_counter() + self.config.knock_timeout
            }

        mss_str = str(mss)
        prt = mss_str[0]
        code = mss_str[1:]

        if prt == "1":
            self.ip_knock_dict[preauth_key]["complete"] += 1
            self.ip_knock_dict[preauth_key]["code"][0] = str(code[0])
            self.ip_knock_dict[preauth_key]["code"][1] = str(code[1])
        elif prt == "2":
            self.ip_knock_dict[preauth_key]["complete"] += 1
            self.ip_knock_dict[preauth_key]["code"][2] = str(code[0])
            self.ip_knock_dict[preauth_key]["code"][3] = str(code[1])
        elif prt == "3":
            self.ip_knock_dict[preauth_key]["complete"] += 1
            self.ip_knock_dict[preauth_key]["code"][4] = str(code[0])
            self.ip_knock_dict[preauth_key]["code"][5] = str(code[1])
        else:
            del self.ip_knock_dict[preauth_key]
            return

        if self.trace:
            logging.debug(f"MSS Knock progress {preauth_key}: {self.ip_knock_dict[preauth_key]}")

        if self.ip_knock_dict[preauth_key]["complete"] < 3:
            return
        if self.ip_knock_dict[preauth_key]["complete"] > 3:
            del self.ip_knock_dict[preauth_key]
            return

        try:
            code = ''.join(self.ip_knock_dict[preauth_key]["code"])
        except ValueError:
            del self.ip_knock_dict[preauth_key]
            return

        # Either way we're done with this now
        del self.ip_knock_dict[preauth_key]

        if self.knock_callback(src_ip, dst_port, code):
            logging.debug(f"Successful TCP MSS knock for {dst_port}")
            self.ip_pre_auth_dict[preauth_key] = {
                "timeout": time.perf_counter() + self.config.auth_timeout,
                "code": code
            }

    def _handle_auth_udp(self, key, pkt):
        obj = None
        auth_status = self.ip_auth_dict[key]
        auth = auth_status["auth"]
        if auth_status["state"] == 0:
            logging.debug(f"{key}: Received UDP auth state 0. Sending our public key")
            udp_send_tlv(pkt, PUB_KEY_TAG, auth.pk_bytes)
            other_pk_bytes = recv_tlv(pkt, PUB_KEY_TAG)
            if not other_pk_bytes:
                raise ValueError(f"{key}: Did not receive other public key.")

            logging.debug(f"{key}: Got remote public key")
            auth.derive_session_key(other_pk_bytes)
            auth_status["state"] += 1
        elif auth_status["state"] == 1:
            logging.debug(f"{key}: Received UDP state 1.")
            cipher_data = recv_tlv(pkt, DATA_TAG)
            if not cipher_data:
                raise ValueError(f"{key}: Did not receive encrypted data")

            logging.debug(f"{key}: Got encrypted data")
            resp = auth.decrypt(cipher_data)
            obj = json.loads(resp.decode())
        return obj

    def _handle_auth_tcp(self, key, pkt):
        obj = None
        auth_status = self.ip_auth_dict[key]
        auth = auth_status["auth"]

        if pkt[TCP].flags == "PA" and auth_status["state"] == 0:
            logging.debug(f"{key}: Received push/ack state 0. Sending ACK and our public key")
            send_tcp_ack(pkt)
            tcp_send_tlv(pkt, PUB_KEY_TAG, auth.pk_bytes)
            other_pk_bytes = recv_tlv(pkt, PUB_KEY_TAG)
            if not other_pk_bytes:
                raise ValueError(f"{key}: Did not receive other public key. RST!")

            logging.debug(f"{key}: Got remote public key")
            auth.derive_session_key(other_pk_bytes)
            auth_status["state"] += 1
        elif pkt[TCP].flags == "PA" and auth_status["state"] == 1:
            logging.debug(f"{key}: Received push/ack state 1. Sending ACk")
            send_tcp_ack(pkt)
            cipher_data = recv_tlv(pkt, DATA_TAG)
            if not cipher_data:
                raise ValueError(f"{key}: Did not receive encrypted data")

            logging.debug(f"{key}: Got encrypted data")
            resp = auth.decrypt(cipher_data)
            obj = json.loads(resp.decode())
        return obj

    def _sniff(self):
        """Sniff for UDP packets."""
        if not self.ifaces:
            # No interface will capture on all interfaces
            self.ifaces = None

        # This greatly improves the performance of scapy by skipping
        # certain dissect layers and only doing the ones we actually need
        # pylint: disable=undefined-variable
        conf.layers.filter([IP, IPv6, TCP, UDP])
        try:
            sniffer = AsyncSniffer(
                iface=self.ifaces,
                prn=self._packet_callback,
                filter=self.filter, store=False)
            sniffer.start()
        except Exception as exc:
            self.error = f"Failed to start packet sniffer: {exc}"
            logging.error(self.error)
            sniffer.stop()
            self.running = False
            return

        while self.running:
            time.sleep(0.1)  # nosemgrep
