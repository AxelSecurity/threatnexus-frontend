'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Node,
  BackgroundVariant,
  applyEdgeChanges,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { apiClient, ThreatNode, ThreatEdge } from '@/lib/api_client';
import { CustomNode } from '@/components/custom-node';
import { CustomEdge } from '@/components/custom-edge';

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

export default function TopologyView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const onDeleteEdge = useCallback(async (edgeId: string) => {
    try {
      if (!edgeId.startsWith('reactflow')) {
        await apiClient.deleteEdge(edgeId);
      }
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    } catch (error: any) {
      console.error(`Failed to delete edge ${edgeId}`, error);
      alert(`Errore nell'eliminazione del collegamento: ${error.message}`);
    }
  }, [setEdges]);

  const loadGraph = useCallback(async () => {
    try {
      const [data, dbEdges] = await Promise.all([
        apiClient.getNodes(),
        apiClient.getEdges()
      ]);
      
      // Layout logic (simple horizontal layout)
      const miners = data.filter((n) => n.node_type === 'miner' || n.node_type === 'whitelist');
      const aggregators = data.filter((n) => n.node_type === 'aggregator');
      const outputs = data.filter((n) => n.node_type === 'output');

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      // Miners & Whitelists (Column 0)
      miners.forEach((node, i) => {
        newNodes.push({
          id: String(node.id),
          type: 'custom',
          position: { x: 100, y: 100 + i * 150 },
          data: {
            label: node.name,
            type: node.node_type,
            status: node.is_active ? 'enabled' : 'disabled',
            details: node.node_type === 'whitelist' ? (node.config?.ioc_type || 'N/A') : (node.config?.parser || 'N/A'),
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
      });

      // Build edges from DB
      dbEdges.forEach((edge) => {
        newEdges.push({
          id: String(edge.id), // Use the DB edge ID
          source: String(edge.source_id),
          target: String(edge.target_id),
          type: 'custom',
          animated: true,
          style: { stroke: '#52525b', strokeWidth: 2 },
          data: { onDelete: onDeleteEdge },
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (error: any) {
      console.error('Failed to load graph data', error);
      alert(`Errore nel caricamento della topologia: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, onDeleteEdge]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const onConnect = useCallback(
    async (params: Connection) => {
      const sourceNode = nodesRef.current.find(n => n.id === params.source);
      const targetNode = nodesRef.current.find(n => n.id === params.target);

      if (!sourceNode || !targetNode) return;

      const sourceType = sourceNode.data.type;
      const targetType = targetNode.data.type;

      // Validation: Miner/Whitelist -> Aggregator -> Output
      let isValid = false;
      if ((sourceType === 'miner' || sourceType === 'whitelist') && targetType === 'aggregator') isValid = true;
      if (sourceType === 'aggregator' && targetType === 'output') isValid = true;

      if (!isValid) {
        alert(`Collegamento non valido: non puoi collegare un ${sourceType} a un ${targetType}. I flussi consentiti sono Miner/Whitelist -> Aggregator e Aggregator -> Output.`);
        return;
      }

      try {
        const newEdge = await apiClient.createEdge({
          source_id: params.source,
          target_id: params.target
        });

        setEdges((eds) => [
          ...eds,
          {
            id: String(newEdge.id),
            source: params.source,
            target: params.target,
            sourceHandle: params.sourceHandle,
            targetHandle: params.targetHandle,
            type: 'custom',
            animated: true,
            style: { stroke: '#52525b', strokeWidth: 2 },
            data: { onDelete: onDeleteEdge },
          }
        ]);
      } catch (error: any) {
        console.error('Failed to create edge', error);
        alert(`Errore nella creazione del collegamento: ${error.message}`);
      }
    },
    [setEdges, onDeleteEdge]
  );

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        try {
          // Assuming edge.id is the DB ID
          if (edge.id && !edge.id.startsWith('reactflow')) {
            await apiClient.deleteEdge(edge.id);
          }
        } catch (error: any) {
          console.error(`Failed to delete edge ${edge.id}`, error);
          alert(`Errore nell'eliminazione del collegamento: ${error.message}`);
        }
      }
    },
    []
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
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="dark"
        >
          <Controls className="bg-zinc-900 border-zinc-800 fill-zinc-400" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.data?.type === 'miner') return '#3b82f6';
              if (n.data?.type === 'whitelist') return '#eab308';
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
