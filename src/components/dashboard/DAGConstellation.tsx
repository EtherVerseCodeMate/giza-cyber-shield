import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface DAGNode {
  id: string;
  action: string;
  symbol: string;
  time: string;
  parents?: string[];
}

interface DAGConstellationProps {
  nodes: DAGNode[];
  veilMode?: boolean;
}

// Khepra Lattice Alphabet for "Veil" mode
const KHEPRA_ALPHABET: Record<string, string> = {
  'A': 'G', 'B': 'Y', 'C': 'E', 'D': 'N', 'E': 'A', 'F': 'M', 'G': 'K',
  'H': 'H', 'I': 'P', 'J': 'R', 'K': 'S', 'L': 'U', 'M': 'T', 'N': 'I',
  'O': 'L', 'P': 'O', 'Q': 'G', 'R': 'Y', 'S': 'E', 'T': 'N', 'U': 'A',
  'V': 'M', 'W': 'K', 'X': 'H', 'Y': 'P', 'Z': 'R', '0': '᚛', '1': '᚜',
  '2': 'ᚠ', '3': 'ᚢ', '4': 'ᚦ', '5': 'ᚨ', '6': 'ᚱ', '7': 'ᚲ', '8': 'ᚷ', '9': 'ᚹ'
};

const veilText = (text: string): string => {
  return text.split('').map(char => {
    const upper = char.toUpperCase();
    return KHEPRA_ALPHABET[upper] || char;
  }).join('');
};

// Adinkra symbol configs
const ADINKRA_SYMBOLS: Record<string, { icon: string; color: string }> = {
  Eban: { icon: '◈', color: '#00F0FF' },
  Fawohodie: { icon: '⬡', color: '#D4AF37' },
  Nkyinkyim: { icon: '⧗', color: '#00F0FF' },
};

const DAGConstellation = ({ nodes: dagNodes, veilMode = false }: DAGConstellationProps) => {
  const displayText = useCallback((text: string) => veilMode ? veilText(text) : text, [veilMode]);

  // Convert DAG nodes to ReactFlow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    const nodeMap = new Map<string, number>();
    
    // Calculate positions - arrange in a grid/constellation pattern
    const cols = Math.max(3, Math.ceil(Math.sqrt(dagNodes.length)));
    
    const flowNodes: Node[] = dagNodes.map((node, index) => {
      nodeMap.set(node.id, index);
      const col = index % cols;
      const row = Math.floor(index / cols);
      const symbol = ADINKRA_SYMBOLS[node.symbol] || { icon: '●', color: '#00F0FF' };
      
      return {
        id: node.id,
        position: { 
          x: 100 + col * 200 + (row % 2) * 50, // Stagger rows
          y: 80 + row * 140 
        },
        data: { 
          label: (
            <div className="text-center">
              <div className="text-2xl mb-1" style={{ color: symbol.color }}>
                {symbol.icon}
              </div>
              <div className="text-xs font-orbitron text-primary truncate max-w-24">
                {displayText(node.symbol)}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground truncate max-w-28">
                {displayText(node.action)}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/60 mt-1">
                {displayText(node.id.substring(0, 8))}
              </div>
            </div>
          )
        },
        style: {
          background: 'rgba(0, 240, 255, 0.05)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          borderRadius: '12px',
          padding: '12px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
        },
        type: 'default',
      };
    });

    const flowEdges: Edge[] = [];
    dagNodes.forEach((node) => {
      if (node.parents) {
        node.parents.forEach((parentId) => {
          if (nodeMap.has(parentId)) {
            flowEdges.push({
              id: `${parentId}-${node.id}`,
              source: parentId,
              target: node.id,
              type: 'smoothstep',
              animated: true,
              style: { 
                stroke: '#00F0FF', 
                strokeWidth: 2,
                opacity: 0.6,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#00F0FF',
                width: 15,
                height: 15,
              },
            });
          }
        });
      }
    });

    return { flowNodes, flowEdges };
  }, [dagNodes, displayText]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes when dagNodes change
  useMemo(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  if (dagNodes.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center glass-panel border-primary/20">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-4 opacity-30">⧗</div>
          <p className="font-rajdhani">{displayText('No nodes in constellation')}</p>
          <p className="text-xs font-mono mt-1">{displayText('Synchronize DAG to populate')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[400px] rounded-lg overflow-hidden border border-primary/20" style={{ background: '#050505' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="rgba(0, 240, 255, 0.15)" 
        />
        <Controls 
          className="!bg-background/80 !border-primary/30 !shadow-lg"
          showInteractive={false}
        />
        <MiniMap 
          nodeColor={() => '#00F0FF'}
          maskColor="rgba(5, 5, 5, 0.8)"
          className="!bg-background/80 !border-primary/30"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
};

export default DAGConstellation;
