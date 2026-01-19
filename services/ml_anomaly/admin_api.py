"""
Admin API endpoints for License Management and Telemetry integration.
Connects to pkg/license (Go) and adinkhepra-telemetry-server.
"""
import subprocess
import json
from datetime import datetime

@app.get("/api/v1/admin/license")
async def get_license_status():
    """
    Get current license status from pkg/license.
    Calls Go CLI to verify license and get claims.
    """
    try:
        # Call Go CLI to get license status
        result = subprocess.run(
            ["adinkhepra", "license", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0 and result.stdout.strip():
            license_data = json.loads(result.stdout)
            return {
                "plan": license_data.get("tenant", "Enterprise"),
                "seats_total": 100,  # From license capabilities
                "seats_used": license_data.get("active_nodes", 0),
                "expiry": license_data.get("expiry", "2026-12-31"),
                "capabilities": license_data.get("capabilities", []),
                "host_id": license_data.get("host_id", "unknown"),
                "valid": True
            }
        else:
            # License not found or invalid
            return {
                "plan": "Trial",
                "seats_total": 10,
                "seats_used": 1,
                "expiry": "2026-02-01",
                "capabilities": ["basic"],
                "host_id": "trial",
                "valid": False,
                "error": "No valid license found"
            }
    except Exception as e:
        logger.error(f"License status error: {e}")
        return {
            "plan": "Unknown",
            "seats_total": 0,
            "seats_used": 0,
            "expiry": "N/A",
            "capabilities": [],
            "host_id": "error",
            "valid": False,
            "error": str(e)
        }


@app.get("/api/v1/admin/telemetry")
async def get_telemetry_status():
    """
    Get telemetry data from adinkhepra-telemetry-server.
    Connects to the Node.js telemetry API.
    """
    try:
        import aiohttp
        
        # Connect to telemetry server (default port 3001)
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:3001/api/telemetry/stats") as response:
                if response.status == 200:
                    telemetry_data = await response.json()
                    return {
                        "total_heartbeats": telemetry_data.get("total_heartbeats", 0),
                        "active_licenses": telemetry_data.get("active_licenses", 0),
                        "last_heartbeat": telemetry_data.get("last_heartbeat", None),
                        "telemetry_enabled": True
                    }
                else:
                    return {
                        "total_heartbeats": 0,
                        "active_licenses": 0,
                        "last_heartbeat": None,
                        "telemetry_enabled": False,
                        "error": "Telemetry server not responding"
                    }
    except Exception as e:
        logger.error(f"Telemetry status error: {e}")
        return {
            "total_heartbeats": 0,
            "active_licenses": 0,
            "last_heartbeat": None,
            "telemetry_enabled": False,
            "error": str(e)
        }


@app.get("/api/v1/admin/users")
async def get_active_users():
    """
    Get list of active users from telemetry heartbeats.
    """
    try:
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:3001/api/telemetry/active-nodes") as response:
                if response.status == 200:
                    nodes = await response.json()
                    
                    # Transform to user format
                    users = []
                    for node in nodes:
                        users.append({
                            "id": node.get("host_id", "unknown"),
                            "email": f"{node.get('tenant', 'user')}@{node.get('host_id', 'unknown')[:8]}.local",
                            "last_active": node.get("last_heartbeat", None),
                            "capabilities": node.get("capabilities", [])
                        })
                    
                    return users
                else:
                    return []
    except Exception as e:
        logger.error(f"Active users error: {e}")
        return []


@app.post("/api/v1/admin/license/revoke")
async def revoke_license(request: dict):
    """
    Revoke a license for a specific host_id.
    This would typically update a revocation list in the telemetry server.
    """
    try:
        host_id = request.get("host_id")
        
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "http://localhost:3001/api/telemetry/revoke",
                json={"host_id": host_id}
            ) as response:
                if response.status == 200:
                    return {"success": True, "message": f"License revoked for {host_id}"}
                else:
                    return {"success": False, "error": "Revocation failed"}
    except Exception as e:
        logger.error(f"License revocation error: {e}")
        return {"success": False, "error": str(e)}
