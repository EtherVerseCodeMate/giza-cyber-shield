"""
lorentz.py – Lorentz-Invariant Gatekeeper (Patent Appendix A.2)
================================================================
Enforces the spacetime-interval constraint

    Δs² = c²Δt² − Δr² ≥ 0

before spending CPU cycles on cryptographic verification.  Any knock whose
implied agent velocity exceeds the propagation speed of light in fiber is
classified as a geographically distributed replay and dropped.

TRUST MODEL NOTE
----------------
The `lat` / `lon` values passed to `verify_khepra_knock` are client-supplied
fields embedded in the knock packet.  An adversary who has captured a valid
knock can trivially copy the original coordinates and bypass the causality
check.  For the Lorentz check to provide a hard physical guarantee the
coordinates MUST come from a trusted source that the attacker cannot forge —
for example:
  • A hardware GPS module whose reading is bound to the session by a
    PQC attestation (ML-DSA-65 over the full knock payload).
  • An independent geolocation pipeline fed from the network layer
    (IP-based, with known accuracy limitations) rather than from the
    packet contents.
  • The Khepra DAG state that already holds an attested previous
    spacetime coordinate for each Agent ID.

When coordinates are trustworthy, the check converts the TOTP 30-second
replay window into a physical impossibility for any attacker whose replay
origin is more than ≈ 6,000 km from the legitimate source (200,000 km/s ×
30 s ÷ 2 for round-trip).
"""

import hmac
import math
import time
from collections import defaultdict

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Effective speed of light in standard single-mode fiber (~0.667 c)
C_FIBER_KM_S: float = 200_000.0  # km/s

# How long (seconds) a used-token entry is retained before eviction.
# Must be at least as long as your TOTP window to guarantee replay prevention.
USED_TOKEN_TTL: float = 120.0  # 2 minutes

# Rate-limit window and max attempts per window
RATE_LIMIT_WINDOW_S: float = 60.0
RATE_LIMIT_MAX_ATTEMPTS: int = 5

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

# { client_ip: [timestamp, ...] }
_rate_limit_cache: defaultdict[str, list[float]] = defaultdict(list)

# { knock_signature: eviction_timestamp }
# Using a dict with eviction timestamps instead of a plain set avoids the
# unbounded memory growth of an ever-growing set of used tokens.
_used_tokens: dict[str, float] = {}

# { agent_id: (timestamp_s, lat, lon) }
# In production this should be backed by the Khepra DAG persistent state so
# that it survives process restarts and is consistent across replicas.
_agent_spacetime_state: dict[str, tuple[float, float, float]] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _evict_used_tokens(now: float) -> None:
    """Remove expired entries from _used_tokens (amortised O(n) eviction)."""
    expired = [sig for sig, exp in _used_tokens.items() if now >= exp]
    for sig in expired:
        del _used_tokens[sig]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in kilometres between two WGS-84 points."""
    R = 6_371.0  # mean Earth radius, km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


# ---------------------------------------------------------------------------
# Core validators
# ---------------------------------------------------------------------------

def verify_lorentz_causality(
    agent_id: str,
    current_t: float,
    current_lat: float,
    current_lon: float,
) -> bool:
    """
    Enforce the Lorentz-Invariant Timestamping constraint (Patent Appendix A.2).

    Checks Δs² = c²Δt² − Δr² ≥ 0 to detect geographically distributed replay
    attacks.  Two sub-checks are applied:

    1. Monotonicity (Appendix B.3 DagAdd check): the new timestamp must be
       strictly greater than the last recorded timestamp for this agent.
    2. Causality: the implied velocity Δr/Δt must not exceed C_FIBER_KM_S.

    Returns True if the knock is causally consistent, False otherwise.

    See TRUST MODEL NOTE in module docstring before relying on this check as a
    hard security boundary.
    """
    if agent_id not in _agent_spacetime_state:
        # First contact — establish baseline spacetime coordinates.
        _agent_spacetime_state[agent_id] = (current_t, current_lat, current_lon)
        return True

    last_t, last_lat, last_lon = _agent_spacetime_state[agent_id]
    delta_t = current_t - last_t  # seconds

    # 1. Monotonicity check
    if delta_t <= 0:
        # Backdated or duplicate timestamp — definitive replay indicator.
        return False

    # 2. Lorentz / causality check
    delta_r = haversine_distance(last_lat, last_lon, current_lat, current_lon)  # km
    v_implied = delta_r / delta_t  # km/s

    if v_implied > C_FIBER_KM_S:
        # The agent would have had to move faster than light-in-fiber between
        # its last authenticated position and this one.  This is a causality
        # violation: the knock is a geographically distributed replay.
        return False

    # Update persistent spacetime coordinates for this agent.
    _agent_spacetime_state[agent_id] = (current_t, current_lat, current_lon)
    return True


def verify_khepra_knock(
    client_ip: str,
    agent_id: str,
    provided_token: str,
    expected_token: str,
    lat: float,
    lon: float,
) -> bool:
    """
    Hardened TRL-10 Knock Validator integrating physics-layer and crypto-layer
    defences.  Checks are ordered cheapest-to-most-expensive so that expensive
    operations (crypto) are never reached when cheaper checks (rate limit,
    physics) already reject the knock.

    Layer order
    -----------
    1. DoS / rate-limit:      token-bucket per source IP
    2. Physics / causality:   Lorentz spacetime monotonicity + velocity check
    3. Replay prevention:     per-agent token signature cache with TTL eviction
    4. Crypto comparison:     constant-time HMAC digest comparison

    Parameters
    ----------
    client_ip       Source IP address of the incoming knock.
    agent_id        Authenticated agent identifier (bound to spacetime state).
    provided_token  TOTP / knock token supplied by the client.
    expected_token  Server-side expected token for this agent at this instant.
    lat, lon        Client's declared WGS-84 coordinates.  See TRUST MODEL NOTE.
    """
    now = time.time()

    # 1. DoS protection — sliding-window rate limit per source IP
    window = _rate_limit_cache[client_ip]
    _rate_limit_cache[client_ip] = [t for t in window if now - t < RATE_LIMIT_WINDOW_S]
    if len(_rate_limit_cache[client_ip]) >= RATE_LIMIT_MAX_ATTEMPTS:
        return False
    _rate_limit_cache[client_ip].append(now)

    # 2. Physics layer — Lorentz causality check
    if not verify_lorentz_causality(agent_id, now, lat, lon):
        return False

    # 3. Replay prevention — per-agent token cache with TTL eviction
    _evict_used_tokens(now)
    knock_signature = f"{agent_id}:{provided_token}"
    if knock_signature in _used_tokens:
        return False

    # 4. Timing-attack resistance — constant-time token comparison
    if hmac.compare_digest(
        provided_token.encode("utf-8"),
        expected_token.encode("utf-8"),
    ):
        _used_tokens[knock_signature] = now + USED_TOKEN_TTL
        return True

    return False
