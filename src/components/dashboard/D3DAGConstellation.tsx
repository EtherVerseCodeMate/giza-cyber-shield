import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

interface DAGNode {
    id: string;
    action: string;
    symbol: string;
    time: string;
    parents?: string[];
}

interface D3DAGConstellationProps {
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

const D3DAGConstellation: React.FC<D3DAGConstellationProps> = ({ nodes: rawNodes, veilMode = false }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    // Keep simulation ref to update it rather than recreate
    const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

    // Helper for veil text
    const displayText = (text: string) => veilMode ? veilText(text) : text;

    // Adinkra Colors map (matching the dashboard)
    const getNodeColor = (symbol: string) => {
        switch (symbol) {
            case 'OwoForoAdobe': return '#FF4444'; // Red/Destructive
            case 'Fawohodie': return '#D4AF37'; // Gold
            default: return '#00ff41'; // Hacker Green (Default/Eban/Nkyinkyim)
        }
    };

    useEffect(() => {
        if (!svgRef.current) return;

        const width = svgRef.current.clientWidth;
        const height = 400; // Fixed height wrapper

        // Clear previous if any (though we try to update live)
        // Actually for D3 + React, a simple wipe and redraw is safer for the "safe integration" requirement
        // unless we need high perf updates. Given the low node count, wipe is fine initially,
        // but force simulation implies state. Let's try to maintain state.

        const svg = d3.select(svgRef.current);
        svg.attr("width", width).attr("height", height);

        // Group for zooming/panning
        let g = svg.select<SVGGElement>(".main-group");
        if (g.empty()) {
            g = svg.append("g").attr("class", "main-group");

            // Zoom behavior
            const zoom = d3.zoom<SVGSVGElement, unknown>()
                .scaleExtent([0.1, 4])
                .on("zoom", (event) => g.attr("transform", event.transform));
            svg.call(zoom);
        }

        // Process Data
        // D3 modifies node objects with x, y, vx, vy. We need to preserve these across renders
        // if objects identity matches.
        // map rawNodes to d3Nodes. Using ID as key.

        // We construct the graph links based on 'parents'
        const links: any[] = [];
        rawNodes.forEach(n => {
            if (n.parents) {
                n.parents.forEach(pId => {
                    // Only add link if parent exists in current set
                    if (rawNodes.find(rn => rn.id === pId)) {
                        links.push({ source: pId, target: n.id });
                    }
                });
            }
        });

        // Create Simulation if doesn't exist
        if (!simulationRef.current) {
            simulationRef.current = d3.forceSimulation()
                .force("charge", d3.forceManyBody().strength(-100))
                .force("link", d3.forceLink().id((d: any) => d.id).distance(60))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collide", d3.forceCollide(20)); // Prevent overlap
        }

        const simulation = simulationRef.current;

        // Update Simulation Data
        // We need to merge new nodes with existing simulation nodes to preserve position
        const oldNodes = new Map(simulation.nodes().map((d: any) => [d.id, d]));
        const newSimNodes = rawNodes.map(n => {
            const old = oldNodes.get(n.id);
            if (old) {
                return Object.assign(old, n); // Update data, keep x/y
            }
            return { ...n, x: width / 2 + (Math.random() - 0.5) * 50, y: height / 2 + (Math.random() - 0.5) * 50 };
        });

        simulation.nodes(newSimNodes);
        (simulation.force("link") as d3.ForceLink<any, any>).links(links);
        simulation.alpha(1).restart();

        // RENDER LOP
        // Edges
        let link = g.selectAll<SVGLineElement, any>(".link")
            .data(links, (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}`);

        link.exit().remove();
        const linkEnter = link.enter().append("line")
            .attr("class", "link")
            .attr("stroke", "#004400")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 1);
        link = linkEnter.merge(link);

        // Nodes
        let node = g.selectAll<SVGGElement, any>(".node-group")
            .data(newSimNodes, (d: any) => d.id);

        node.exit().transition().duration(500).attr("opacity", 0).remove();

        const nodeEnter = node.enter().append("g")
            .attr("class", "node-group")
            .call(d3.drag<SVGGElement, any>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        // Circle
        nodeEnter.append("circle")
            .attr("r", 0) // animate in
            .attr("stroke", "#00ff41")
            .attr("stroke-width", 1.5)
            .transition().duration(500)
            .attr("r", 6);

        // Label (Symbol)
        nodeEnter.append("text")
            .attr("dy", -10)
            .attr("text-anchor", "middle")
            .attr("fill", "#00ff41")
            .attr("font-size", "10px")
            .attr("font-family", "monospace")
            .attr("opacity", 0.8)
            .text((d: any) => d.symbol ? d.symbol.substring(0, 1) : ""); // Just first char as icon placeholder if no svg

        node = nodeEnter.merge(node);

        // Update Visuals based on Props (Color/Text)
        node.select("circle")
            .attr("fill", (d: any) => {
                // "Secure" nodes (most) are black with green stroke. 
                // "Infected" or "Warning" nodes might be filled.
                return "#050505";
            })
            .attr("stroke", (d: any) => getNodeColor(d.symbol));

        node.select("text")
            .text((d: any) => displayText(d.symbol))
            .attr("fill", (d: any) => getNodeColor(d.symbol));

        // Simulation Tick
        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node
                .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        // Cleanup
        return () => {
            simulation.stop();
        };

    }, [rawNodes, veilMode]); // Re-run when nodes or mode changes

    return (
        <div className="w-full h-[400px] overflow-hidden rounded-lg border border-primary/20 bg-[#050505] relative group">
            <svg
                ref={svgRef}
                style={{ width: '100%', height: '100%' }}
            />
            {/* Overlay to match the Cyberpunk look */}
            <div className="absolute top-4 left-4 pointer-events-none font-mono text-xs space-y-1 text-[#00ff41] opacity-70">
                <div>{'>'} KHEPRA_LATTICE_VISUALIZER_V1</div>
                <div>{'>'} NODES: {rawNodes.length}</div>
                <div className="animate-pulse">{'>'} STATUS: {rawNodes.length > 0 ? 'SYNCED' : 'AWAITING_SIGNAL'}</div>
            </div>
        </div>
    );
};

export default D3DAGConstellation;
