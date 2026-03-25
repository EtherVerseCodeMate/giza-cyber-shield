"""tnokd main service module.

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
import argparse
import datetime
import warnings
import traceback

# flake8: noqa
# mypy: disable-error-code="import-untyped"

import cincoconfig
from tabulate import tabulate

from tnoklib import MAX_UID, is_user_admin, perror
from tnokd import ip_version
from tnokd.config import PortConfig, get_inet_iface_name, get_scapy_ifaces
from tnokd.service import KnockService
from tnokd.errors import DatabaseError, UnsupportedPlatform, UserNotFound, UserExistsException, IPBlockNotFound

warnings.filterwarnings(action='ignore', module='.*scapy.*')
warnings.filterwarnings(action='ignore', module='.*cryptography.*')

if sys.platform == "win32":
    DEFAULT_LOG_FILE = "C:\\Program Files\\tnokd\\tnokd.log"
    DEFAULT_CONFIG_FILE = "C:\\Program Files\\tnokd\\tnokd.conf"
    DEFAULT_DB_FILE = "C:\\Program Files\\tnokd\\db.sqlite"
else:
    DEFAULT_LOG_FILE = "/var/log/tnokd.log"
    DEFAULT_CONFIG_FILE = "/etc/tnokd/tnokd.conf"
    DEFAULT_DB_FILE = "/etc/tnokd/db.sqlite"


def start(_args: argparse.Namespace, service: KnockService) -> int:
    """Start sub-command."""
    # Blocks until cntrl-c or kill
    if not service.run():
        perror("Failed to start service")
        return 1
    return 0


def code(args: argparse.Namespace, service: KnockService) -> int:
    """Code sub-command."""
    service.print_qr_code(
        svg=args.svg,
        png=args.png,
        no_console=args.no_console,
        uid=args.uid,
        hostname=args.hostname)
    return 0


def validate(args: argparse.Namespace, service: KnockService) -> int:
    """Validate sub-command."""
    if service.validate(args.code, args.uid):
        print("Code is valid!")
        return 0
    perror("Code is invalid!")
    return 1


def add_user(args: argparse.Namespace, service: KnockService) -> int:
    """Add sub-command."""
    if len(args.uid) > MAX_UID:
        perror(f"UID must be <= {MAX_UID} characters long.")
        return 1

    if not service.db:
        raise DatabaseError("Database not connected!")

    try:
        service.db.add_user(args.uid, args.fullname)
    except UserExistsException:
        perror(f"User {args.uid} already exists in the database.")
        return 1
    return 0


def remove_user(args: argparse.Namespace, service: KnockService) -> int:
    """Remove sub-command."""
    if not service.db:
        raise DatabaseError("Database not connected!")

    try:
        service.db.remove_user(args.uid)
    except UserNotFound:
        perror(f"User {args.uid} does not exist in the database.")
        return 1
    return 0


def add_port(args: argparse.Namespace, service: KnockService) -> int:
    """Add a port to the config."""
    port_cfg = PortConfig(number=args.number, protocol=args.protocol)
    for item in service.config.protected_ports:
        if item.number == port_cfg.number:
            print(
                f"Port {args.number} for protocol \"{item.protocol}\" already exists in the config. Remove and re-add to change the protocol.",
                file=sys.stderr)
            return 1

    service.config.protected_ports.append(port_cfg)
    service.config.save(service.conf_file, format="json")
    print("Restart the service for the changes to take effect.")
    return 0


def remove_port(args: argparse.Namespace, service: KnockService) -> int:
    """Remove a port from the config."""
    rm = None
    for item in service.config.protected_ports:
        if item.number == args.number:
            rm = item
            break

    if rm is None:
        perror(f"Port {args.number} not found in config.")
        return 1

    service.config.protected_ports.remove(rm)
    service.config.save(service.conf_file, format="json")
    print("Restart the service for the changes to take effect.")
    return 0


def list_ports(_args: argparse.Namespace, service: KnockService) -> int:
    """List protected ports in the config."""
    if not service.config.protected_ports:
        print("No protected ports are configured.")
        return 0

    print("Protected ports:")
    for port in service.config.protected_ports:
        print(f"\t{port.number},{port.protocol}")
    return 0


def install_service(_args: argparse.Namespace, service: KnockService) -> int:
    """Install the service to start at boot."""
    print("Installing the service...")
    rc = service.install()
    if rc == 0:
        print("Service installed successfully.")
    else:
        perror("Service failed to install.")
    return rc


def uninstall_service(_args: argparse.Namespace, service: KnockService) -> int:
    """Uninstall the service to remove start at boot."""
    print("Uninstalling the service...")
    rc = service.uninstall()
    if rc == 0:
        print("Service uninstalled successfully.")
    else:
        perror("Service failed to uninstall.")
    return rc


def unblock_ip(args: argparse.Namespace, service: KnockService) -> int:
    """Unblock a blocked IP or unblock all IPs."""
    if not service.db:
        raise DatabaseError("Database not connected!")

    if args.all:
        print("Deleting all blocked IPs")
        service.db.remove_all_ip_blocks()
    elif args.ip:
        try:
            service.db.remove_ip_block(args.ip)
        except IPBlockNotFound:
            perror(f"IP {args.ip} not blocked in the database.")
            return 1
    else:
        perror("One of \"--all\" or \"--ip\" is required for unblock-ip")
        return 1

    print("Database updated. Restart the service for the changes to take effect.")
    return 0


def block_ip(args: argparse.Namespace, service: KnockService) -> int:
    """Block an IP address or IP list."""
    if not service.db:
        raise DatabaseError("Database not connected!")

    if args.ip:
        try:
            ip_version(args.ip)
        except ValueError as exc:
            perror(f"Invalid IP address {args.ip}. {exc}")
            return 1
        service.db.add_ip_block(args.ip, 0)
        return 0

    if not args.list:
        perror("One of \"--ip\" or \"--list\" is required for block-ip")
        return 1

    if not os.path.exists(args.list) or not os.path.isfile(args.list):
        perror("The argument to \"--list\" must be a file that exists.")
        return 1

    ips = []
    try:
        with open(args.list, "r", encoding="utf-8") as fh:
            ips = [x.strip() for x in fh.read().splitlines() if x.strip() and not x.strip().startswith("#")]
    except OSError as exc:
        perror(f"Failed to open {args.list}. {exc}")
        return 1

    for ip in ips:
        try:
            ip_version(ip)
        except ValueError:
            perror(f"WARNING: Invalid IP address {ip}. Skipping...")
            continue
        print(f"Blocking {ip}")
        service.db.add_ip_block(ip, 0)

    return 0


def list_blocked_ips(args: argparse.Namespace, service: KnockService) -> int:
    """List all blocked IPs."""
    if not service.db:
        raise DatabaseError("Database not connected!")

    blocked_ips = service.db.get_blocked_ips()
    for block in blocked_ips:
        output = block.ip_addr
        if args.long:
            if block.unblock_after == 0:
                output += " unblock_after: never"
            else:
                ub_after = datetime.datetime.fromtimestamp(block.unblock_after, datetime.timezone.utc)
                output += f" unblock_after: {ub_after.strftime('%d/%m/%Y, %H:%M:%S')}"
        print(output)
    return 0


def add_always_allow_ip(args: argparse.Namespace, service: KnockService) -> int:
    """Add an IP or IPs to the always allow list."""
    ips = []
    if args.list:
        try:
            with open(args.list, "r", encoding="utf-8") as fh:
                ips = fh.read().splitlines()
        except Exception as exc:
            perror(f"Unable to read IPs from file {args.list}. {exc}")
            return 1
    else:
        ips.append(args.ip)

    if not ips:
        perror("One of \"--ip\" or \"--list\" is required for add-always-allow-ip")
        return 1

    # Validate the IPs
    for ip in ips:
        try:
            ip_version(ip, allow_networks=True)
        except ValueError as exc:
            perror(f"Invalid IP address {ip}. {exc}")
            return 1

    # Ignore duplicates in input and already in the config
    ips_to_add = set()
    for ip_arg in ips:
        found = False
        for config_ip in service.config.always_allow_from:
            if ip_arg == config_ip:
                perror(f"IP {ip_arg} already exists in the config. Skipping.")
                found = True
                break
        if not found:
            ips_to_add.add(ip_arg)

    for ip_arg in ips_to_add:
        print(f"Adding {ip_arg} to always allow list. All traffic will be allowed from this IP/network.")
        service.config.always_allow_from.append(ip_arg)
    service.config.save(service.conf_file, format="json")
    print("Restart the service for the changes to take effect.")
    return 0


def remove_always_allow_ip(args: argparse.Namespace, service: KnockService) -> int:
    """Remove IP(s) from the always allow list."""
    if args.all:
        print("Removing all IPs from always allow list.")
        service.config.always_allow_from = []
        service.config.save(service.conf_file, format="json")
        print("Restart the service for the changes to take effect.")
        return 0

    rm = None
    for config_ip in service.config.always_allow_from:
        if args.ip == config_ip:
            print(f"Removing {config_ip} from always allow list.")
            rm = config_ip
            break

    if rm:
        service.config.always_allow_from.remove(rm)
        service.config.save(service.conf_file, format="json")
        print("Restart the service for the changes to take effect.")
        return 0

    print(f"IP {args.ip} not found in always allow list.")
    return 1


def list_always_allow_ips(_args: argparse.Namespace, service: KnockService) -> int:
    """Print the always allow list."""
    if not service.config.always_allow_from:
        print("No IPs in always allow list.")
        return 0

    print("Always allow traffic from:")
    for config_ip in service.config.always_allow_from:
        print(f"\t{config_ip}")
    return 0


def status(_args: argparse.Namespace, service: KnockService) -> int:
    """Query for service status."""
    if service.check_service_running():
        print("tnokd: Running")
    else:
        print("tnokd: Stopped")
    return 0


def list_interfaces(args: argparse.Namespace, _service: KnockService) -> int:
    """List available interfaces."""
    ifaces = get_scapy_ifaces(args.all)
    default_iface_str = get_inet_iface_name()
    logging.debug(f"Default inet iface name: {default_iface_str}")

    header = ["Index", "Name", "IPs", "MAC", "Description"]
    data = []

    print("Default interface marked with *")
    for idx, iface in enumerate(ifaces):
        is_default = False
        if default_iface_str == iface.network_name:
            is_default = True

        ips = iface.ips.get(4, []) + iface.ips.get(6, [])
        ips_str = ', '.join(ips)

        # Some debug logging
        logging.debug(f"iface {idx}:\n"
                      f"\tName: {iface.name}\n"
                      f"\tNameservers: {iface.nameservers}\n"
                      f"\tNetwork Name: {iface.network_name}\n"
                      f"\tIndex: {iface.index}\n"
                      f"\tIPs: {ips_str}\n"
                      f"\tMAC: {iface.mac}\n"
                      f"\tDescription: {iface.description}\n"
                      f"\tIPv4 Metric: {iface.ipv4_metric}\n"
                      f"\tIPv6 Metric: {iface.ipv6_metric}\n"
                      f"\tGUID: {iface.guid}\n"
                      f"\tDefault inet interface? {is_default}\n")

        iface_index = str(iface.index)
        if is_default:
            iface_index = "* " + iface_index
        else:
            iface_index = "- " + iface_index
        row = [
            iface_index,
            iface.name,
            ips_str,
            iface.mac,
            iface.description
        ]
        data.append(row)

    print(tabulate(data, headers=header))
    return 0


def get_interface(_args: argparse.Namespace, service: KnockService) -> int:
    """Print the current interface(s) listening on."""
    print(service.config.listen_interfaces)
    return 0


def set_interface(args: argparse.Namespace, service: KnockService) -> int:
    """Set the interface(s) to listen on."""
    # Create a lookup by network_name
    ifaces = get_scapy_ifaces(get_all=True)
    default_iface_str = get_inet_iface_name()
    iface_lookup = {}
    for iface in ifaces:
        iface_lookup[("network_name", iface.network_name)] = iface
        iface_lookup[("name", iface.name)] = iface
        iface_lookup[("index", str(iface.index))] = iface
        iface_lookup[("description", iface.description.lower())] = iface
        iface_lookup[("mac", iface.mac.lower())] = iface
        ips = iface.ips.get(4, []) + iface.ips.get(6, [])
        for ip in ips:
            iface_lookup[("ip", ip)] = iface

    if args.default:
        name = iface_lookup[("network_name", default_iface_str)].name
        service.config.listen_interfaces = [default_iface_str]
        service.config.save(service.conf_file, format="json")
        print(f"Listening on interface: \"{name}\"")
    elif args.all:
        service.config.listen_interfaces = []
        service.config.save(service.conf_file, format="json")
        print("Listening on all interfaces")
    elif args.iface:
        new_ifaces = []
        for check in args.iface:
            iface = None
            if ("network_name", check) in iface_lookup:
                logging.debug(f"Matched iface {check} with iface network_name")
                iface = iface_lookup[("network_name", check)]
            elif ("name", check) in iface_lookup:
                logging.debug(f"Matched iface {check} with iface name")
                iface = iface_lookup[("name", check)]
            elif ("index", check) in iface_lookup:
                logging.debug(f"Matched iface {check} with iface index")
                iface = iface_lookup[("index", check)]
            elif ("description", check.lower()) in iface_lookup:
                logging.debug(f"Matched iface {check} with iface description")
                iface = iface_lookup[("description", check.lower())]
            elif ("mac", check.lower()) in iface_lookup:
                logging.debug(f"Matched iface {check} with iface mac")
                iface = iface_lookup[("mac", check.lower())]
            elif ("ip", check) in iface_lookup:
                logging.debug(f"Matched iface {check} with iface ip")
                iface = iface_lookup[("ip", check)]

            if iface:
                print(f"Listening on {iface.name}")
                new_ifaces.append(iface.network_name)

        if not new_ifaces:
            print("No interfaces found/added")
            return 1
        service.config.listen_interfaces = new_ifaces
        service.config.save(service.conf_file, format="json")
    else:
        perror("One of --iface, --all, or --default is required.")
        return 1

    print("Restart the service for the changes to take effect.")
    return 0


# pylint: disable=too-many-statements, too-many-locals
def main() -> int:
    """Entry point."""
    parser = argparse.ArgumentParser("tnokd", description="TOTP port knocking service", add_help=False)

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

    parser = argparse.ArgumentParser("tnokd", description="TOTP port knocking service")
    parser.add_argument("--version", help="Print version information", action="store_true")
    parser.add_argument("--debug", action="store_true", help="Run with debug logging")
    parser.add_argument("--trace", help="Very verbose output", action="store_true")
    parser.add_argument("--config", help=f"Override the default {DEFAULT_CONFIG_FILE} with the provided config file")
    parser.add_argument("--db", help=f"Override the default {DEFAULT_DB_FILE} with the provided DB path")
    parser.add_argument("--log", help=f"Override the default {DEFAULT_LOG_FILE} with the provided log file path")

    subparsers = parser.add_subparsers(help="sub-command help", required=True)

    # Start the service
    start_parser = subparsers.add_parser("start", help="Start the service in the foreground. Use install to run as a service in the background.")
    start_parser.set_defaults(func=start)

    # Get the QR code
    code_parser = subparsers.add_parser("code", help="Retrieve the QR code for a TOTP application.")
    code_parser.add_argument("--svg", action="store_true", help="Output a .svg image of the QR code.")
    code_parser.add_argument("--png", action="store_true", help="Output a .png image of the QR code.")
    code_parser.add_argument("--no-console", action="store_true", help="Don't print the QR code to the console.")
    code_parser.add_argument("--uid", default="admin", help="The UID to validate against")
    code_parser.add_argument("--hostname", help="Override the hostname used in the TOTP URL.")
    code_parser.set_defaults(func=code)

    # Validate setup
    validate_parser = subparsers.add_parser("validate", help="Pass in a 6 digit value from your authenticator app to validate the code")
    validate_parser.add_argument("--code", help="The 6 digit code to validate", required=True)
    validate_parser.add_argument("--uid", default="admin", help="The UID to validate against")
    validate_parser.set_defaults(func=validate)

    # Add another user
    add_user_parser = subparsers.add_parser("add-user", help="Add a user")
    add_user_parser.add_argument("--uid", help=f"The UID. Must be unique and can be up to {MAX_UID} characters long", required=True)
    add_user_parser.add_argument("--fullname", help="Optional full name to store with the UID")
    add_user_parser.set_defaults(func=add_user)

    # Remove a user
    remove_parser = subparsers.add_parser("remove-user", help="Remove a user")
    remove_parser.add_argument("--uid", help="The UID to remove. Removing the default admin user will regenerate "
                               "the admin's token but the admin user cannot be removed.", required=True)
    remove_parser.set_defaults(func=remove_user)

    # Add a port
    add_port_parser = subparsers.add_parser("add-port", help="Add a port to protect")
    add_port_parser.add_argument("--number", help="The port number to protect", type=int, required=True)
    add_port_parser.add_argument("--protocol", help="The protocol: tcp, udp, or both", choices=["tcp", "udp", "both"], required=True)
    add_port_parser.set_defaults(func=add_port)

    # Remove a port
    remove_port_parser = subparsers.add_parser("remove-port", help="Remove a protected port")
    remove_port_parser.add_argument("--number", help="The port number to remove", type=int, required=True)
    remove_port_parser.set_defaults(func=remove_port)

    # List ports
    list_port_parser = subparsers.add_parser("list-ports", help="List the protected ports")
    list_port_parser.set_defaults(func=list_ports)

    # Install the service
    install_parser = subparsers.add_parser("install", help="Install the service to auto-start at boot")
    install_parser.set_defaults(func=install_service)

    # Uninstall the service
    uninstall_parser = subparsers.add_parser("uninstall", help="Uninstall the service and remove auto-start at boot")
    uninstall_parser.set_defaults(func=uninstall_service)

    # Unblock an IP
    unblock_ip_parser = subparsers.add_parser("unblock-ip", help="Unblock an IP address (or all IP addresses).")
    unblock_ip_arg_group = unblock_ip_parser.add_mutually_exclusive_group(required=True)
    unblock_ip_arg_group.add_argument("--all", action="store_true", help="Unblock all blocked IPs")
    unblock_ip_arg_group.add_argument("--ip", help="Unblock this IP")
    unblock_ip_parser.set_defaults(func=unblock_ip)

    # Block an IP
    block_ip_parser = subparsers.add_parser("block-ip", help="Block an IP (or load an IP block list).")
    block_ip_parser_arg_group = block_ip_parser.add_mutually_exclusive_group(required=True)
    block_ip_parser_arg_group.add_argument("--ip", help="The IP to block.")
    block_ip_parser_arg_group.add_argument("--list", help="Path to a file containing a newline delimited list of IPs to block.")
    block_ip_parser.set_defaults(func=block_ip)

    # List blocked IPs
    list_blocked_ips_parser = subparsers.add_parser("list-blocked-ips", help="List all blocked IPs")
    list_blocked_ips_parser.add_argument("-l", "--long", action="store_true", help="List blocked IPs with their expiration times.")
    list_blocked_ips_parser.set_defaults(func=list_blocked_ips)

    # Add always allow IP
    add_always_allow_ip_parser = subparsers.add_parser("add-always-allow-ip", help="Add an IP to the always allow list.")
    add_always_allow_ip_parser_arg_group = add_always_allow_ip_parser.add_mutually_exclusive_group(required=True)
    add_always_allow_ip_parser_arg_group.add_argument("--ip", help="The IP to add (can be CIDR notation for a network).")
    add_always_allow_ip_parser_arg_group.add_argument("--list", help="Path to a file containing a newline delimited list of IPs to add.")
    add_always_allow_ip_parser.set_defaults(func=add_always_allow_ip)

    # Remove always allow IP
    remove_always_allow_ip_parser = subparsers.add_parser("remove-always-allow-ip", help="Remove an IP from the always allow list.")
    remove_always_allow_ip_parser_arg_group = remove_always_allow_ip_parser.add_mutually_exclusive_group(required=True)
    remove_always_allow_ip_parser_arg_group.add_argument("--all", action="store_true", help="Remove all IPs from the always allow list.")
    remove_always_allow_ip_parser_arg_group.add_argument("--ip", help="The IP to remove.")
    remove_always_allow_ip_parser.set_defaults(func=remove_always_allow_ip)

    # List always allow IPs
    list_always_allow_ip_parser = subparsers.add_parser("list-always-allow-ips", help="List the IPs in the always allow list.")
    list_always_allow_ip_parser.set_defaults(func=list_always_allow_ips)

    # Get service status (is it running)
    status_parser = subparsers.add_parser("status", help="Query status of the service (running/stopped)")
    status_parser.set_defaults(func=status)

    # List available interfaces
    list_interfaces_parser = subparsers.add_parser("list-interfaces", help="List available interfaces")
    list_interfaces_parser.add_argument("--all", action="store_true", help="Include interfaces without IPs and the lo interface")
    list_interfaces_parser.set_defaults(func=list_interfaces)

    # Set the listen interface(s)
    set_interface_parser = subparsers.add_parser("set-interface", help="Set the listen interface(s) (supports multiple interfaces)")
    set_interface_parser_arg_group = set_interface_parser.add_mutually_exclusive_group(required=True)
    set_interface_parser_arg_group.add_argument(
        "-i", "--iface", help="The interface to listen on (name or index). Can be called multiple times.", action="append")
    set_interface_parser_arg_group.add_argument("--all", action="store_true", help="Listen on all interfaces")
    set_interface_parser_arg_group.add_argument("--default", action="store_true", help="Listen on the default interface")
    set_interface_parser.set_defaults(func=set_interface)

    # Get the listen interface(s)
    get_interface_parser = subparsers.add_parser("get-interface", help="Print the interface or interfaces currently set in the config.")
    get_interface_parser.set_defaults(func=get_interface)

    try:
        args = parser.parse_args()
    except TypeError:
        # parse_args() fails for legacy install when no arguments are provided
        parser.print_help()
        return 1

    if not is_user_admin():
        perror("tnokd must be run as admin/root")
        return 1

    # We need libpcap/npcap
    if sys.platform == "win32":
        try:
            # pylint: disable=unused-import
            from scapy.arch.libpcap import L2pcapListenSocket, L2pcapSocket, L3pcapSocket
        except (OSError, ImportError):
            perror("npcap must be installed for tnokd to run on Windows")
            return 1

    try:
        service = KnockService(args)
    except PermissionError:
        perror("tnokd must be run as admin/root")
        return 1
    except cincoconfig.ValidationError as exc:
        perror(f"tnokd config file failed to validate. {exc}")
        return 1
    except DatabaseError as exc:
        perror(f"tnokd database error. {exc}")
        return 1
    except UnsupportedPlatform:
        perror("tnokd does not support this OS.")
        return 1

    return args.func(args, service)


def main_cli():
    """CLI entry point."""
    rc = 0
    try:
        rc = main()
    except Exception as unhandled_exc:
        rc = 1
        logging.error(f"tnokd has encountered a fatal error. {unhandled_exc}")
        logging.error("Check tnokd-bugreport.txt for details")
        with open("tnokd-bugreport.txt", "w", encoding="utf-8") as fh:
            traceback.print_exc(file=fh)

    return rc


if __name__ == "__main__":
    sys.exit(main_cli())
