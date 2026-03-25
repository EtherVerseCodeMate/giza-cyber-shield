# Tnok

![Pipeline Status](https://gitlab.com/ainfosec-official/tnok/badges/main/pipeline.svg?ignore_skipped=true)

A generic, drop-in, 2-factor gatekeeper for any TCP or UDP network service, providing port-level access controls.

What is it? It's not a firewall or IDS, it's something new.

0-configuration setup - your services continue to work as expected without any custom configuration.

Want to learn more? [Read the blog post](https://www.ainfosec.com/tnok-next-generation-port-security)

## Feature Highlights

* No port forwarding required
* Out-of-band key storage allows for use with Google authenticator, yubikey, MS Authenticator, and others.
* Built-in brute-force protection via automated IP blocking.
* Support for multiple users each with unique time codes.
* Support for legacy systems as far back as Windows 7 SP1.
* Simple service wrappers for `ssh` and `scp` (more to come in the future)

## Background / Why?

The goal of this project was to provide drop-in security enhancements that bolster existing security and access controls on current and legacy systems.

Tnok is easy to use and does not require configuration changes to deploy. The custom knock technique works out-of-the-box with existing firewall rules without requiring any additional port forwarding.

Traditional port knockers rely on multiple ports and static knock sequences which require external firewall port forwarding and are susceptible to brute force, sniffing, replay, and man-in-the-middle attacks. Tnok requires 1 port per service - the port the service is already listening on - and utilizes short-lived pseudo-random rolling codes that can't be easily guessed, limiting the effectiveness of brute force, sniffing, replay, and man-in-the-middle attacks.

Tnok changes a system's fingerprint on a network by reducing or completely eliminating open ports. This prevents automated scans from probing those ports, fingerprinting systems, and may even lead to systems being ignored as uninteresting to attackers. Tnok will never generate traffic in response to scanning, which ensures network scanners will be unable to differentiate between closed ports and those that are protected by Tnok.

### Benefits

The benefits of deploying tnok range from reducing noisy logs from internet scanners and automated brute forcing systems to greatly reducing external systems susceptibility to zero-days. Consider the following:

* [CVE-2024-6387](https://nvd.nist.gov/vuln/detail/CVE-2024-6387) - When this initially dropped, there wasn't a patch available for every susceptible system on day one. For that Window of time, thousands of systems were left without protection. Tnok would have provided security for that window of time, and given people ample time to update effected systems without interrupting legitimate uses of those services.
* [CVE-2017-0144](https://nvd.nist.gov/vuln/detail/cve-2017-0144) - Old but relevant. EternalBlue impacted SMB on practically every Windows version that was out at the time. There are networks with old systems running custom hardware with outdated software that can't easily be patched and they still exist today. Tnok, supporting basically any OS Windows/Linux since 2011, could be very useful on those systems.

## Design Overview

Tnok is designed as a client and server. The server is deployed alongside the service(s) to protect and acts as a thin wrapper around existing TCP/UDP listening ports.

The client is used directly or through service wrappers to knock prior to connecting to protected services.

![knock-demo.mp4](demo/knock-demo.mp4)

## Installation/Update

Download from the [latest releases page](https://gitlab.com/ainfosec-official/tnok/-/releases/permalink/latest). There are two options when downloading: A binary package or a wheel. The binary packages are OS and architecture specific, so make sure to choose the right one. They are all in archives (`.tar.xz` for Linux, `.zip` for Windows). The wheel is cross-platform and should work on any architecture, but requires that you have a compatible Python version (3.12 recommended) installed and we recommend using `pipx` to install the wheel.

### Install from Wheel

This can be done on any OS and any architecture with a supported version of Python and `pipx` installed.

1. Get Python and `pipx`
    * _Recommended: Python 3.10 to 3.12_
    * _Works with Python 3.7.0 and up (only recommended for Legacy installs)_
1. Download the wheel from the [latest releases page](https://gitlab.com/ainfosec-official/tnok/-/releases/permalink/latest)
1. Install with `pipx`
    ```shell
    pipx install ./tnok-X.X.X-py3-none-any.whl
    ```
1. See example `tnokd` and `tnok` usage in the [Use Case: Protect an SSH server](#use-case-protect-an-ssh-server) section.

### Install on Linux

1. Download the linux binary `.tar.xz` from the [latest releases page](https://gitlab.com/ainfosec-official/tnok/-/releases/permalink/latest)
1. Install the binary where you want to run it from:
    ```bash
    # Extract
    tar -Jxvf ./tnok-v*-linux64.tar.xz
    # Install the client if you need to knock from this system
    sudo mv ./tnok-v*-linux64/tnok /usr/bin/tnok
    # Install the service if you need to protect ports on this system
    sudo mv ./tnok-v*-linux64/tnokd /usr/bin/tnokd
    # Install optional knock helpers
    sudo mv ./tnok-v*-linux64/tssh /usr/bin/tssh
    sudo mv ./tnok-v*-linux64/tscp /usr/bin/tscp
    ```
1. See example `tnokd` and `tnok` usage in the [Use Case: Protect an SSH server](#use-case-protect-an-ssh-server) section.

### Windows (modern)

1. Download the Windows binary `.zip` from the [latest releases page](https://gitlab.com/ainfosec-official/tnok/-/releases/permalink/latest)
1. Install [npcap](https://npcap.com/) leaving all options default during install.
1. Open an Administrator PowerShell
1. Extract the zip and optionally add the binaries to your path
    ```powershell
    # Extract to a location you'd like to install it
    Expand-Archive -Path ./tnok-v*-win64.zip -DestinationPath <C:\install_path\>
    # Update your path for the current session
    $env:Path += ";<C:\install_path\>"
    # Persist the change
    $userPath = [System.Environment]::GetEnvironmentVariable("PATH", "USER")
    [System.Environment]::SetEnvironmentVariable("PATH", $userPath + ";<C:\install_path\>", "USER")
    ```
1. If this system is the server system, install the service:
    ```powershell
    # On Windows, tnokd.exe, nssm.exe, all log files, and configuration files are installed to
    # C:/Program Files/tnokd/
    tnokd install
    ```
1. See example `tnokd` and `tnok` usage in the [Use Case: Protect an SSH server](#use-case-protect-an-ssh-server) section.

### Windows (7 SP1, and 8)

_For Windows 7/8._

1. Download the legacy Windows binary `.zip` from the [latest releases page](https://gitlab.com/ainfosec-official/tnok/-/releases/permalink/latest)
1. Download and install Legacy Wireshark version 2.2.1 and make sure to select to install WinPcap during Wireshark installation.
    * _Tip: Legacy versions of Wireshark for Windows can be found here: https://2.na.dl.wireshark.org/win64/all-versions/_
    * **npcap does not work.** Must be WinPcap.
1. Extract the zip and optionally add the binaries to your path
    ```powershell
    # Extract to a location you'd like to install it
    Expand-Archive -Path ./tnok-v*-win-x64.zip -DestinationPath <C:\install_path\>
    # Update your path for the current session
    $env:Path += ";<C:\install_path\>"
    # Persist the change
    $userPath = [System.Environment]::GetEnvironmentVariable("PATH", "USER")
    [System.Environment]::SetEnvironmentVariable("PATH", $userPath + ";<C:\install_path\>", "USER")
    ```
1. If this system is the server system, install the service:
    ```powershell
    # On Windows, tnokd.exe, nssm.exe, all log files, and configuration files are installed to
    # C:/Program Files/tnokd/
    tnokd install
    ```
1. See example `tnokd` and `tnok` usage in the [Use Case: Protect an SSH server](#use-case-protect-an-ssh-server) section.

### Android

_Right now, Android support is limited to only running the `tnok` client within Termux. An Android app is in the works._

1. Download the wheel from the [latest releases page](https://gitlab.com/ainfosec-official/tnok/-/releases/permalink/latest) to the Android device
1. Install Termux via F-Droid or Github: https://github.com/termux/termux-app#installation
1. Install Python3 and pip within Termux via: `pkg install python3 python3-pip`
1. Install `pipx`: `pip install pipx`
1. Give Termux file-system permissions on Android and browse to `/storage/emulated/0/Download` where the wheel was downloaded.
1. Install the wheel: `pipx install tnok-X.X.X-py3-none-any.whl`
1. Use `tnok` or the `tssh`, `tscp` service wrappers on the command line.
    * _NOTE: `tnokd` will not work on Android as it requires root._

## Uninstall

### Wheel

1. If using the `tnokd` service, first uninstall the service: `tnokd uninstall`
1. If installed with `pipx` from a wheel, uninstall with: `pipx uninstall tnok`
1. To fully cleanup the install (and lose all user keys and config):
    * Windows: Delete the `C:\Program Files\tnokd` directory if it exists
    * Linux: Delete the `/etc/tnokd` directory if it exists

### Linux

1. If using the `tnokd` service, first uninstall the service: `tnokd uninstall`
1. Delete the `tnokd`, `tnok`, `tssh`, and `tscp` binaries from `/usr/bin`:
    ```bash
    sudo rm /usr/bin/{tssh,tnok,tnokd,tscp}
    ```
1. To fully cleanup the install (and lose all user keys and config): Delete the `/etc/tnokd` directory if it exists: `sudo rm -rf /etc/tnokd`

### Windows

1. If using the `tnokd` service, first uninstall the service: `tnokd uninstall`
1. Delete the `tnokd`, `tnok`, `tssh`, and `tscp` binaries from the install location chosen at install time
1. To fully cleanup the install (and lose all user keys and config): Delete the `C:\Program Files\tnokd` directory if it exists

## Use Case: Protect an SSH server

### Server

1. Install `tnokd` on the system running the SSH server per the installation instructions above.
1. On the server system, retrieve the admin's TOTP code: `tnokd code`
    * _Tip: use `tnokd code --svg --no-console` to save an SVG of the code in case the code in the console is too big or cannot be scanned._
1. Scan the generated code with your authenticator app of choice.
1. Validate that the code is working: `tnokd validate --code <code>`
    * _Tip: Make sure your system clock is set to the correct time **and** timezone!_
1. Protect the SSH port: `tnokd add-port --number 22 --protocol tcp`
1. Install the service to run automatically in the background: `tnokd install`
    * _Tip: Uninstall with `tnokd uninstall`. Once installed as a service, it can be managed with the system's service management software. On linux, `systemctl`. On Windows, `services.msc`._
    * _Tip: To run the service in the foreground manually, use `tnokd start`._
    * _Tip: Only one instance of the service can be running at a time._
    * _Tip: On Linux, configure the service to start automatically: `systemctl --system enable tnokd`_
1. Check that the service is running: `tnokd status`
1. (Optional) Configure to not require knocking from LAN addresses:
    1. Determine your LAN: `ipconfig` for Windows, `ifconfig` or `ip addr list` on Linux.
    1. Looking at the primary interface's IP address and netmask, determine the CIDR notation. For example, if your computer's IP is `192.168.1.123` and netmask is `255.255.255.0`, then your LAN is `192.168.1.0/24`
    1. Configure `tnokd`: `tnokd add-always-allow-ip --ip 192.168.1.0/24`
    1. Restart the service:
        * Linux: `systemctl restart tnokd`
        * Windows: `sc.exe stop tnokd`, then `sc.exe start tnokd`
    1. Test by running `ssh` from another system on the LAN and confirm the connection works without knocking

### Client

1. Retrieve the current code from your authenticator app
1. Use the `tssh` wrapper to connect: `tssh username@<ip_or_hostname>`
1. Type in the code when prompted
    * _Tip: you can also provide the code on the command line with `--tnok-code`._
    * _Tip: If you have multiple users, the default UID is admin. To specify another UID, use `--tnok-uid`._
    * _Tip: Tnok also supports connecting to hosts defined in an SSH-config file. Try it out!_

## Advanced Usage

### Custom Knock

The `tnok` script can be used to knock on any port even if there is no wrapper for the target service.

```shell
# TCP (default technique)
tnok --desired-port 12345 --target <IP_or_hostname> --code <code>
# TCP (specific knock technique. Use --help for list.)
tnok --desired-port 12345 --target <IP_or_hostname> -k <knock-technique> --code <code>
# UDP
tnok --desired-port 12345 --target <IP_or_hostname> -k NokUDP --code <code>
```

### Allow List

By default, `tnokd` will protect access to ports from any IP, remote or LAN. It is recommended to configure `tnokd` to always allow the LAN. In this example, we'll say the LAN is `192.168.1.0/24`. The allow list can have specific IPs and IP networks (CIDR notation).

* Add an IP to the allow list:
    ```shell
    tnokd add-always-allow-ip --ip 192.168.1.0/24
    tnokd add-always-allow-ip --ip 104.236.123.248
    ```
* List IPs on the allow list:
    ```shell
    tnokd list-always-allow-ips
    ```
* Remove an IP from the allow list:
    ```shell
    # Remove one
    tnokd remove-always-allow-ip --ip 104.236.123.248
    # Remove all
    tnokd remove-allows-allow-ip --all
    ```

### Multiple users

When adding a user, you must pick a UID. The UID must be 16 characters or less. The user's full name (specified with `--fullname`) is optional. The default user's UID is `admin` so that is the only UID you cannot add. To regenerate the admin's secret key, you can use `remove-user` with `--uid admin`. In this case, the `admin` UID will be removed and re-added at the same time with a new secret key. This will completely invalidate the old secret key for the admin.

* Add a user:
    ```shell
    # Add the user
    tnokd add-user --uid "whatever"
    # Get the code for the user
    tnokd code --uid "whatever"
    ```
* Remove a user:
    ```shell
    tnokd remove-user --uid "whatever"
    ```
* Regenerate the admin secret key:
    ```shell
    tnokd remove-user --uid "admin"
    tnokd code
    ```
* Knock with a non-admin UID:
    ```shell
    # Using tnok
    tnok --desired-port 12345 --target <host> --uid somebody --code <code>
    # Using ssh service wrapper tssh
    tssh --tnok-uid somebody username@place.whatever
    ```

### Managing the IP block list

_NOTE: IPs added with `block-ip` will be set to never expire. This cannot currently be changed. IPs added automatically by the service when invalid attempts are detected are set to expire based on the expiration settings in the config file._

* Add a blocked IP
    ```shell
    # By single IP
    tnokd block-ip --ip 123.123.123.123
    # By block list
    tnokd block-ip --list ip-block-list.txt
    ```
* Remove a blocked IP
    ```shell
    # By single IP
    tnokd unblock-ip --ip 123.123.123.123
    # Clear all blocks
    tnokd unblock-ip --all
    ```
* List blocked IPs
    ```shell
    # Just the IPs
    tnokd list-blocked-ips
    # With expiration times
    tnokd list-blocked-ips -l
    ```

### Changing Listen Interfaces

* List interfaces
    ```shell
    tnokd list-interfaces
    ```
* Set interface
    ```shell
    # Listen on 1 interface
    tnokd set-interface --iface <iface>
    # Listen on multiple
    tnokd set-interface --iface <iface1> --iface <iface2>
    # Listen on all interfaces
    tnokd set-interface --all
    # Listen on the default interface
    tnokd set-interface --default
    ```

### Service Management

* Windows:
    * Logs: Open the log file `C:\Program Files\tnok\tnokd.log`
    * Start: `sc.exe start tnokd`
    * Stop: `sc.exe stop tnokd`
    * Delete: `sc.exe delete tnokd` or `tnokd uninstall`
    * Or use `services.msc` and search for `tnokd`
* Linux:
    * Logs: `systemctl -u tnokd` or follow live: `systemctl -u tnokd -f`
    * Start: `systemctl start tnokd`
    * Stop: `systemctl stop tnokd`
    * Delete: `tnokd uninstall`

### Service Files

* Windows:
    * Log: `C:\Program Files\tnokd\tnokd.log`
    * Config: `C:\Program Files\tnokd\tnokd.conf`
    * Database: `C:\Program Files\tnokd\db.sqlite`
* Linux:
    * Log: `/var/log/tnokd.log`
    * Config: `/etc/tnokd/tnokd.conf`
    * Database: `/etc/tnokd/db.sqlite`
    * Service: `/etc/systemd/system/tnokd.service`

### Service Configuration File

_The service should configure itself automatically including selection of the correct firewall backend and interface._

1. To edit the service config edit the following file for your OS:
    * Windows: `C:\Program Files\tnokd\tnokd.conf`
    * Linux: `/etc/tnokd/tnokd.conf`

_NOTE: Most settings can be set, changed, and printed using arguments to `tnokd` on the command line. See `tnokd --help` for information._

An example config and field descriptions can be found below.

```json
{
  "listen_interfaces": [
    "eth0"
  ],
  "protected_ports": [],
  "port_open_duration": 60.0,
  "persist_protected_ports": false,
  "linux_firewall_backend": "iptables",
  "win32_firewall_backend": "NetFirewallRule",
  "knock_timeout": 6,
  "auth_timeout": 6,
  "totp_previous_code_window": 30,
  "always_allow_from": [],
  "ip_blocking": {
    "max_attempts": 3,
    "attempt_within": 300,
    "enabled": true,
    "expire_after": 0,
    "persist": true
  }
}
```

* __listen_interfaces__: List of the interfaces to listen on. On Linux, leaving this empty will listen on all interfaces. On Windows, at least one interface must be set to capture anything. Use `ipconfig` to list interfaces and use the names provided in that output.
* __protected_ports__: List of protected ports. Each port is specified in a dictionary with `number` and `protocol` fields. The `protocol` field can be "tcp", "udp", or "both".
* __persist_protected_ports__: If `true`, the protected ports will remain blocked when tnokd is not running. This will prevent access to these ports and there will be no way to open them with a knock sequence until tnokd is restarted. If `false`, the blocked ports will be unblocked when the service stops.
* __port_open_duration__: The window of time (in seconds) that the port remains open after successful knock. On Windows, due to the way the firewall works, it's best to set this value to something high as you will be unable to access the port at the end of the timeout. On Linux, it's best to set the value lower (even 60 seconds is fine) as established connections will not be killed when the timeout expires.
* __win32_firewall_backend__: One of `NetFirewallRule` or `netsh` - determines the commands used to manage the firewall on windows. `netsh` is useful for older Windows systems.
* __linux_firewall_backend__: One of `iptables` or `firewalld` - determines the commands used to manage the firewall on Linux.
* __knock_timeout__: Time in seconds a knock can take to complete if more than one packet (TCP MSS knock).
* __auth_timeout__: Time in seconds authentication can take to complete after a successful knock.
* __totp_previous_code_window__: A value between 0 and 30. A value of 0 means the current time code is the only valid time code. A value of 30 allows for the current and previous time code to work. A value between 0 and 30 will allow for some overlap with the previous time code.
* __always_allow_from__: A list of IPs or networks in CIDR notation to always allow connections from. It is recommended to specify the server's LAN network here.
* __ip_blocking__: This section of the config determines IP blocking behavior.
    * __max_attempts__: The max number of invalid attempts allowed before an IP is blocked.
    * __enabled__: If set to `false`, no IP blocking will be done. If set to `true`, IP blocking will be enabled.
    * __expire_after__: Amount of time (in seconds) to wait until blocked IPs are unblocked. Setting this value to 0 will cause blocked IPs to never expire.
    * __attempt_within__: The window of time (in seconds) that invalid attempts need to occur within for an IP before attempts for that IP are reset to 0. A value of 300 would be 5 minutes. That would mean that a rogue IP would need its invalid attempts to occur less than 5 minutes apart for them all to count together. Or, in other words, if 5 minutes goes by for an IP without an invalid attempt, that IP's invalid attempts will be reset to 0.
    * __persist__: If `true`, leave the blocked IP addresses in the firewall even when tnokd is not running. If `false`, the blocked IPs will be removed from the firewall when the service stops.

## Troubleshooting

### Why is the code always invalid?

Check your system's date/time settings. The date, time, and time zone must all be correct. If the clock is the correct time but the time zone is wrong, that will not work.

### The port doesn't seem protected while tnokd is running!

Check your system's firewall. On Windows 7, make sure to configure `tnokd.conf` to have `win32_firewall_backend` set to `netsh`. Also, on Windows or Linux, double check that your firewall doesn't contain any conflicting firewall rules. Specifically on Windows, if a rule is set to allow the port, `tnokd` won't be able to protect it.

### Cannot run tnokd with sudo, command not found

If you installed `tnok` from the wheel using `pipx`, the `tnokd` launcher is placed in `~/.local/bin/tnokd`. When running `sudo`, some of the path magic done by `pipx` is lost since it's specific to your user. To fix this, run with the full path: `sudo ~/.local/bin/tnokd`

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) to setup a development environment.
