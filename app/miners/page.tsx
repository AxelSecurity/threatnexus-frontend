'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Database, AlertCircle } from 'lucide-react';
import { apiClient, MinerNode } from '@/lib/api_client';

const minerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  sourceUrl: z.string().url('Must be a valid URL'),
  parserType: z.enum(['csv', 'json', 'regex', 'stix']),
  pollingInterval: z.string().min(1, 'Cron expression is required'),
  status: z.enum(['enabled', 'disabled']),
});

type MinerFormValues = z.infer<typeof minerSchema>;

export default function MinersPage() {
  const [miners, setMiners] = useState<MinerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MinerFormValues>({
    resolver: zodResolver(minerSchema),
    defaultValues: {
      status: 'enabled',
      parserType: 'json',
    },
  });

  const loadMiners = async () => {
    setLoading(true);
    try {
      const nodes = await apiClient.getNodes();
      setMiners(nodes.filter((n) => n.type === 'miner') as MinerNode[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchMiners = async () => {
      setLoading(true);
      try {
        const nodes = await apiClient.getNodes();
        if (mounted) {
          setMiners(nodes.filter((n) => n.type === 'miner') as MinerNode[]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMiners();
    return () => { mounted = false; };
  }, []);

  const onSubmit = async (data: MinerFormValues) => {
    try {
      if (editingId) {
        await apiClient.updateNode(editingId, data);
      } else {
        await apiClient.createNode({ ...data, type: 'miner' });
      }
      await loadMiners();
      closeForm();
    } catch (error) {
      console.error('Failed to save miner', error);
    }
  };

  const handleEdit = (miner: MinerNode) => {
    setEditingId(miner.id);
    setValue('name', miner.name);
    setValue('sourceUrl', miner.sourceUrl);
    setValue('parserType', miner.parserType);
    setValue('pollingInterval', miner.pollingInterval);
    setValue('status', miner.status);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this miner?')) {
      await apiClient.deleteNode(id);
      await loadMiners();
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
            <Database className="w-6 h-6 mr-3 text-blue-500" />
            Miners Configuration
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage Threat Intelligence input sources and parsers.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Miner
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? 'Edit Miner' : 'Create New Miner'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Miner Name</label>
                <input
                  {...register('name')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., AlienVault OTX"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Source URL</label>
                <input
                  {...register('sourceUrl')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="https://..."
                />
                {errors.sourceUrl && <p className="text-red-400 text-xs mt-1">{errors.sourceUrl.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Parser Type</label>
                <select
                  {...register('parserType')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="regex">Regex</option>
                  <option value="stix">STIX/TAXII</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Polling Interval (Cron)</label>
                <input
                  {...register('pollingInterval')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="0 */2 * * *"
                />
                {errors.pollingInterval && <p className="text-red-400 text-xs mt-1">{errors.pollingInterval.message}</p>}
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
                {isSubmitting ? 'Saving...' : 'Save Miner'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : miners.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-zinc-300">No Miners Configured</h3>
          <p className="text-zinc-500 text-sm mt-1">Create your first miner to start ingesting threat data.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Parser</th>
                <th className="px-6 py-3 font-medium">Schedule</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {miners.map((miner) => (
                <tr key={miner.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-200">{miner.name}</td>
                  <td className="px-6 py-4 text-zinc-400 truncate max-w-[200px]" title={miner.sourceUrl}>
                    {miner.sourceUrl}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono uppercase">
                      {miner.parserType}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">{miner.pollingInterval}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      miner.status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        miner.status === 'enabled' ? 'bg-emerald-400' : 'bg-red-400'
                      }`}></span>
                      {miner.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(miner)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(miner.id)}
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
