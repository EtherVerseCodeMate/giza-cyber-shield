import React, { useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Edge,
    Node,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    FileCode,
    Globe,
    Database,
    Activity,
    Search,
    Clock
} from "lucide-react";

interface BehaviorEvent {
    id: string;
    timestamp: string;
    pid: number;
    processName: string;
    type: 'FILE' | 'REGISTRY' | 'NETWORK';
    action: string;
    target: string;
    details?: string;
}

const mockEvents: BehaviorEvent[] = [
    { id: '1', timestamp: '2024-01-15T10:00:01Z', pid: 1234, processName: 'cmd.exe', type: 'FILE', action: 'CREATE', target: 'C:\\temp\\exploit.exe' },
    { id: '2', timestamp: '2024-01-15T10:00:02Z', pid: 1234, processName: 'cmd.exe', type: 'REGISTRY', action: 'SET', target: 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', details: 'Value: Exploit' },
    { id: '3', timestamp: '2024-01-15T10:00:05Z', pid: 2567, processName: 'exploit.exe', type: 'NETWORK', action: 'CONNECT', target: '45.76.12.188:443', details: 'C2 Connection' },
    { id: '4', timestamp: '2024-01-15T10:00:10Z', pid: 2567, processName: 'exploit.exe', type: 'FILE', action: 'READ', target: 'C:\\Users\\admin\\Documents\\secrets.docx' },
    { id: '5', timestamp: '2024-01-15T10:00:15Z', pid: 582, processName: 'lsass.exe', type: 'NETWORK', action: 'LISTEN', target: '0.0.0.0:445' },
];

const EventNode = ({ data }: { data: BehaviorEvent }) => {
    const getIcon = () => {
        switch (data.type) {
            case 'FILE': return <FileCode className="h-4 w-4 text-blue-400" />;
            case 'NETWORK': return <Globe className="h-4 w-4 text-green-400" />;
            case 'REGISTRY': return <Database className="h-4 w-4 text-purple-400" />;
            default: return <Activity className="h-4 w-4" />;
        }
    };

    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-slate-900 border-2 ${data.type === 'NETWORK' ? 'border-green-500/50' :
                data.type === 'FILE' ? 'border-blue-500/50' : 'border-purple-500/50'
            } min-w-[200px]`}>
            <div className="flex items-center space-x-2 mb-1">
                {getIcon()}
                <span className="text-xs font-bold text-slate-300 uppercase">{data.type}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-sm font-semibold text-white truncate">{data.action}: {data.target}</div>
            <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                <span>PID: {data.pid} ({data.processName})</span>
            </div>
        </div>
    );
};

const nodeTypes = {
    event: EventNode,
};

export const ProcessBehaviorTimeline = () => {
    const { nodes, edges } = useMemo(() => {
        const initialNodes: Node[] = [];
        const initialEdges: Edge[] = [];

        // Group events by process name to create lanes
        const processes = Array.from(new Set(mockEvents.map(e => e.processName)));

        processes.forEach((proc, procIdx) => {
            const procEvents = mockEvents.filter(e => e.processName === proc);

            // Add a label for the process lane
            initialNodes.push({
                id: `label-${proc}`,
                position: { x: -250, y: procIdx * 150 },
                data: { label: proc },
                style: {
                    background: 'rgba(0, 0, 0, 0.4)',
                    color: '#fff',
                    border: '1px solid #3b82f6',
                    borderRadius: '4px',
                    width: 200,
                    fontWeight: 'bold',
                    padding: '10px'
                },
                draggable: false,
            });

            procEvents.forEach((event, eventIdx) => {
                initialNodes.push({
                    id: event.id,
                    type: 'event',
                    position: { x: eventIdx * 300, y: procIdx * 150 },
                    data: event,
                });

                // Connect events in temporal order within the process
                if (eventIdx > 0) {
                    initialEdges.push({
                        id: `edge-${procEvents[eventIdx - 1].id}-${event.id}`,
                        source: procEvents[eventIdx - 1].id,
                        target: event.id,
                        animated: true,
                        style: { stroke: '#475569' },
                    });
                }
            });
        });

        // Cross-process correlation (e.g., cmd.exe spawned exploit.exe)
        // In a real system, we'd use PPID. Here we'll hardcode one link.
        initialEdges.push({
            id: 'correlation-1-3',
            source: '1',
            target: '3',
            label: 'Spawns',
            animated: true,
            style: { stroke: '#ef4444', strokeWidth: 2 },
            labelStyle: { fill: '#ef4444', fontWeight: 700 }
        });

        return { nodes: initialNodes, edges: initialEdges };
    }, []);

    return (
        <Card className="w-full h-[600px] bg-slate-950 border-slate-800 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-black/40">
                <div>
                    <CardTitle className="text-xl text-white flex items-center">
                        <Activity className="h-5 w-5 mr-2 text-primary" />
                        Process Behavior Timeline
                    </CardTitle>
                    <div className="text-xs text-slate-400 mt-1">
                        Temporal correlation of File I/O, Registry, and Network activity
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <FileCode className="h-3 w-3 mr-1" /> File I/O
                    </Badge>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                        <Database className="h-3 w-3 mr-1" /> Registry
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                        <Globe className="h-3 w-3 mr-1" /> Network
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0 h-full">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    className="bg-slate-950"
                >
                    <Background color="#1e293b" gap={20} />
                    <Controls />
                    <Panel position="top-right" className="bg-black/60 p-2 rounded border border-slate-700 backdrop-blur-md">
                        <div className="text-[10px] text-slate-300 font-mono">
                            [LIVE] Correlation Stream Active
                        </div>
                    </Panel>
                </ReactFlow>
            </CardContent>
        </Card>
    );
};
