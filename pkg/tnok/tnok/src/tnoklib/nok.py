"""Knock methods.

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
import json
import struct
import socket
import logging
import traceback
from typing import List, Union, Optional, Dict, Any

from netaddr import IPAddress

# flake8: noqa
# mypy: disable-error-code="import-untyped"

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes, serialization, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from tnoklib import (
    get_public_ip, is_user_admin, MAX_UID, KNOCK_HEADER, KNOCK_MAGIC,
    TLV_HEADER, MAX_DATA_LEN, TLV_HEADER_LEN, PUB_KEY_TAG, DATA_TAG
)


class NokAuth:
    """Stores temporary authentication/encryption values."""

    def __init__(self):
        """Initialize the private/public keypair for exchange."""
        self.private_key = ec.generate_private_key(ec.SECP521R1(), backend=default_backend())
        self.public_key = self.private_key.public_key()
        self.pk_bytes = self.public_key.public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.SubjectPublicKeyInfo)
        self.other_pk = None
        self.shared_key = None
        self.derived_key = None

    def derive_session_key(self, other_pk_bytes: bytes):
        """Load in the other end's public key and generate a shared session key."""
        self.other_pk = serialization.load_der_public_key(other_pk_bytes, backend=default_backend())
        self.shared_key = self.private_key.exchange(ec.ECDH(), self.other_pk)
        self.derived_key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=None,
            backend=default_backend()
        ).derive(self.shared_key)

    def encrypt(self, cleartext: bytes) -> bytes:
        """Encrypt a message and return ciphertext. Handles IV and padding."""
        if not self.derived_key:
            raise ValueError("Can't encrypt before call to derive a session key.")

        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(cleartext) + padder.finalize()

        iv = os.urandom(16)

        cipher = Cipher(algorithms.AES(self.derived_key), modes.CBC(iv), backend=default_backend())  # nosemgrep
        encryptor = cipher.encryptor()
        cipher_data = encryptor.update(padded_data) + encryptor.finalize()
        cipher_data = iv + cipher_data
        return cipher_data

    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt a message and return the clear text."""
        if not self.derived_key:
            raise ValueError("Can't decrypt before call to derive a session key.")

        if len(ciphertext) <= 16:
            raise ValueError("Not enough data to decrypt")

        iv = ciphertext[:16]
        ciphertext = ciphertext[16:]
        if not ciphertext:
            raise ValueError("Not enough data to decrypt")

        dec_cipher = Cipher(algorithms.AES(self.derived_key), modes.CBC(iv), backend=default_backend())  # nosemgrep
        decryptor = dec_cipher.decryptor()
        padded_resp = decryptor.update(ciphertext) + decryptor.finalize()

        unpadder = padding.PKCS7(128).unpadder()
        resp = unpadder.update(padded_resp) + unpadder.finalize()
        return resp


class Nok:
    """A Knock technique."""

    TECHNIQUES: Dict[str, Any] = {}

    def __init__(self, code: str, uid: str, target_ip: str, port: int, allow_ips: Optional[List[str]] = None):
        """Create a Nok object to perform a port knock."""
        self.code = code
        self.uid = uid
        self.target_ip = target_ip
        self.port = port
        self.allow_ips = allow_ips or []
        self.public_ip = None
        self.code_int = int(code)  # Raises value error if invalid

        if self.need_admin() and not is_user_admin():
            raise PermissionError("Admin required to use this Knock technique")

        try:
            dst = IPAddress(target_ip)

            # Only get the public IP if the destination is global
            if dst.is_global():
                self.public_ip = get_public_ip()
                logging.debug(f"Got public IP: {self.public_ip}")
        except Exception as exc:
            logging.debug(f"Unable to get public IP: {exc}")

        if len(uid) > MAX_UID:
            raise ValueError(f"UID must be {MAX_UID} characters or less")
        if self.code_int > 999999:
            raise ValueError(f"Code {code} is too large. Should only be 6 digits max")

        if self.public_ip:
            self.allow_ips.append(self.public_ip)

    @staticmethod
    def register_nok_technique(reg_cls) -> None:
        """Register a knock technique that can be used."""
        Nok.TECHNIQUES[reg_cls.__name__] = reg_cls

    def need_admin(self) -> bool:
        """Return True if the technique needs admin to work. False otherwise."""
        # pylint: disable=assignment-from-none
        ret = self._need_admin()
        if ret is not None:
            return ret

        if sys.platform == "win32":
            # By default, on Windows, Npcap installs in a way that allows non-admin users to craft packets
            # So on Windows we should never need admin. If npcap is installed to require admin, then we will
            # always need admin on windows even for the techniques that work on Linux without admin (with the
            # exception of the UDP technique which never needs admin)
            return False
        return True

    def _need_admin(self) -> Optional[bool]:
        """Can be implemented by sub-classes to override defaults."""
        return None

    def _nok(self) -> Union[socket.socket, None]:
        """Must be implemented by sub-classes knock. Returns the socket for replies or scapy IP packet sent."""
        raise NotImplementedError()

    def _connect(self, timeout: float = 10.0) -> Optional[socket.socket]:
        """A basic connect to target IP and port."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        logging.debug("Knock complete. Connecting TCP...")
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 255)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(timeout)
            sock.connect((self.target_ip, self.port))
        except socket.timeout:
            sock.close()
            return None
        except Exception as exc:
            logging.error(f"Failed to connect: {exc}")
            sock.close()
            return None
        logging.debug("Connection established. Begin auth...")
        return sock

    def nok(self):
        """Nok using this class' technique."""
        logging.info(f"Performing Knock {type(self).__name__} to {self.target_ip}:{self.port}")
        obj = self._nok()
        if not obj:
            raise ValueError("Knock could not be completed")

        if isinstance(obj, socket.socket):
            self._handle_socket(obj)
        else:
            raise TypeError("Knock failed.")

    def _socket_recv_tlv(self, sock: socket.socket, expect_tag: int) -> bytes:
        data, _server = sock.recvfrom(MAX_DATA_LEN)
        tag, length = struct.unpack(TLV_HEADER, data[:TLV_HEADER_LEN])
        if tag != expect_tag:
            raise TypeError("Received invalid tag during auth")
        data = data[TLV_HEADER_LEN:]
        if len(data) != length:
            raise ValueError("Mismatch data length.")
        return data

    def _socket_send_tlv(self, sock: socket.socket, tag: int, value: bytes):
        data = struct.pack(TLV_HEADER, tag, len(value))
        data += value
        if len(data) > MAX_DATA_LEN:
            raise ValueError(f"TLV too long. Must not exceed {MAX_DATA_LEN}")
        sock.sendto(data, (self.target_ip, self.port))

    def _handle_socket(self, sock: socket.socket):
        auth = NokAuth()
        self._socket_send_tlv(sock, PUB_KEY_TAG, auth.pk_bytes)
        other_pk_bytes = self._socket_recv_tlv(sock, PUB_KEY_TAG)
        auth.derive_session_key(other_pk_bytes)

        data_dict = {"uid": self.uid, "allow_ips": self.allow_ips}
        data = json.dumps(data_dict).encode()

        cipher_data = auth.encrypt(data)
        self._socket_send_tlv(sock, DATA_TAG, cipher_data)
        cipher_resp = self._socket_recv_tlv(sock, DATA_TAG)
        resp = auth.decrypt(cipher_resp).decode()

        data_dict = json.loads(resp)
        if data_dict.get("status") == "ok":
            logging.info("Knock completed successfully")
            return

        raise ValueError("Invalid response")


class NokTCPMood(Nok):
    """A knock technique using the TCP Mood option."""

    def _nok(self):
        try:
            # pylint: disable=no-name-in-module
            from scapy.all import TCP, IP, send, RandInt, RandShort
        except Exception as exc:
            logging.error(f"Unable to import Scapy. {exc}. Cannot use NokTCPMood.")
            return None

        tcp_mood = struct.pack(KNOCK_HEADER, KNOCK_MAGIC, self.code_int)

        # Add in the normal options too
        tcp_options = [
            ("Mood", tcp_mood),
            ("MSS", 399), ("WScale", 0),
            ("SAckOK", b""), ("EOL", b"")
        ]

        ip = IP(dst=self.target_ip, ttl=255)
        syn = TCP(sport=RandShort(), dport=self.port, flags="S", seq=RandInt(), options=tcp_options)
        packet = ip / syn
        send(packet, verbose=False)
        time.sleep(0.5)  # nosemgrep
        return self._connect()


class NokTCPMD5(Nok):
    """A knock technique using TCP MD5 option."""

    def _nok(self):
        try:
            # pylint: disable=no-name-in-module
            from scapy.all import TCP, IP, send, RandInt, RandShort
        except Exception as exc:
            logging.error(f"Unable to import Scapy. {exc}. Cannot use NokTCPMood.")
            return None

        # Add in the normal options too
        tcp_md5 = struct.pack(KNOCK_HEADER, KNOCK_MAGIC, self.code_int)
        tcp_md5 += b"\xFF" * (16 - len(tcp_md5))  # Pad

        # Add in the normal options too
        tcp_options = [
            ("MD5", tcp_md5),
            ("MSS", 399), ("WScale", 0),
            ("SAckOK", b""), ("EOL", b"")
        ]

        ip = IP(dst=self.target_ip, ttl=255)
        syn = TCP(sport=RandShort(), dport=self.port, flags="S", seq=RandInt(), options=tcp_options)
        packet = ip / syn
        send(packet, verbose=False)
        time.sleep(0.5)  # nosemgrep
        return self._connect()


class NokTCPMSS(Nok):
    """A knock technique using TCP MSS option and multiple connects."""

    def _need_admin(self):
        # This method never needs admin
        return False

    def _connect_part(self, mss: str) -> Optional[socket.socket]:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        logging.debug(f"Knocking MSS: {mss}")
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_WINDOW_CLAMP, 1113)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_MAXSEG, int(mss))
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 255)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(0.25)
            sock.connect((self.target_ip, self.port))
        except socket.timeout:
            sock.close()
            return None
        except Exception as exc:
            logging.error(f"Failed MSS knock part: {exc}")
            traceback.print_exc()
            sock.close()
            return None
        logging.warning("Connection completed before knock was done. Is the port already open?")
        logging.warning("If this knock fails, try to connect to the port. It might be open already.")
        return sock

    def _nok_mss_win32(self, mss_1: int, mss_2: int, mss_3: int):
        try:
            # pylint: disable=no-name-in-module
            from scapy.all import TCP, IP, send, RandInt, RandShort
        except Exception as exc:
            logging.error(f"Unable to import Scapy. {exc}. Cannot use NokTCPMood.")
            return None

        # On win32 we can't use setsockopt for the MSS
        # but we can craft packets as non-admin with default
        # install of npcap
        tcp_options_1 = [
            ("MSS", mss_1), ("WScale", 0),
            ("SAckOK", b""), ("EOL", b"")
        ]
        tcp_options_2 = [
            ("MSS", mss_2), ("WScale", 0),
            ("SAckOK", b""), ("EOL", b"")
        ]
        tcp_options_3 = [
            ("MSS", mss_3), ("WScale", 0),
            ("SAckOK", b""), ("EOL", b"")
        ]

        ip = IP(dst=self.target_ip, ttl=255)
        syn_1 = TCP(sport=RandShort(), dport=self.port, flags="S", seq=RandInt(), options=tcp_options_1)
        syn_2 = TCP(sport=RandShort(), dport=self.port, flags="S", seq=RandInt(), options=tcp_options_2)
        syn_3 = TCP(sport=RandShort(), dport=self.port, flags="S", seq=RandInt(), options=tcp_options_3)
        packet_1 = ip / syn_1
        packet_2 = ip / syn_2
        packet_3 = ip / syn_3

        logging.debug(f"Knocking MSS scapy: {mss_1}")
        send(packet_1, verbose=False)
        time.sleep(0.5)  # nosemgrep

        logging.debug(f"Knocking MSS scapy: {mss_2}")
        send(packet_2, verbose=False)
        time.sleep(0.5)  # nosemgrep

        logging.debug(f"Knocking MSS scapy: {mss_3}")
        send(packet_3, verbose=False)
        time.sleep(0.5)  # nosemgrep

        return self._connect()

    def _nok(self):
        mss_1 = int(f"1{self.code[:2]}")
        mss_2 = int(f"2{self.code[2:4]}")
        mss_3 = int(f"3{self.code[4:6]}")

        if sys.platform == "win32":
            return self._nok_mss_win32(mss_1, mss_2, mss_3)

        sock = self._connect_part(mss_1)
        if sock:
            sock.close()
        time.sleep(0.5)  # nosemgrep

        sock = self._connect_part(mss_2)
        if sock:
            sock.close()
        time.sleep(0.5)  # nosemgrep

        sock = self._connect_part(mss_3)
        if sock:
            sock.close()
        time.sleep(0.5)  # nosemgrep

        return self._connect()


class NokUDP(Nok):
    """A knock technique using UDP."""

    def _need_admin(self):
        # This method never needs admin
        return False

    def _nok(self) -> socket.socket:
        payload = struct.pack(KNOCK_HEADER, KNOCK_MAGIC, self.code_int)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 255)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(25.0)
        logging.debug(f"Sending UDP knock to: {self.target_ip}:{self.port}")
        sock.sendto(payload, (self.target_ip, self.port))
        return sock


Nok.register_nok_technique(NokTCPMD5)
Nok.register_nok_technique(NokTCPMood)
Nok.register_nok_technique(NokTCPMSS)
Nok.register_nok_technique(NokUDP)
