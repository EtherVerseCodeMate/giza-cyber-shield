"""tnok main client module.

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
import sys
import socket
import logging
import argparse
import warnings
import traceback
from typing import List, Optional

from tnoklib.nok import Nok

warnings.filterwarnings(action='ignore', module='.*scapy.*')
warnings.filterwarnings(action='ignore', module='.*cryptography.*')


def setup_logging(path: Optional[str] = None, level=logging.INFO) -> None:
    """Setup logging."""
    handlers: List[logging.Handler] = []
    stream_handler = logging.StreamHandler(stream=sys.stdout)
    stream_formatter = logging.Formatter(fmt="[%(levelname)s][tnok] %(message)s")
    stream_handler.setFormatter(stream_formatter)
    handlers.append(stream_handler)

    if path:
        file_handler = logging.FileHandler(filename=path)
        file_formatter = logging.Formatter(fmt="[%(asctime)s][%(levelname)s][tnok] %(message)s")
        file_handler.setFormatter(file_formatter)
        handlers.append(file_handler)

    logging.basicConfig(handlers=handlers, level=level)


def main():
    """Entry Point."""
    parser = argparse.ArgumentParser(description="TOTP Port Knocking Client", add_help=False)

    # Handle version first
    parser.add_argument("--version", help="Print version information", action="store_true")
    try:
        args, _ = parser.parse_known_args()
        if args.version:
            try:
                import importlib.metadata
                print(f"v{importlib.metadata.version('tnok')}")
            except ImportError:
                print("Unable to print version on legacy install.")
            return 0
    except TypeError:
        # parse_known_args() fails for legacy install when no arguments are provided
        pass

    default_knock_technique = "NokTCPMSS"
    if sys.platform == "win32":
        default_knock_technique = "NokTCPMD5"

    parser = argparse.ArgumentParser(description="TOTP Port Knocking Client")
    parser.add_argument("--version", help="Print version information", action="store_true")
    parser.add_argument("-c", "--code", help="Current TOTP code", required=True)
    parser.add_argument("-u", "--uid", help="User ID the code belongs to", default="admin")
    parser.add_argument("-t", "--target", help="Target IP to knock at", required=True)
    parser.add_argument("-p", "--desired-port", help="Port to open", type=int, required=True)
    parser.add_argument("-i", "--additional-ips", help="Open for these IPs too", type=str, action="append")
    parser.add_argument("-d", "--debug", action="store_true", help="Enable debug output.")
    parser.add_argument("-l", "--log", help="Path to a log file (optional).")
    parser.add_argument(
        "-k", "--knock-technique",
        help="Technique to use for the Knock", type=str,
        choices=Nok.TECHNIQUES.keys(), default=default_knock_technique)

    try:
        args = parser.parse_args()
    except TypeError:
        # parse_args() fails for legacy install when no arguments are provided
        parser.print_help()
        return 1

    # Setup logging
    level = logging.INFO
    log_file = None
    if args.debug:
        level = logging.DEBUG
    if args.log:
        log_file = args.log
    setup_logging(log_file, level)

    # We need libpcap/npcap
    if sys.platform == "win32":
        try:
            # pylint: disable=unused-import
            # flake8: noqa
            from scapy.arch.libpcap import L2pcapListenSocket, L2pcapSocket, L3pcapSocket
        except (OSError, ImportError):
            logging.error("npcap must be installed for tnok to run on Windows")
            return 1

    try:
        target = socket.gethostbyname(args.target)
    except socket.gaierror as exc:
        logging.error(f"Unable to resolve hostname {args.target}. {exc}")
        return 1
    except TypeError:
        logging.error(f"Invalid target {args.target}")
        return 1  # happens if args.target is None or something

    desired_port = int(args.desired_port)

    if args.knock_technique not in Nok.TECHNIQUES:
        logging.error(f"Invalid knock technique {args.knock_technique}")
        return 1

    if len(str(args.code)) != 6:
        logging.error("Code must be 6 digits")
        return 1

    try:
        knocker: Nok = Nok.TECHNIQUES[args.knock_technique](
            args.code,
            args.uid,
            target,
            desired_port,
            args.additional_ips
        )
        knocker.nok()
    except PermissionError:
        logging.error(f"Knock technique {args.knock_technique} requires admin. Use a different technique or elevate.")
        return 1
    except ConnectionResetError:
        logging.error("Connection reset by peer. The port may already be open for this IP.")
        return 1
    except Exception as exc:
        logging.error(f"Failed to open port: {exc}")
        return 1

    return 0


def main_cli():
    """CLI entry point."""
    rc = 0
    try:
        rc = main()
    except Exception as unhandled_exc:
        rc = 1
        logging.exception(f"tnok has encountered a fatal error. {unhandled_exc}")
        logging.error("Check tnok-bugreport.txt for details")
        with open("tnok-bugreport.txt", "w", encoding="utf-8") as fh:
            traceback.print_exc(file=fh)

    return rc


if __name__ == "__main__":
    sys.exit(main_cli())
