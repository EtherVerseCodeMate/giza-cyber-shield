"""Base tnokd service.

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
import shutil
import socket
import signal
import logging
import argparse
import datetime
import threading
import subprocess
from typing import Dict, Optional, Union, List

import pyotp

# mypy: disable-error-code="import-untyped"
import pyqrcode

from tnokd.config import load_config
from tnokd.sniffer import KnockSniffer
from tnokd.errors import UnsupportedPlatform, DatabaseError
from tnokd.firewall import FirewallManager
from tnokd.db import TnokdDatabase, ClientSecret

SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))

LINUX_SERVICE_FILE = f"""[Unit]
Description=TOTP Port Knocking Service
After=multi-user.target

[Service]
Type=simple
Restart=always
ExecStart={os.path.abspath(sys.argv[0])} start

[Install]
WantedBy=multi-user.target"""

if sys.platform not in ("win32", "linux"):
    raise UnsupportedPlatform(f"platform {sys.platform} is not supported")


class KnockService:
    """Base knock service class. Handles compatibility with supported OS."""

    WIN32_BASE_INSTALL_DIR = "C:\\Program Files\\tnokd"
    WIN32_PID_FILE = "C:\\Program Files\\tnokd\\tnokd.pid"
    LINUX_PID_FILE = "/run/tnokd.pid"

    WIN32_LOG_FILE = "C:\\Program Files\\tnokd\\tnokd.log"
    LINUX_LOG_FILE = "/var/log/tnokd.log"

    WIN32_CONF_FILE = "C:\\Program Files\\tnokd\\tnokd.conf"
    LINUX_CONF_FILE = "/etc/tnokd/tnokd.conf"

    WIN32_DB_FILE = "C:\\Program Files\\tnokd\\db.sqlite"
    LINUX_DB_FILE = "/etc/tnokd/db.sqlite"

    def __init__(self, args: Optional[argparse.Namespace] = None):
        """Knock service."""
        #: Given a port, gives back the user-configured protocol for that port
        #: tpc, udp, or both.
        self.port_protocol_lookup: Dict[int, str] = {}
        #: Mapping of blocked IP address to the unblock_after timestamp
        #: or 0 if blocked forever
        self.blocked_ips: Dict[str, float] = {}
        #: Tracker we use to block IPs. Maps an IP address to number of attempts
        #: and the timestamp of the last attempt.
        self.ip_blocker: Dict[str, Dict] = {}
        #: Set if the config file is overridden from the default
        self._conf_file = None
        #: Set if the database file is overridden from the default
        self._db_file = None
        #: Set if the log file is overridden from the default
        self._log_file = None
        #: Sqlite3 database connection
        self.db: Optional[TnokdDatabase] = None
        #: Lock for shared access to the database
        self.db_lock = threading.Lock()
        #: True while the service is running. Set to False to trigger exit.
        self.running = False
        #: Whether we're running in pyinstaller bundle or not
        self.in_pyinstaller_bundle = False

        # Override config and DB path if they're set on the command-line
        if args and args.config:
            self.conf_file = args.config
        if args and args.db:
            self.db_file = args.db
        if args and args.log:
            self.log_file = args.log

        self._create_default_dirs()
        self._setup_logging(args)

        # Check if running in pyinstaller or normal Python process
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            logging.debug("Running in pyinstaller bundle!")
            self.in_pyinstaller_bundle = True

        trace = False if args is None else args.trace
        #: The loaded config for tnokd
        self.config = load_config(self.conf_file)
        #: The packet sniffer
        self.sniffer = KnockSniffer(self.config.listen_interfaces, self._knock_callback, trace=trace)

        if sys.platform == "linux":
            firewall_backend = self.config.linux_firewall_backend
        elif sys.platform == "win32":
            firewall_backend = self.config.win32_firewall_backend
        else:
            raise UnsupportedPlatform()

        #: The firewall manager
        self.firewall = FirewallManager(firewall_backend)
        self._connect_db(args)

    def _create_default_dirs(self):
        """Create default paths."""
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        os.makedirs(os.path.dirname(self.conf_file), exist_ok=True)
        os.makedirs(os.path.dirname(self.db_file), exist_ok=True)
        os.makedirs(os.path.dirname(self.pid_file), exist_ok=True)

    def _setup_logging(self, args: Optional[argparse.Namespace] = None):
        """Do the setup of logging."""
        level = "INFO" if args is None or (not args.debug and not args.trace) else "DEBUG"

        file_handler = logging.FileHandler(self.log_file)
        file_formatter = logging.Formatter(fmt='[%(asctime)s][%(levelname)s][tnokd] %(message)s')
        file_handler.setFormatter(file_formatter)

        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_formatter = logging.Formatter(fmt='[%(levelname)s][tnokd] %(message)s')
        stdout_handler.setFormatter(stdout_formatter)

        logging.basicConfig(handlers=[file_handler, stdout_handler], level=level)

    @property
    def log_file(self) -> str:
        """Get the path to the log file."""
        if self._log_file:
            return self._log_file
        if sys.platform == "win32":
            return self.WIN32_LOG_FILE
        if sys.platform == "linux":
            return self.LINUX_LOG_FILE
        raise UnsupportedPlatform()

    @log_file.setter
    def log_file(self, value: str) -> None:
        """Override the log file."""
        self._log_file = value

    @property
    def conf_file(self) -> str:
        """Get the path to the config file."""
        if self._conf_file:
            return self._conf_file
        if sys.platform == "win32":
            return self.WIN32_CONF_FILE
        if sys.platform == "linux":
            return self.LINUX_CONF_FILE
        raise UnsupportedPlatform()

    @conf_file.setter
    def conf_file(self, value: str) -> None:
        """Override the conf file."""
        self._conf_file = value

    @property
    def db_file(self) -> str:
        """Get the path to the config file."""
        if self._db_file:
            return self._db_file
        if sys.platform == "win32":
            return self.WIN32_DB_FILE
        if sys.platform == "linux":
            return self.LINUX_DB_FILE
        raise UnsupportedPlatform()

    @db_file.setter
    def db_file(self, value: str) -> None:
        """Override the db file."""
        self._db_file = value

    @property
    def pid_file(self) -> str:
        """Get the path to the PID file."""
        if sys.platform == "win32":
            return self.WIN32_PID_FILE
        if sys.platform == "linux":
            return self.LINUX_PID_FILE
        raise UnsupportedPlatform()

    def install(self) -> int:
        """Install the service."""
        if sys.platform == "win32":
            return self._install_win32()
        if sys.platform == "linux":
            return self._install_linux()
        raise UnsupportedPlatform()

    def uninstall(self) -> int:
        """Install the service."""
        if sys.platform == "win32":
            return self._uninstall_win32()
        if sys.platform == "linux":
            return self._uninstall_linux()
        raise UnsupportedPlatform()

    def _create_pid_file(self) -> bool:
        """Create the PID file for the process."""
        pid = os.getpid()
        try:
            with open(self.pid_file, "w", encoding='utf-8') as fh:
                fh.write(str(pid))
        except OSError as exc:
            logging.error(f"Unable to create PID file {self.pid_file}. {exc}")
            return False
        return True

    def _remove_pid_file(self) -> None:
        """Remove the PID file for the process."""
        try:
            os.remove(self.pid_file)
        except Exception as exc:
            logging.error(f"Failed to remove PID file {self.pid_file}. {exc}")

    def check_service_running(self) -> bool:
        """Check if the service is running by looking for the PID file."""
        return os.path.exists(self.pid_file)

    def _signal_handler(self, _signum, _frame):
        """Handle process signals."""
        self.stop()

    def stop(self):
        """Stop the service."""
        self.running = False

    def run(self) -> bool:
        """Start the service."""
        if self.check_service_running():
            logging.error(f"PID file {self.pid_file} exists. Service is already running.")
            return False

        if self.firewall.find_rule_conflicts(self.config.protected_ports):
            return False

        if not self._protect_ports():
            self._unprotect_ports()
            return False

        if not self._create_pid_file():
            return False

        self.running = True
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        self._db_load_ip_blocks()
        self.sniffer.start()

        ret = True
        while self.running:
            self._expire_ip_blocks()
            time.sleep(0.1)  # nosemgrep
            if self.sniffer.error is not None:
                ret = False
                break
            if not self.sniffer.running:
                break

        logging.info("Exiting...")

        if not self.config.persist_protected_ports:
            self._unprotect_ports()
        else:
            logging.warning("Config is set to persist port protection rules. "
                            "Protected ports will be inaccessible while the service is stopped.")

        if self.config.ip_blocking.enabled and not self.config.ip_blocking.persist:
            logging.info("Service exiting. Unblocking blocked IPs per config.")
            self._firewall_unblock_ips()  # only unblock them in the firewall
        else:
            logging.warning("Config is set to persist IP blocks. Blocked IPs will "
                            "remain in the firewall while the service is not running.")

        self.firewall.cleanup()
        self._remove_pid_file()

        try:
            logging.info("tnokd stopping...")
            self.sniffer.stop()
        except TimeoutError:
            logging.error("Timed out waiting for thread to stop. Forcing.")
            pid = os.getpid()
            os.kill(pid, signal.SIGKILL)

        return ret

    def validate(self, code: str, uid: str = "admin") -> bool:
        """Validate a provided code."""
        if not self.db:
            raise DatabaseError("Database not connected")

        user = self.db.get_user(uid)
        if not user:
            logging.error(f"No user with UID {uid}")
            return False

        totp = pyotp.TOTP(user.b32_secret)
        return totp.verify(code)

    def _connect_db(self, args: Optional[argparse.Namespace] = None):
        """Connect or create the database."""
        first_run = False
        debug = args.debug if args else False

        if not os.path.exists(self.db_file):
            logging.info("First time run, generating secret key.")
            first_run = True

        self.db = TnokdDatabase(self.db_file, debug=debug)

        if first_run:
            # Add the admin user
            logging.info("Creating default admin user")
            self.db.add_user()

    def _db_block_ip(self, ip: str):
        """Block IP in the database."""
        if not self.db:
            raise DatabaseError("Database not connected")

        with self.db_lock:
            if ip in self.blocked_ips:
                logging.debug(f"IP {ip} is already blocked. Not blocking again.")
                return  # Already blocked

            logging.info(f"Blocking IP {ip}")

            # Figure out when we're going to unblock the IP (if we are)
            unblock_after = 0.0
            if self.config.ip_blocking.expire_after > 0:
                unblock_after = (
                    datetime.datetime.now(datetime.UTC) +
                    datetime.timedelta(seconds=self.config.ip_blocking.expire_after)
                ).timestamp()

            self.db.add_ip_block(ip, int(unblock_after))

            # Keep a local mapping of blocked IPs so we don't need to query the DB every time
            self.blocked_ips[ip] = unblock_after

            # Block the IP in the host's firewall and sniffer so we don't keep sniffing packets
            # from the blocked IP
            self.firewall.block_ip(ip)
            self.sniffer.block_ip(ip)

    def _db_unblock_ip(self, ip: str):
        """Unblock IP in the database."""
        if not self.db:
            raise DatabaseError("Database not connected.")

        logging.info(f"Unblocking IP {ip}")
        with self.db_lock:
            # Remove the block from the database
            self.db.remove_ip_block(ip)

            # Remove the IP from the local mapping
            if ip in self.blocked_ips:
                del self.blocked_ips[ip]

            # Unblock in the firewall and sniffer
            self.firewall.unblock_ip(ip)
            self.sniffer.unblock_ip(ip)

    def _firewall_unblock_ips(self):
        """Unblock IPs (only in firewall)."""
        with self.db_lock:
            # We're not doing anything with the DB but the blocked_ips
            # instance variable needs to be accessed within the db_lock
            # since it could be changed by another thread.
            for ip in self.blocked_ips:
                self.firewall.unblock_ip(ip)  # Only unblock in firewall

    def _db_load_ip_blocks(self):
        """Load blocked IPs from the database."""
        logging.info("Loading IP block list.")
        with self.db_lock:
            # Load the IP block list from the database and add to the local
            # mapping, block in the firewall, and block in the sniffer
            for ip_block in self.db.get_blocked_ips():
                ip = ip_block.ip_addr
                unblock_after = ip_block.unblock_after
                logging.debug(f"Blocking IP {ip}")
                self.blocked_ips[ip] = unblock_after
                self.firewall.block_ip(ip)
                self.sniffer.block_ip(ip)

    def _expire_ip_blocks(self) -> None:
        """Remove and expire IP blocks. Called on an interval from _run()."""
        # Local list of IPs to unblock. We can't call _db_unblock_ip()
        # while iterating self.blocked_ips or we'll change the dict
        # while iterating.
        unblock = []
        with self.db_lock:
            for ip, unblock_after in self.blocked_ips.items():
                now = datetime.datetime.now(datetime.timezone.utc).timestamp()
                if unblock_after == 0:
                    continue  # Never expire
                # If it's time to unblock, unblock the IP.
                if now >= unblock_after:
                    unblock.append(ip)

        # Actually do the unblocking
        for ip in unblock:
            logging.info(f"Expiring block for IP {ip}")
            self._db_unblock_ip(ip)

    def print_qr_code(self,
                      svg: bool = False,
                      png: bool = False,
                      no_console: bool = False,
                      uid: str = "admin",
                      hostname: Optional[str] = None):
        """Print the QR code."""
        hostname = hostname or socket.gethostname()
        if not self.db:
            raise DatabaseError("Database not connected")

        name = f"{uid}@{hostname}"
        user = self.db.get_user(uid)
        if not user:
            logging.error(f"No user in database with UID {uid}")
            return

        uri = pyotp.totp.TOTP(user.b32_secret).provisioning_uri(name=name, issuer_name='tnokd')
        qr = pyqrcode.create(uri)
        if svg:
            qr.svg(f"{name}.svg", scale=8)
        if png:
            qr.png(f"{name}.png", scale=2)

        if not no_console:
            print(qr.terminal(quiet_zone=1))

        print(f"Secret key: {user.b32_secret}")
        print(f"URI: {uri}")

        if svg:
            print(f"QR code saved to \"{os.path.abspath(".")}/{name}.svg\"")
        if png:
            print(f"QR code has been saved to \"{os.path.abspath(".")}/{name}.png\"")

    def _protect_ports(self) -> bool:
        """Protect a list of ports using the firewall."""
        if not self.config.protected_ports:
            logging.warning(f"There are no ports configured in protected_ports in the config {self.conf_file}.")
            return True

        self.port_protocol_lookup = {}
        for port_schema in self.config.protected_ports:
            self.port_protocol_lookup[port_schema.number] = port_schema.protocol
            if not self.firewall.block_port(port_schema.number, port_schema.protocol):
                return False

        for ip_network in self.config.always_allow_from:
            if not self.firewall.add_always_allow_ip(ip_network):
                return False
        return True

    def _unprotect_ports(self):
        """Undo port protection on exit."""
        if not self.config.protected_ports:
            return True

        for port_schema in self.config.protected_ports:
            if not self.firewall.unblock_port(port_schema.number, port_schema.protocol):
                return False

        for ip_network in self.config.always_allow_from:
            if not self.firewall.remove_always_allow_ip(ip_network):
                return False

        return True

    def _permit_port(self, port: int, src_ip: str):
        """Permit access to a port from a specified source IP."""
        if port not in self.port_protocol_lookup:
            logging.error("Got correct knock sequence for a port we're not protecting. Ignoring.")
            return
        self.firewall.allow_port(src_ip, port, self.port_protocol_lookup[port], self.config.port_open_duration)

    def _check_code(self, user: ClientSecret, code: Union[str, int]) -> bool:
        """Check a code for a given ClientSecret."""
        code = str(code).zfill(6)
        totp = pyotp.TOTP(user.b32_secret)
        last_time_code = None
        prev_window = self.config.totp_previous_code_window
        if prev_window > 0:
            last_time_code = totp.at(datetime.datetime.now() - datetime.timedelta(seconds=prev_window))
        else:
            logging.debug("Previous time code window disabled in config")
        current_time_code = totp.now()

        logging.debug(f"Checking uid={user.uid}, code={code} against current={current_time_code} and last={last_time_code}")
        if current_time_code == code or (last_time_code is not None and last_time_code == code):
            return True
        return False

    def _check_code_any_uid(self, src_ip: str, knock_port: int, code: Union[str, int]) -> bool:
        """Check a code against ANY uid to see if it could be valid."""
        if self.db is None:
            logging.error("Database not connected!")
            return False

        for user in self.db.get_users():
            if self._check_code(user, code):
                logging.info(f"code match for {user.uid} for port {knock_port} from {src_ip}")
                return True
        logging.warning(f"Failed knock sequence from {src_ip} to open port {knock_port}. No matching UID for code {code}.")
        self._handle_ip_blocking(src_ip)
        return False

    def _check_code_uid(self, src_ip: str, knock_port: int, code: Union[str, int], uid: str, allow_ips: Optional[List[str]]) -> bool:
        """Check a code against a specific UID."""
        if self.db is None:
            logging.error("Database not connected!")
            return False

        user = self.db.get_user(uid)
        if not user:
            # No user with provided UID
            logging.warning(f"Rogue knock from {src_ip} to open port {knock_port} for nonexistent user {uid}")
            self._handle_ip_blocking(src_ip)
            return False

        if self._check_code(user, code):
            logging.info(f"Opening desired port {knock_port} for IP {src_ip}")
            self._permit_port(knock_port, src_ip)

            allow_ips = allow_ips or []
            for ip in allow_ips:
                if ip != src_ip:
                    logging.info(f"Knock contained additional allow IP: {ip} to permit. Permitting...")
                    self._permit_port(knock_port, ip)
            return True

        logging.warning(f"Failed knock sequence from IP {src_ip} to open port {knock_port}")
        self._handle_ip_blocking(src_ip)
        return False

    def _knock_callback(self, src_ip: str, knock_port: int, code: Union[str, int], uid: Optional[str] = None, allow_ips: Optional[List[str]] = None) -> bool:
        """Validate a code and optional UID, blocking IPs where necessary and permitting ports when knock succeeds."""
        if not self.db:
            logging.error("Database not connected!")
            return False

        # Do we even protect this port?
        found = False
        for port_schema in self.config.protected_ports:
            pnum = port_schema.number
            if knock_port == pnum:
                found = True
                break

        if not found:
            # The desired port to open is not one we're protecting. Rogue/incorrect knock.
            logging.warning(f"Rogue knock from {src_ip} to open port {knock_port} that is not in protection list.")
            self._handle_ip_blocking(src_ip)
            return False

        # This is a port we protect and we have a valid knock - does this knock have a uid or not?
        if uid is None:
            return self._check_code_any_uid(src_ip, knock_port, code)
        return self._check_code_uid(src_ip, knock_port, code, uid, allow_ips)

    def _handle_ip_blocking(self, src_ip: str):
        """Handle tracking and blocking IPs that try too many times."""
        if not self.config.ip_blocking.enabled:
            return  # Blocking is not enabled. Nothing to do.

        # Get some timestamps. We need the current time, and the time in the past
        # that would be the furthest in the past that the last failure could have
        # occurred. 5 invalid attempts in an hour vs. 5 invalid attempts in 10 seconds.
        now = datetime.datetime.now(datetime.timezone.utc)
        within = (now - datetime.timedelta(seconds=self.config.ip_blocking.attempt_within)).timestamp()
        if src_ip not in self.ip_blocker:
            block_tracker = {
                "attempts": 0,
                "last_attempt": now.timestamp()
            }
            self.ip_blocker[src_ip] = block_tracker
        else:
            block_tracker = self.ip_blocker[src_ip]

        # Get attempts and last attempt time
        block_tracker["attempts"] += 1
        last_attempt = block_tracker["last_attempt"]
        attempts = block_tracker["attempts"]

        # If it's been long enough, it's fine. Reset.
        if last_attempt < within:
            # Resetting attempts to 0
            logging.debug(f"IP {src_ip} last attempt was more than {self.config.ip_blocking.attempt_within}"
                          " seconds ago. Resetting to 0 attempts")
            block_tracker["attempts"] = 0
            return

        # Block IP for exceeding the max attempts
        if attempts > self.config.ip_blocking.max_attempts:
            logging.info(f"IP {src_ip} exceeded {self.config.ip_blocking.max_attempts} attempts within "
                         f"{self.config.ip_blocking.attempt_within} seconds. Blocking.")
            self._db_block_ip(src_ip)

    def _install_linux(self) -> int:
        """Install the service on Linux."""
        if os.path.exists("/etc/systemd/system/tnokd.service"):
            logging.info("Service is already installed.")
            return 0

        try:
            with open("/etc/systemd/system/tnokd.service", "w", encoding='utf-8') as fh:
                fh.write(LINUX_SERVICE_FILE)
        except OSError as exc:
            logging.error(f"Failed to create service file. {exc}")
            return 1

        try:
            subprocess.check_output(["systemctl", "daemon-reload"], stderr=subprocess.STDOUT)
            subprocess.check_output(["systemctl", "enable", "tnokd.service"], stderr=subprocess.STDOUT)
            subprocess.check_output(["systemctl", "start", "tnokd.service"], stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to install/start service. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode()}")
            return 1

        return 0

    def _uninstall_linux(self) -> int:
        """Uninstall the service on Linux."""
        if not os.path.exists("/etc/systemd/system/tnokd.service"):
            logging.info("Service is not installed.")
            return 0

        try:
            subprocess.check_output(["systemctl", "stop", "tnokd.service"], stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to uninstall/stop service. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode()}")
            return 1

        try:
            os.remove("/etc/systemd/system/tnokd.service")
        except Exception as exc:
            logging.error(f"Failed to remove service file. {exc}")
            return 1

        try:
            subprocess.check_output(["systemctl", "daemon-reload"], stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc:
            logging.warning(f"Failed to reload systemctl daemon. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode()}")
        return 0

    def _get_nssm_exe(self) -> Optional[str]:
        """Get the NSSM executable path."""
        from tnokd.win32.nssm import download_nssm
        nssm_exe = os.path.join(SCRIPT_DIR, "win32", "nssm.exe")
        if not os.path.exists(nssm_exe):
            # Use the python script
            if not download_nssm():
                logging.error("Failed to download nssm.exe")
                return None
        logging.debug(f"nssm.exe path: {nssm_exe}")
        return nssm_exe

    def _stop_service_win32(self, nssm_exe: str) -> int:
        """Stop the win32 service."""
        try:
            subprocess.check_output([nssm_exe, "stop", "tnokd"], stderr=subprocess.STDOUT)  # nosemgrep
        except subprocess.CalledProcessError as exc:
            logging.warning(f"Failed to stop service. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode('utf-16le')}")
            return 1
        return 0

    def _status_service_win32(self, nssm_exe: str) -> str:
        """Get the win32 tnokd service status using NSSM."""
        try:
            output = subprocess.check_output([nssm_exe, "status", "tnokd"], stderr=subprocess.STDOUT)  # nosemgrep
            return "running" if "SERVICE_RUNNING" in output.decode('utf-16le') else "stopped"
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to get service status. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode('utf-16le')}")
            return "error"

    def _install_win32(self) -> int:
        """Install the service on Windows."""
        nssm_exe = self._get_nssm_exe()
        if nssm_exe is None:
            return 1
        tnokd_exe = sys.argv[0]
        if not os.path.exists(tnokd_exe):
            tnokd_exe = tnokd_exe + ".exe"
            if not os.path.exists(tnokd_exe):
                logging.error(f"File {tnokd_exe} not found.")
                return 1

        logging.debug("Installing service for win32.")

        sys_executable = sys.executable
        if self.in_pyinstaller_bundle:
            # Running inside pyinstaller, copy the executable to program files
            os.makedirs(self.WIN32_BASE_INSTALL_DIR, exist_ok=True)

            dest_nssm_exe = os.path.join(self.WIN32_BASE_INSTALL_DIR, os.path.basename(nssm_exe))
            logging.debug(f"Installing {nssm_exe} to {dest_nssm_exe}")
            if not os.path.exists(dest_nssm_exe):
                try:
                    shutil.copy(nssm_exe, dest_nssm_exe)
                except Exception as exc:
                    logging.error(f"Unable to install {nssm_exe} to {dest_nssm_exe}. {exc}")
                    return 1
            nssm_exe = dest_nssm_exe

            dest_tnokd_exe = os.path.join(self.WIN32_BASE_INSTALL_DIR, os.path.basename(sys_executable))
            if dest_tnokd_exe.strip().lower() != sys_executable.strip().lower():
                logging.debug(f"Installing {sys_executable} to {dest_tnokd_exe}")

                if os.path.exists(dest_tnokd_exe):
                    logging.info("Existing tnokd found.")
                    if self.check_service_running() or self._status_service_win32(nssm_exe) == "running":
                        logging.info("Stopping existing service")
                        self._stop_service_win32(nssm_exe)
                    logging.info("Updating service binary")
                    try:
                        os.remove(dest_tnokd_exe)
                    except Exception as exc:
                        logging.error(f"Unable to remove tnokd binary at {dest_tnokd_exe}. {exc}")
                        return 1

                try:
                    shutil.copy(sys_executable, dest_tnokd_exe)
                except Exception as exc:
                    logging.error(f"Unable to install {sys_executable} to {dest_tnokd_exe}. {exc}")
                    return 1

            # Update the executables we want to use to start the service to the installed ones
            sys_executable = dest_tnokd_exe
            tnokd_exe = dest_tnokd_exe

        try:
            subprocess.check_output([nssm_exe, "install", "tnokd", sys_executable], stderr=subprocess.STDOUT)  # nosemgrep
        except subprocess.CalledProcessError as exc:
            output = exc.output.decode('utf-16le')
            if "the specified service already exists" not in output.strip().lower():
                logging.error(f"Failed to install service. {exc}")
                logging.debug(f"Failed command output:\n{output}")
                return 1
            logging.warning("Service already exists.")

        try:
            args = [nssm_exe, "set", "tnokd", "AppParameters", tnokd_exe, "start"]
            if self.in_pyinstaller_bundle:
                args = [nssm_exe, "set", "tnokd", "AppParameters", "start"]
            subprocess.check_output(args, stderr=subprocess.STDOUT)  # nosemgrep
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to install service. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode('utf-16le')}")
            return 1

        try:
            subprocess.check_output([nssm_exe, "start", "tnokd"], stderr=subprocess.STDOUT)  # nosemgrep
        except subprocess.CalledProcessError as exc:
            output = exc.output.decode('utf-16le')
            if "service_start_pending" in output.strip().lower():
                logging.warning("Service is taking longer than expected to start. Checking again...")
                time.sleep(5)  # nosemgrep
                if self._status_service_win32(nssm_exe) != "running":
                    logging.error("Service took too long to start.")
                    return 1
            else:
                logging.error(f"Failed to start service. {exc}")
                logging.debug(f"Failed command output:\n{output}")
                return 1

        logging.info("Service started")
        return 0

    def _uninstall_win32(self) -> int:
        """Uninstall the service on Windows."""
        nssm_exe = self._get_nssm_exe()
        if nssm_exe is None:
            return 1

        # If it fails we still want to try to delete the service
        self._stop_service_win32(nssm_exe)

        try:
            # Prefer sc.exe delete b/c it seems to work more often and doesn't leave the service
            # in a weird pending uninstall state that requires a reboot.
            subprocess.check_output(["sc.exe", "delete", "tnokd"], stderr=subprocess.STDOUT)  # nosemgrep
        except subprocess.CalledProcessError as exc:
            logging.error(f"Failed to uninstall service. {exc}")
            logging.debug(f"Failed command output:\n{exc.output.decode()}")
            return 1

        return 0
