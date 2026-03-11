'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Send, AlertCircle, ExternalLink } from 'lucide-react';
import { apiClient, ThreatNode, ThreatEdge } from '@/lib/api_client';

const outputSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  sourceAggregator: z.string().min(1, 'Select a source aggregator'),
  outputFormat: z.enum(['txt', 'json', 'csv']),
  endpointPath: z.string().startsWith('/', 'Path must start with /').min(2, 'Path is required'),
  status: z.enum(['enabled', 'disabled']),
});

type OutputFormValues = z.infer<typeof outputSchema>;

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<ThreatNode[]>([]);
  const [availableAggregators, setAvailableAggregators] = useState<ThreatNode[]>([]);
  const [edges, setEdges] = useState<ThreatEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      status: 'enabled',
      outputFormat: 'txt',
      endpointPath: '/feeds/',
    },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [nodes, allEdges] = await Promise.all([
        apiClient.getNodes(),
        apiClient.getEdges()
      ]);
      setOutputs(nodes.filter((n) => n.node_type === 'output'));
      setAvailableAggregators(nodes.filter((n) => n.node_type === 'aggregator'));
      setEdges(allEdges);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [nodes, allEdges] = await Promise.all([
          apiClient.getNodes(),
          apiClient.getEdges()
        ]);
        if (mounted) {
          setOutputs(nodes.filter((n) => n.node_type === 'output'));
          setAvailableAggregators(nodes.filter((n) => n.node_type === 'aggregator'));
          setEdges(allEdges);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  const onSubmit = async (data: OutputFormValues) => {
    try {
      const configPayload = {
        outputFormat: data.outputFormat,
        endpointPath: data.endpointPath,
      };

      const payload = {
        name: data.name,
        node_type: 'output' as const,
        is_active: data.status === 'enabled',
        config: configPayload,
      };

      if (editingId) {
        await apiClient.updateNode(editingId, payload);
        
        // Update edge if necessary
        const existingEdge = edges.find(e => e.target_id === editingId);
        if (existingEdge && existingEdge.source_id !== data.sourceAggregator) {
          if (existingEdge.id) {
            await apiClient.deleteEdge(existingEdge.id);
          }
          await apiClient.createEdge({
            source_id: data.sourceAggregator,
            target_id: editingId
          });
        } else if (!existingEdge) {
          await apiClient.createEdge({
            source_id: data.sourceAggregator,
            target_id: editingId
          });
        }
      } else {
        const newNode = await apiClient.createNode(payload as any);
        if (newNode.id) {
          await apiClient.createEdge({
            source_id: data.sourceAggregator,
            target_id: newNode.id
          });
        }
      }
      await loadData();
      closeForm();
    } catch (error: any) {
      console.error('Failed to save output', error);
      alert(`Errore: ${error.message}`);
    }
  };

  const handleEdit = (output: ThreatNode) => {
    setEditingId(output.id || null);
    setValue('name', output.name);
    
    const existingEdge = edges.find(e => e.target_id === output.id);
    setValue('sourceAggregator', existingEdge ? existingEdge.source_id : '');
    
    setValue('outputFormat', output.config?.outputFormat || 'txt');
    setValue('endpointPath', output.config?.endpointPath || '/feeds/');
    setValue('status', output.is_active ? 'enabled' : 'disabled');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this output feed?')) {
      await apiClient.deleteNode(id);
      await loadData();
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    reset();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center">
            <Send className="w-6 h-6 mr-3 text-emerald-500" />
            Outputs Configuration
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage threat intelligence feeds for Firewalls and SIEMs.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Output Feed
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? 'Edit Output Feed' : 'Create New Output Feed'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Output Name</label>
                <input
                  {...register('name')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., Palo Alto EDL"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Source Aggregator</label>
                <select
                  {...register('sourceAggregator')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">Select an aggregator...</option>
                  {availableAggregators.map((agg) => (
                    <option key={agg.id} value={agg.id}>
                      {agg.name}
                    </option>
                  ))}
                </select>
                {errors.sourceAggregator && <p className="text-red-400 text-xs mt-1">{errors.sourceAggregator.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Output Format</label>
                <select
                  {...register('outputFormat')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="txt">TXT (Palo Alto EDL)</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Endpoint Path</label>
                <input
                  {...register('endpointPath')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="/feeds/high-confidence-ips/txt"
                />
                {errors.endpointPath && <p className="text-red-400 text-xs mt-1">{errors.endpointPath.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                <select
                  {...register('status')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800 mt-6">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Output Feed'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : outputs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-zinc-300">No Output Feeds Configured</h3>
          <p className="text-zinc-500 text-sm mt-1">Create an output feed to share threat intelligence with external systems.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Format</th>
                <th className="px-6 py-3 font-medium">Endpoint</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {outputs.map((output) => {
                const edge = edges.find(e => e.target_id === output.id);
                const sourceAgg = availableAggregators.find(a => a.id === edge?.source_id);
                return (
                  <tr key={output.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-200">{output.name}</td>
                    <td className="px-6 py-4 text-zinc-400">
                      {sourceAgg ? sourceAgg.name : <span className="text-red-400">Non collegato</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono uppercase">
                        {output.config?.outputFormat}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-zinc-400 font-mono text-xs">
                        <span className="truncate max-w-[200px]">{output.config?.endpointPath}</span>
                        <ExternalLink className="w-3 h-3 ml-2 cursor-pointer hover:text-emerald-400" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        output.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          output.is_active ? 'bg-emerald-400' : 'bg-red-400'
                        }`}></span>
                        {output.is_active ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(output)}
                        className="p-2 text-zinc-400 hover:text-blue-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => output.id && handleDelete(output.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors ml-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
