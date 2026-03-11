'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { apiClient, ThreatNode } from '@/lib/api_client';
import { CustomNode } from '@/components/custom-node';

const nodeTypes = {
  custom: CustomNode,
};

export default function TopologyView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGraph = async () => {
      try {
        const data = await apiClient.getNodes();
        
        // Layout logic (simple horizontal layout)
        const miners = data.filter((n) => n.node_type === 'miner');
        const aggregators = data.filter((n) => n.node_type === 'aggregator');
        const outputs = data.filter((n) => n.node_type === 'output');

        const newNodes: any[] = [];
        const newEdges: Edge[] = [];

        // Miners (Column 0)
        miners.forEach((node, i) => {
          newNodes.push({
            id: String(node.id),
            type: 'custom',
            position: { x: 100, y: 100 + i * 150 },
            data: {
              label: node.name,
              type: node.node_type,
              status: node.is_active ? 'enabled' : 'disabled',
              details: node.config?.parser || 'N/A',
            },
          });
        });

        // Aggregators (Column 1)
        aggregators.forEach((node, i) => {
          newNodes.push({
            id: String(node.id),
            type: 'custom',
            position: { x: 500, y: 100 + i * 200 },
            data: {
              label: node.name,
              type: node.node_type,
              status: node.is_active ? 'enabled' : 'disabled',
              details: `TTL: ${node.config?.agingRules || 0}d`,
            },
          });

          // Edges from Miners to Aggregators
          if (node.config?.inputMiners) {
            node.config.inputMiners.forEach((minerId: string) => {
              newEdges.push({
                id: `e-${minerId}-${node.id}`,
                source: String(minerId),
                target: String(node.id),
                animated: true,
                style: { stroke: '#52525b', strokeWidth: 2 },
              });
            });
          }
        });

        // Outputs (Column 2)
        outputs.forEach((node, i) => {
          newNodes.push({
            id: String(node.id),
            type: 'custom',
            position: { x: 900, y: 100 + i * 150 },
            data: {
              label: node.name,
              type: node.node_type,
              status: node.is_active ? 'enabled' : 'disabled',
              details: node.config?.outputFormat || 'N/A',
            },
          });

          // Edges from Aggregators to Outputs
          if (node.config?.sourceAggregator) {
            newEdges.push({
              id: `e-${node.config.sourceAggregator}-${node.id}`,
              source: String(node.config.sourceAggregator),
              target: String(node.id),
              animated: true,
              style: { stroke: '#10b981', strokeWidth: 2 },
            });
          }
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (error: any) {
        console.error('Failed to load graph data', error);
        alert(`Errore nel caricamento della topologia: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds).map(e => ({ ...e, animated: true, style: { stroke: '#52525b', strokeWidth: 2 } }))),
    [setEdges],
  );

  if (loading) {
    return (
      <div className="h-[80vh] w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Topology View</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Visual representation of the Threat Intelligence data flow.
        </p>
      </div>
      
      <div className="w-full h-[75vh] min-h-[600px] border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 shadow-2xl">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="dark"
        >
          <Controls className="bg-zinc-900 border-zinc-800 fill-zinc-400" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.data?.type === 'miner') return '#3b82f6';
              if (n.data?.type === 'aggregator') return '#a855f7';
              if (n.data?.type === 'output') return '#10b981';
              return '#52525b';
            }}
            maskColor="rgba(9, 9, 11, 0.8)"
            className="bg-zinc-900 border-zinc-800"
          />
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#444" />
        </ReactFlow>
      </div>
    </div>
  );
}
