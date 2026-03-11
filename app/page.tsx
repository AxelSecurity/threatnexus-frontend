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
        const miners = data.filter((n) => n.type === 'miner');
        const aggregators = data.filter((n) => n.type === 'aggregator');
        const outputs = data.filter((n) => n.type === 'output');

        const newNodes: any[] = [];
        const newEdges: Edge[] = [];

        // Miners (Column 0)
        miners.forEach((node, i) => {
          newNodes.push({
            id: node.id,
            type: 'custom',
            position: { x: 100, y: 100 + i * 150 },
            data: {
              label: node.name,
              type: node.type,
              status: node.status,
              details: (node as any).parserType,
            },
          });
        });

        // Aggregators (Column 1)
        aggregators.forEach((node, i) => {
          newNodes.push({
            id: node.id,
            type: 'custom',
            position: { x: 500, y: 100 + i * 200 },
            data: {
              label: node.name,
              type: node.type,
              status: node.status,
              details: `TTL: ${(node as any).agingRules}d`,
            },
          });

          // Edges from Miners to Aggregators
          (node as any).inputMiners.forEach((minerId: string) => {
            newEdges.push({
              id: `e-${minerId}-${node.id}`,
              source: minerId,
              target: node.id,
              animated: true,
              style: { stroke: '#52525b', strokeWidth: 2 },
            });
          });
        });

        // Outputs (Column 2)
        outputs.forEach((node, i) => {
          newNodes.push({
            id: node.id,
            type: 'custom',
            position: { x: 900, y: 100 + i * 150 },
            data: {
              label: node.name,
              type: node.type,
              status: node.status,
              details: (node as any).outputFormat,
            },
          });

          // Edges from Aggregators to Outputs
          newEdges.push({
            id: `e-${(node as any).sourceAggregator}-${node.id}`,
            source: (node as any).sourceAggregator,
            target: node.id,
            animated: true,
            style: { stroke: '#10b981', strokeWidth: 2 },
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (error) {
        console.error('Failed to load graph data', error);
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
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Topology View</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Visual representation of the Threat Intelligence data flow.
        </p>
      </div>
      
      <div className="flex-1 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/50 shadow-2xl">
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
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
        </ReactFlow>
      </div>
    </div>
  );
}
