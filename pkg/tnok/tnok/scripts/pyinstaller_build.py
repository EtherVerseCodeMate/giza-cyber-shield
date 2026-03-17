"""Build the Pyinstaller bins.

Detect the OS and build appropriate binary.
"""
import os
import sys
import traceback
import subprocess
from typing import List

SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))
NSSM_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "src", "tnokd", "win32"))
NSSM_EXE = os.path.join(NSSM_DIR, "nssm.exe")

BUILD_TNOK = [
    "pyinstaller", "--clean", "-y", "--onefile",
    "--name", "tnok", "./src/tnok/__main__.py"
]
BUILD_TNOKD_LINUX = [
    "pyinstaller", "--clean", "-y", "--onefile", "--name", "tnokd",
    "--collect-data", "cincoconfig", "./src/tnokd/__main__.py"
]
BUILD_TNOKD_WIN32 = [
    "pyinstaller", "--clean", "-y", "--onefile", "--name", "tnokd",
    "--collect-data", "cincoconfig", "--add-binary", f"{NSSM_EXE};./tnokd/win32",
    "./src/tnokd/__main__.py"
]
BUILD_TSSH_WRAPPER = [
    "pyinstaller", "--clean", "-y", "--onefile",
    "--name", "tssh", "./src/tnok/wrappers/tssh.py"
]
BUILD_TSCP_WRAPPER = [
    "pyinstaller", "--clean", "-y", "--onefile",
    "--name", "tscp", "./src/tnok/wrappers/tscp.py"
]


def package_nssm() -> int:
    """Check for and package nssm.exe if needed."""
    if os.path.exists(NSSM_EXE):
        print("nssm.exe already downloaded")
        return 0

    print("Downloading nssm.exe to package pyinstaller windows binary")
    sys.path.append(NSSM_DIR)
    from nssm import download_nssm
    if not download_nssm():
        print("Unable to download nssm.exe for packaging Windows pyinstaller binary")
        return 1
    return 0


def run_cmd(cmd: List[str]) -> int:
    """Run a command with subprocess."""
    cmd_str = " ".join(cmd)
    print(f"Running: {cmd_str}")
    try:
        subprocess.check_call(cmd)
    except subprocess.CalledProcessError as exc:
        print(f"Failed to run command: {cmd_str}")
        return 1
    return 0


def main():
    """Entry Point"""
    if sys.platform == "win32":
        # Only needed for Windows
        if package_nssm() != 0:
            return 1

    print("Building tnok")
    if run_cmd(BUILD_TNOK) != 0:
        return 1

    print("Building tnokd")
    if sys.platform == "win32":
        if run_cmd(BUILD_TNOKD_WIN32) != 0:
            return 1
    else:
        if run_cmd(BUILD_TNOKD_LINUX) != 0:
            return 1

    print("Building tssh")
    if run_cmd(BUILD_TSSH_WRAPPER) != 0:
        return 1
    print("Building tscp")
    if run_cmd(BUILD_TSCP_WRAPPER) != 0:
        return 1


if __name__ == "__main__":
    try:
        rc = main()
    except Exception:
        rc = 1
        traceback.print_exc()
    sys.exit(rc)