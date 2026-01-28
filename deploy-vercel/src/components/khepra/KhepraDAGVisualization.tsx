import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKhepraAPI, DAGNode } from '@/hooks/useKhepraAPI';
import { useKhepraDAGUpdates } from '@/hooks/useKhepraWebSocket';
import {
  Network,
  RefreshCw,
  Wifi,
  WifiOff,
  Shield,
  Bug,
  CheckCircle,
  FileText,
  Lock,
} from 'lucide-react';

interface KhepraDAGVisualizationProps {
  deploymentUrl: string;
  apiKey: string;
  height?: number;
}

// Custom node component
const nodeColors: Record<string, string> = {
  scan: '#3b82f6',         // blue
  finding: '#ef4444',      // red
  remediation: '#22c55e',  // green
  attestation: '#8b5cf6',  // purple
  ert: '#f59e0b',          // amber
  genesis: '#06b6d4',      // cyan
};

const nodeIcons: Record<string, React.ReactNode> = {
  scan: <Shield className="h-4 w-4" />,
  finding: <Bug className="h-4 w-4" />,
  remediation: <CheckCircle className="h-4 w-4" />,
  attestation: <FileText className="h-4 w-4" />,
  ert: <Lock className="h-4 w-4" />,
  genesis: <Network className="h-4 w-4" />,
};

function transformDAGToFlow(dagNodes: DAGNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map<string, DAGNode>();

  // Build node map
  dagNodes.forEach((node) => {
    nodeMap.set(node.node_id, node);
  });

  // Calculate positions using a simple layout algorithm
  const levels = new Map<string, number>();
  const processedNodes = new Set<string>();

  function calculateLevel(nodeId: string): number {
    if (levels.has(nodeId)) return levels.get(nodeId)!;

    const node = nodeMap.get(nodeId);
    if (!node || node.parents.length === 0) {
      levels.set(nodeId, 0);
      return 0;
    }

    const parentLevels = node.parents
      .map((parentId) => calculateLevel(parentId))
      .filter((l) => l >= 0);

    const level = parentLevels.length > 0 ? Math.max(...parentLevels) + 1 : 0;
    levels.set(nodeId, level);
    return level;
  }

  // Calculate levels for all nodes
  dagNodes.forEach((node) => calculateLevel(node.node_id));

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(nodeId);
  });

  // Create nodes with positions
  dagNodes.forEach((dagNode) => {
    const level = levels.get(dagNode.node_id) || 0;
    const levelNodes = levelGroups.get(level) || [];
    const indexInLevel = levelNodes.indexOf(dagNode.node_id);
    const totalInLevel = levelNodes.length;

    const x = 200 + level * 250;
    const y = 100 + indexInLevel * 100 - ((totalInLevel - 1) * 50);

    nodes.push({
      id: dagNode.node_id,
      type: 'default',
      position: { x, y },
      data: {
        label: (
          <div className="flex flex-col items-center gap-1 p-2">
            <div className="flex items-center gap-1">
              {nodeIcons[dagNode.type] || <Network className="h-4 w-4" />}
              <span className="text-xs font-medium capitalize">{dagNode.type}</span>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              {dagNode.node_id.slice(0, 8)}...
            </div>
            {dagNode.verified && (
              <Badge variant="outline" className="text-xs px-1 py-0 text-green-600 border-green-600">
                Verified
              </Badge>
            )}
          </div>
        ),
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: nodeColors[dagNode.type] || '#6b7280',
        color: 'white',
        borderRadius: '8px',
        padding: '4px',
        minWidth: '120px',
      },
    });

    // Create edges from parents
    dagNode.parents.forEach((parentId) => {
      if (nodeMap.has(parentId)) {
        edges.push({
          id: `${parentId}-${dagNode.node_id}`,
          source: parentId,
          target: dagNode.node_id,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6b7280',
          },
          style: {
            stroke: '#6b7280',
            strokeWidth: 2,
          },
        });
      }
    });
  });

  return { nodes, edges };
}

export function KhepraDAGVisualization({
  deploymentUrl,
  apiKey,
  height = 500,
}: KhepraDAGVisualizationProps) {
  const { dag } = useKhepraAPI(deploymentUrl, apiKey);
  const { isConnected, dagUpdates } = useKhepraDAGUpdates(deploymentUrl);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!dag.data?.nodes) {
      return { initialNodes: [], initialEdges: [] };
    }
    const { nodes, edges } = transformDAGToFlow(dag.data.nodes);
    return { initialNodes: nodes, initialEdges: edges };
  }, [dag.data?.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when DAG data changes
  useMemo(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleRefresh = useCallback(() => {
    dag.refetch();
  }, [dag]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Living Trust Constellation
            </CardTitle>
            <CardDescription>
              Immutable DAG of security events with PQC signatures
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Bar */}
        {dag.data && (
          <div className="flex gap-4 mb-4 text-sm">
            <div className="bg-muted rounded-lg px-3 py-1">
              <span className="text-muted-foreground">Nodes:</span>{' '}
              <span className="font-medium">{dag.data.total_nodes}</span>
            </div>
            <div className="bg-muted rounded-lg px-3 py-1">
              <span className="text-muted-foreground">Root Nodes:</span>{' '}
              <span className="font-medium">{dag.data.root_nodes.length}</span>
            </div>
            <div className="bg-muted rounded-lg px-3 py-1">
              <span className="text-muted-foreground">Live Updates:</span>{' '}
              <span className="font-medium">{dagUpdates.length}</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div
              key={type}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {nodeIcons[type]}
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>

        {/* Flow Diagram */}
        <div
          className="border rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100"
          style={{ height }}
        >
          {dag.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">
                Loading constellation...
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Network className="h-12 w-12 mb-2 opacity-50" />
              <p>No DAG nodes available</p>
              <p className="text-sm">Trigger a scan to start building the constellation</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const type = node.id.includes('scan')
                    ? 'scan'
                    : node.id.includes('finding')
                    ? 'finding'
                    : 'default';
                  return nodeColors[type] || '#6b7280';
                }}
                style={{ backgroundColor: '#f3f4f6' }}
              />
            </ReactFlow>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
