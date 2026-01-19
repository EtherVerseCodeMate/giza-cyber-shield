"""
WebSocket endpoint for real-time DAG updates.
Streams DAG changes from the Go daemon to connected clients.
"""
import asyncio
import json
import subprocess
from fastapi import WebSocket, WebSocketDisconnect
from typing import List

# Store active WebSocket connections
active_connections: List[WebSocket] = []

@app.websocket("/ws/dag")
async def dag_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time DAG updates.
    Clients connect and receive live updates when the DAG changes.
    """
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"WebSocket client connected. Total connections: {len(active_connections)}")
    
    try:
        # Send initial DAG state
        initial_dag = await get_current_dag()
        await websocket.send_json(initial_dag)
        
        # Keep connection alive and send updates
        while True:
            # Poll for DAG changes every 5 seconds
            await asyncio.sleep(5)
            
            try:
                dag_update = await get_current_dag()
                await websocket.send_json(dag_update)
            except Exception as e:
                logger.error(f"Error sending DAG update: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        logger.info(f"WebSocket cleaned up. Remaining connections: {len(active_connections)}")


async def get_current_dag() -> dict:
    """Fetch current DAG state from Go CLI."""
    try:
        result = subprocess.run(
            ["khepra", "engine", "dag", "export", "--json"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
        else:
            return {
                "nodes": [],
                "edges": [],
                "stats": {"nodes": 0, "critical": 0},
                "timestamp": asyncio.get_event_loop().time()
            }
    except Exception as e:
        logger.error(f"Failed to fetch DAG: {e}")
        return {
            "nodes": [],
            "edges": [],
            "stats": {"nodes": 0, "critical": 0, "error": str(e)},
            "timestamp": asyncio.get_event_loop().time()
        }


async def broadcast_dag_update(dag_data: dict):
    """Broadcast DAG update to all connected clients."""
    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_json(dag_data)
        except Exception as e:
            logger.error(f"Failed to send to client: {e}")
            disconnected.append(connection)
    
    # Clean up disconnected clients
    for conn in disconnected:
        if conn in active_connections:
            active_connections.remove(conn)
