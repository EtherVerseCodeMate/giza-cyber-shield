"""TCP/UDP Scapy helper methods.

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
import struct
import logging
from typing import Optional

# flake8: noqa
# mypy: disable-error-code="import-untyped"

# pylint: disable=no-name-in-module
from scapy.all import TCP, UDP, IP, IPv6, Ether, RandInt, sendp
from tnoklib import TLV_HEADER, TLV_HEADER_LEN


def send_tcp_synack(src_pkt):
    """Uses Scapy to send a TCP SYN/ACK packet in reply to src_pkt."""
    ether = Ether(dst=src_pkt[Ether].src)
    if IP in src_pkt:
        ip = IP(dst=src_pkt[IP].src)
    elif IPv6 in src_pkt:
        ip = IPv6(dst=src_pkt[IPv6].src)
    else:
        raise ValueError("No IP in packet!")

    synack = TCP(
        flags="SA",
        sport=src_pkt[TCP].dport,
        dport=src_pkt[TCP].sport,
        seq=RandInt(),
        ack=int(src_pkt[TCP].seq) + 1,
        options=src_pkt[TCP].options)
    new_pkt = ether / ip / synack
    sendp(new_pkt, verbose=False)


def send_tcp_ack(src_pkt):
    """Uses Scapy to send a TCP ACK packet in reply to src_pkt."""
    ether = Ether(dst=src_pkt[Ether].src)
    if IP in src_pkt:
        ip = IP(dst=src_pkt[IP].src)
    elif IPv6 in src_pkt:
        ip = IPv6(dst=src_pkt[IPv6].src)
    else:
        raise ValueError("No IP in packet!")

    payload_len = 1
    if hasattr(src_pkt, "load"):
        payload_len = len(src_pkt.load)

    ack = TCP(
        flags="A",
        sport=src_pkt[TCP].dport,
        dport=src_pkt[TCP].sport,
        seq=src_pkt[TCP].ack,
        ack=src_pkt[TCP].seq + payload_len,
        options=src_pkt[TCP].options)
    new_pkt = ether / ip / ack
    sendp(new_pkt, verbose=False)


def send_tcp_rst(src_pkt):
    """Uses Scapy to send a TCP RST packet in reply to src_pkt."""
    ether = Ether(dst=src_pkt[Ether].src)
    if IP in src_pkt:
        ip = IP(dst=src_pkt[IP].src)
    elif IPv6 in src_pkt:
        ip = IPv6(dst=src_pkt[IPv6].src)
    else:
        raise ValueError("No IP in packet!")

    rst = TCP(
        flags="R",
        sport=src_pkt[TCP].dport,
        dport=src_pkt[TCP].sport,
        seq=src_pkt[TCP].ack,
        options=src_pkt[TCP].options)
    new_pkt = ether / ip / rst
    sendp(new_pkt, verbose=False)


def send_tcp_fin_ack(src_pkt):
    """Uses Scapy to send a TCP FIN/ACK packet in reply to src_pkt."""
    ether = Ether(dst=src_pkt[Ether].src)
    if IP in src_pkt:
        ip = IP(dst=src_pkt[IP].src)
    elif IPv6 in src_pkt:
        ip = IPv6(dst=src_pkt[IPv6].src)
    else:
        raise ValueError("No IP in packet!")

    payload_len = 1
    if hasattr(src_pkt, "load"):
        payload_len = len(src_pkt.load)

    finack = TCP(
        flags="FA", sport=src_pkt[TCP].dport,
        dport=src_pkt[TCP].sport, seq=src_pkt[TCP].ack,
        ack=src_pkt[TCP].seq + payload_len,
        options=src_pkt[TCP].options)
    new_pkt = ether / ip / finack
    sendp(new_pkt, verbose=False)


def send_tcp_push_ack(src_pkt, data):
    """Uses Scapy to send a TCP PUSH/ACK packet in reply to src_pkt."""
    ether = Ether(dst=src_pkt[Ether].src)
    if IP in src_pkt:
        ip = IP(dst=src_pkt[IP].src)
    elif IPv6 in src_pkt:
        ip = IPv6(dst=src_pkt[IPv6].src)
    else:
        raise ValueError("No IP in packet!")

    payload_len = 1
    if hasattr(src_pkt, "load"):
        payload_len = len(src_pkt.load)

    pushack = TCP(
        flags="PA", sport=src_pkt[TCP].dport,
        dport=src_pkt[TCP].sport, seq=src_pkt[TCP].ack,
        ack=src_pkt[TCP].seq + payload_len,
        options=src_pkt[TCP].options)
    new_pkt = ether / ip / pushack / data
    sendp(new_pkt, verbose=False)


def tcp_send_tlv(src_pkt, tag, value: bytes):
    """Helper method to send TLV data via TCP."""
    data = struct.pack(TLV_HEADER, tag, len(value))
    data += value
    send_tcp_push_ack(src_pkt, data)


def udp_send_tlv(src_pkt, tag, value):
    """Helper method to send TLV data via UDP."""
    data = struct.pack(TLV_HEADER, tag, len(value))
    data += value

    ether = Ether(dst=src_pkt[Ether].src)
    if IP in src_pkt:
        ip = IP(dst=src_pkt[IP].src)
    elif IPv6 in src_pkt:
        ip = IPv6(dst=src_pkt[IPv6].src)
    else:
        raise ValueError("No IP in packet!")

    udp = UDP(sport=src_pkt[UDP].dport, dport=src_pkt[UDP].sport)
    new_pkt = ether / ip / udp / data
    sendp(new_pkt, verbose=False)


def recv_tlv(src_pkt, expect_tag: int) -> Optional[bytes]:
    """Helper method to parse TLV data out of a packet, TCP or UDP."""
    if not hasattr(src_pkt, "load"):
        logging.debug("recv_tlv(): Source packet has no payload")
        return None

    payload = src_pkt.load
    if len(payload) <= TLV_HEADER_LEN:
        logging.debug(f"recv_tlv(): payload length {len(payload)} too small (<= {TLV_HEADER_LEN})")
        return None

    logging.debug(f"Header: {payload[:TLV_HEADER_LEN]}")
    tag, length = struct.unpack(TLV_HEADER, payload[:TLV_HEADER_LEN])
    if tag != expect_tag:
        logging.debug(f"recv_tlv(): tag {tag} != expected tag {expect_tag}")
        return None

    data = payload[TLV_HEADER_LEN:]
    if len(data) < length:
        logging.debug(f"recv_tlv(): not enough data. data {len(data)} < length {length}")
        return None
    return data[:length]
