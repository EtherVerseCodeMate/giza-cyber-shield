"""Wrapper around the NSSM - Non-Sucking Service Manager.

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
import shutil
import zipfile
import logging

import requests

SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))
NSSM_EXE = os.path.join(SCRIPT_DIR, "nssm.exe")
URL = "https://nssm.cc/release/nssm-2.24.zip"


def _download_file(url, dest):
    """Download a file."""
    logging.debug(f"Downloading nssm.exe from {url} to {dest}")
    with requests.get(url, stream=True, timeout=120) as r:  # nosemgrep
        r.raise_for_status()
        with open(dest, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    return dest


def download_nssm() -> bool:
    """Download the NSSM if it's missing."""
    logging.info("Downloading nssm.exe")
    zip_dest = os.path.join(SCRIPT_DIR, "nssm.zip")
    try:
        _download_file(URL, zip_dest)
    except Exception as exc:
        logging.error(f"Failed to download NSSM. {exc}")
        return False

    tmp_path = os.path.join(SCRIPT_DIR, "tmp")
    os.makedirs(tmp_path, exist_ok=True)
    with zipfile.ZipFile(zip_dest) as zf:
        zf.extractall(tmp_path)

    nssm_dirname = os.listdir(tmp_path)[0]
    tmp_exe = os.path.join(SCRIPT_DIR, "tmp", nssm_dirname, "win64", "nssm.exe")
    shutil.copy(tmp_exe, SCRIPT_DIR)

    os.remove(zip_dest)
    shutil.rmtree(tmp_path)
    return True
