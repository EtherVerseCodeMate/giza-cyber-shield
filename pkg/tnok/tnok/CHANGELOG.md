# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

* Added `tabulate` dependency for table output when listing interfaces (refs #11)
* Added `--png` to `code` sub-command of `tnokd` to save the QR code as a PNG

### Removed

* Removed `--eps` from `code` sub-command of `tnokd` (swapped for `--png`) because why did I even have that there? What even is Encapsulated PostScript and why would you want a QR code in that format?

### Fixed

* Fixed `list-interfaces` to have better output on Windows (refs #11)
* Fixed `set-interface --default` to choose the correct default interface on Windows and Linux (refs #11)
* Fixed `set-interface` to support more flexible interface selection on Windows and Linux (refs #11)
* Fixed misleading output when displaying the QR code from `tnokd` that said image files were being created when they weren't being created. (refs #13)

## [v0.3.0] - 04/21/2025

### Added

* Added `--version` to tnok and tnokd
* Added cryptography lib
* Added support for multiple knock techniques: TCP MD5, TCP Mood, UDP, and TCP MSS
* Added flag to specify additional public IPs to allow during knock
* Added iptables rules to block TCP RST being sent for closed ports (ports we're protecting)
* Added `get-interface` command to `tnokd` to print current settings in the config for interface
* Added check to `tnok` and `tnokd` on Windows for `npcap` being installed
* Added support for generating `pyinstaller` binaries
* Added `list-ports` to list protected ports
* Added `add-always-allow-ip`, `remove-always-allow-ip`, and `list-always-allow-ips` to manage the always allow IP list.
* Added support for "always allow" IPs and networks so that a LAN or specific public IP can be whitelisted to allow connection without requiring knocks

### Changed

* Changed `set-interface` to support interface index numbers
* Changed `set-interface --default` output to print the interface being set
* Removed need to elevate from client code
* Removed auto-elevation entirely
* Require manual elevation for tnokd service commands
* Renamed tnok_common to tnoklib - storing all knock related utilities here
* Changed knock design per #2
    * multi-technique
    * encrypted UID/IP exchange
    * support for non-admin client-side TCP knock technique
* Made code verification more lenient. Check current time and last 30 seconds
* Updated `COPYRIGHT.md` for new libs
* Changed `tsh` and `tscp` wrapper syntax to support older Python versions

### Fixed

* Fixed startup slowness from Scapy import. Now we only import Scapy right before we need it.
* Fixed client permission issue on Android. No longer importing Scapy for Knock techniques that don't need it.
* Fixed service startup file path to use `abspath`

## [v0.2.0] - 08/06/2024

### Added

* Initial IPv6 support (untested).
* Added connection tracking to blocked ports to not kill established connections.
* Added support for ssh config files
* Added full control of the IP block list from the command line in `tnokd`
* Added public IP fallback via ip.me

### Changed

* Encode optional public IP in UDP knock for weird networks
* Made the SYN packet look less "crafted" for TCP knocks (better random sequence and source port)
* Changed default path on Windows for `tnokd` service to `C:\\Program Files\\tnokd` from `tnok`

### Fixed

* Fixed windows not knowing when elevated or not. Now, when launching and elevating, it prompts to "enter anything to exit" but when running directly from an admin terminal it will not prompt.
* Handle elevate detection in tnok like we do in tnokd

### Removed

* Removed `max_knock_time_window` config since knocks are a single packet now.

## [v0.1.0] - 08/03/2024

### Added

* Initial app development
* Automated testing
* CI/CD integration
* Support for port knocking on TCP or UDP with client `tnok`
* Support for protecting ports with `tnokd` on Windows and Linux
* Initial user documentation
* Initial `README.md` with development, install, and usage instructions
* Support for `iptables` on Linux and `netsh`, and `NetFirewallRule` on Windows
* Support for IP blocking
* Support for multiple user codes
* Initial wrapper scripts: SSH, SCP
* Support for Windows 7 with install docs
* Install as a service on Linux
* Install as a service on Windows
