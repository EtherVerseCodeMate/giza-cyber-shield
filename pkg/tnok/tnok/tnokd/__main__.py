"""
tnokd.__main__ – Tnok Stealth Gateway entry point
Run via:  python -m tnokd [options]
"""

import argparse
import sys


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="tnokd",
        description="Tnok Stealth Gateway – Lorentz-Invariant port-knock daemon",
    )
    p.add_argument("--port", type=int, default=51820, help="UDP listen port (default: 51820)")
    p.add_argument("--interface", default="0.0.0.0", help="Bind address (default: 0.0.0.0)")
    p.add_argument("--debug", action="store_true", help="Enable debug logging")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    print(f"[tnokd] Lorentz-Invariant Stealth Gateway listening on {args.interface}:{args.port}")
    if args.debug:
        print("[tnokd] Debug mode enabled")
    # Full daemon implementation to be wired here.
    print("[tnokd] Daemon stub – integrate lorentz.verify_khepra_knock() in your listener loop.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
