'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, GitMerge, AlertCircle } from 'lucide-react';
import { apiClient, AggregatorNode, MinerNode } from '@/lib/api_client';

const aggregatorSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  inputMiners: z.array(z.string()).min(1, 'Select at least one input miner'),
  agingRules: z.number().min(1, 'TTL must be at least 1 day'),
  confidenceOverride: z.number().min(0).max(100),
  whitelistDomains: z.string(),
  status: z.enum(['enabled', 'disabled']),
});

type AggregatorFormValues = z.infer<typeof aggregatorSchema>;

export default function AggregatorsPage() {
  const [aggregators, setAggregators] = useState<AggregatorNode[]>([]);
  const [availableMiners, setAvailableMiners] = useState<MinerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AggregatorFormValues>({
    resolver: zodResolver(aggregatorSchema),
    defaultValues: {
      status: 'enabled',
      agingRules: 30,
      confidenceOverride: 50,
      inputMiners: [],
      whitelistDomains: '',
    },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const nodes = await apiClient.getNodes();
      setAggregators(nodes.filter((n) => n.type === 'aggregator') as AggregatorNode[]);
      setAvailableMiners(nodes.filter((n) => n.type === 'miner') as MinerNode[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const nodes = await apiClient.getNodes();
        if (mounted) {
          setAggregators(nodes.filter((n) => n.type === 'aggregator') as AggregatorNode[]);
          setAvailableMiners(nodes.filter((n) => n.type === 'miner') as MinerNode[]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  const onSubmit = async (data: AggregatorFormValues) => {
    try {
      const payload = {
        ...data,
        whitelistDomains: data.whitelistDomains.split(',').map(s => s.trim()).filter(Boolean),
      };
      
      if (editingId) {
        await apiClient.updateNode(editingId, payload);
      } else {
        await apiClient.createNode({ ...payload, type: 'aggregator' });
      }
      await loadData();
      closeForm();
    } catch (error) {
      console.error('Failed to save aggregator', error);
    }
  };

  const handleEdit = (aggregator: AggregatorNode) => {
    setEditingId(aggregator.id);
    setValue('name', aggregator.name);
    setValue('inputMiners', aggregator.inputMiners);
    setValue('agingRules', aggregator.agingRules);
    setValue('confidenceOverride', aggregator.confidenceOverride);
    setValue('whitelistDomains', aggregator.whitelistDomains.join(', '));
    setValue('status', aggregator.status);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this aggregator?')) {
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
            <GitMerge className="w-6 h-6 mr-3 text-purple-500" />
            Aggregators Configuration
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage data processing, deduplication, and aging rules.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Aggregator
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? 'Edit Aggregator' : 'Create New Aggregator'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Aggregator Name</label>
                <input
                  {...register('name')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., High Confidence IPs"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Input Miners</label>
                <select
                  multiple
                  {...register('inputMiners')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[80px]"
                >
                  {availableMiners.map((miner) => (
                    <option key={miner.id} value={miner.id}>
                      {miner.name}
                    </option>
                  ))}
                </select>
                {errors.inputMiners && <p className="text-red-400 text-xs mt-1">{errors.inputMiners.message}</p>}
                <p className="text-xs text-zinc-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Aging Rules (TTL in days)</label>
                <input
                  type="number"
                  {...register('agingRules', { valueAsNumber: true })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {errors.agingRules && <p className="text-red-400 text-xs mt-1">{errors.agingRules.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Confidence Override (0-100)</label>
                <input
                  type="number"
                  {...register('confidenceOverride', { valueAsNumber: true })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {errors.confidenceOverride && <p className="text-red-400 text-xs mt-1">{errors.confidenceOverride.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-400 mb-1">Whitelist Domains (comma separated)</label>
                <input
                  {...register('whitelistDomains')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., microsoft.com, google.com"
                />
                {errors.whitelistDomains && <p className="text-red-400 text-xs mt-1">{errors.whitelistDomains.message}</p>}
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
                {isSubmitting ? 'Saving...' : 'Save Aggregator'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : aggregators.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-zinc-300">No Aggregators Configured</h3>
          <p className="text-zinc-500 text-sm mt-1">Create an aggregator to process and deduplicate threat feeds.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Inputs</th>
                <th className="px-6 py-3 font-medium">TTL</th>
                <th className="px-6 py-3 font-medium">Confidence</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {aggregators.map((agg) => (
                <tr key={agg.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-200">{agg.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono">
                      {agg.inputMiners.length} Miners
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">{agg.agingRules}d</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full mr-2 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${agg.confidenceOverride}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-zinc-400">{agg.confidenceOverride}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      agg.status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        agg.status === 'enabled' ? 'bg-emerald-400' : 'bg-red-400'
                      }`}></span>
                      {agg.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(agg)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(agg.id)}
                      className="p-2 text-zinc-400 hover:text-red-400 transition-colors ml-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
