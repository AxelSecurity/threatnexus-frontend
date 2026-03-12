'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, GitMerge, AlertCircle, Eye, X } from 'lucide-react';
import { apiClient, ThreatNode, ThreatEdge } from '@/lib/api_client';

const aggregatorSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  inputMiners: z.array(z.string()).min(1, 'Select at least one input miner'),
  iocTypes: z.array(z.string()),
  daysToLive: z.number().min(1, 'TTL must be at least 1 day').max(365, 'TTL cannot exceed 365 days'),
  confidenceOverride: z.number().min(0).max(100).optional().nullable(),
  status: z.enum(['enabled', 'disabled']),
});

type AggregatorFormValues = z.infer<typeof aggregatorSchema>;

export default function AggregatorsPage() {
  const [aggregators, setAggregators] = useState<ThreatNode[]>([]);
  const [availableMiners, setAvailableMiners] = useState<ThreatNode[]>([]);
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
  } = useForm<AggregatorFormValues>({
    resolver: zodResolver(aggregatorSchema),
    defaultValues: {
      status: 'enabled',
      daysToLive: 30,
      confidenceOverride: null,
      inputMiners: [],
      iocTypes: [],
    },
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAggregator, setSelectedAggregator] = useState<ThreatNode | null>(null);
  const [aggregatorLogs, setAggregatorLogs] = useState<any[]>([]);
  const [aggregatorIocs, setAggregatorIocs] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nodes, allEdges] = await Promise.all([
        apiClient.getNodes(),
        apiClient.getEdges()
      ]);
      setAggregators(nodes.filter((n) => n.node_type === 'aggregator'));
      setAvailableMiners(nodes.filter((n) => n.node_type === 'miner' || n.node_type === 'whitelist'));
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
          setAggregators(nodes.filter((n) => n.node_type === 'aggregator'));
          setAvailableMiners(nodes.filter((n) => n.node_type === 'miner' || n.node_type === 'whitelist'));
          setEdges(allEdges);
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
      const configPayload: any = {
        inputMiners: data.inputMiners,
        ioc_types: data.iocTypes,
        days_to_live: data.daysToLive,
      };
      
      if (data.confidenceOverride !== null && data.confidenceOverride !== undefined && !isNaN(data.confidenceOverride)) {
        configPayload.confidence_override = data.confidenceOverride;
      }
      
      const payload = {
        name: data.name,
        node_type: 'aggregator' as const,
        is_active: data.status === 'enabled',
        config: configPayload,
      };
      
      if (editingId) {
        await apiClient.updateNode(editingId, payload);
      } else {
        await apiClient.createNode(payload as any);
      }
      await loadData();
      closeForm();
    } catch (error: any) {
      console.error('Failed to save aggregator', error);
      alert(`Errore: ${error.message}`);
    }
  };

  const handleEdit = (aggregator: ThreatNode) => {
    setEditingId(aggregator.id || null);
    setValue('name', aggregator.name);
    setValue('inputMiners', aggregator.config?.inputMiners || []);
    setValue('iocTypes', aggregator.config?.ioc_types || []);
    setValue('daysToLive', aggregator.config?.days_to_live || 30);
    setValue('confidenceOverride', aggregator.config?.confidence_override ?? null);
    setValue('status', aggregator.is_active ? 'enabled' : 'disabled');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this aggregator?')) {
      await apiClient.deleteNode(id);
      await loadData();
    }
  };

  const handleOpenInfo = async (aggregator: ThreatNode) => {
    setSelectedAggregator(aggregator);
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    try {
      if (aggregator.id) {
        const [logs, iocs] = await Promise.all([
          apiClient.getNodeLogs(aggregator.id).catch(e => {
            console.error("Logs fetch error:", e);
            throw new Error("Impossibile scaricare i Logs. Verifica che il backend sia in esecuzione e che le API /logs esistano.");
          }),
          apiClient.getNodeIocs(aggregator.id).catch(e => {
            console.error("IOCs fetch error:", e);
            throw new Error("Impossibile scaricare gli IOCs. Verifica che il backend sia in esecuzione e che le API /iocs esistano.");
          })
        ]);
        setAggregatorLogs(logs || []);
        setAggregatorIocs(iocs || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch aggregator details', error);
      setModalError(error.message || "Errore di rete: Impossibile connettersi al backend.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    reset();
  };

  const getBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'domain': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'ip': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'ipv6': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'hash': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'url': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'email': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'unknown': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
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
                <label className="block text-sm font-medium text-zinc-400 mb-1">Input Miners & Whitelists</label>
                <select
                  multiple
                  {...register('inputMiners')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[80px]"
                >
                  {availableMiners.map((miner) => (
                    <option key={miner.id} value={miner.id}>
                      {miner.name} {miner.node_type === 'whitelist' ? '(Whitelist)' : ''}
                    </option>
                  ))}
                </select>
                {errors.inputMiners && <p className="text-red-400 text-xs mt-1">{errors.inputMiners.message}</p>}
                <p className="text-xs text-zinc-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">IOC Types to Process</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {['ip', 'ipv6', 'domain', 'url', 'hash', 'email'].map((type) => (
                    <label key={type} className="flex items-center space-x-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        value={type}
                        {...register('iocTypes')}
                        className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/50"
                      />
                      <span className="uppercase font-mono text-xs">{type}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Only IOCs matching the selected types will be processed. Leave all unselected to process every type.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Aging — Days to Live</label>
                <input
                  type="number"
                  {...register('daysToLive', { valueAsNumber: true })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {errors.daysToLive && <p className="text-red-400 text-xs mt-1">{errors.daysToLive.message}</p>}
                <p className="text-xs text-zinc-500 mt-1">
                  IOC expiry will be set to today + N days on every aggregation run. Expired IOCs are automatically deleted every hour.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Confidence Override</label>
                <input
                  type="number"
                  {...register('confidenceOverride', { valueAsNumber: true, setValueAs: v => v === "" || isNaN(v) ? null : parseInt(v, 10) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Leave empty to keep original"
                />
                {errors.confidenceOverride && <p className="text-red-400 text-xs mt-1">{errors.confidenceOverride.message}</p>}
                <p className="text-xs text-zinc-500 mt-1">
                  If set, overrides the confidence score of all processed IOCs.
                </p>
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
                <th className="px-6 py-3 font-medium">Connected Miners</th>
                <th className="px-6 py-3 font-medium">TTL</th>
                <th className="px-6 py-3 font-medium">Confidence</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {aggregators.map((agg) => {
                const connectedEdges = edges.filter(e => e.target_id === agg.id);
                const connectedMiners = connectedEdges.map(e => {
                  const miner = availableMiners.find(m => m.id === e.source_id);
                  return miner ? miner.name : 'Unknown';
                });

                return (
                  <tr key={agg.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-200">{agg.name}</td>
                    <td className="px-6 py-4">
                      {connectedMiners.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {connectedMiners.map((name, idx) => (
                            <span key={idx} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs italic">No miners connected</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">{agg.config?.days_to_live || 0}d</td>
                  <td className="px-6 py-4">
                    {agg.config?.confidence_override !== undefined && agg.config?.confidence_override !== null ? (
                      <div className="flex items-center">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full mr-2 overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${agg.config.confidence_override}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-400">{agg.config.confidence_override}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      agg.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        agg.is_active ? 'bg-emerald-400' : 'bg-red-400'
                      }`}></span>
                      {agg.is_active ? 'enabled' : 'disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenInfo(agg)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors ml-1"
                      title="Info"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(agg)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors ml-1"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => agg.id && handleDelete(agg.id)}
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

      {isModalOpen && selectedAggregator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <GitMerge className="w-5 h-5 mr-3 text-purple-500" />
                Aggregator Details: {selectedAggregator.name}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {modalLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
                </div>
              ) : modalError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-400">Errore di connessione</h3>
                    <p className="text-sm text-red-400/80 mt-1">{modalError}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Configuration Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* IOC Types */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">IOC Types</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedAggregator.config?.ioc_types?.length > 0 ? (
                          selectedAggregator.config.ioc_types.map((type: string) => (
                            <span key={type} className={`px-2 py-0.5 border rounded text-xs font-mono uppercase ${getBadgeColor(type)}`}>
                              {type}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded text-xs font-mono uppercase">
                            All Types
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TTL */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">TTL</h4>
                      <div className="text-lg font-mono text-zinc-200">
                        {selectedAggregator.config?.days_to_live || 0} <span className="text-sm text-zinc-500">days</span>
                      </div>
                    </div>

                    {/* Confidence Override */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Confidence Override</h4>
                      <div className="text-lg font-mono text-zinc-200">
                        {selectedAggregator.config?.confidence_override !== undefined && selectedAggregator.config?.confidence_override !== null ? (
                          selectedAggregator.config.confidence_override
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </div>
                    </div>

                    {/* Whitelist Miners */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Whitelist Miners</h4>
                      <div className="flex flex-col gap-2">
                        {(() => {
                          const connectedEdges = edges.filter(e => e.target_id === selectedAggregator.id);
                          const whitelistMiners = connectedEdges
                            .map(e => availableMiners.find(m => m.id === e.source_id))
                            .filter(m => m?.node_type === 'whitelist');
                          
                          if (whitelistMiners.length > 0) {
                            return whitelistMiners.map(m => (
                              <div key={m?.id} className="flex items-center gap-2">
                                <span className="text-sm text-zinc-300 truncate">{m?.name}</span>
                                <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded text-[10px] font-bold tracking-wider">
                                  WHITELIST
                                </span>
                              </div>
                            ));
                          }
                          return <span className="text-sm text-zinc-500 italic">No whitelist configured</span>;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Logs Section */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Recent Logs</h3>
                    {aggregatorLogs.length === 0 ? (
                      <p className="text-zinc-500 text-sm">No logs available.</p>
                    ) : (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                            <tr>
                              <th className="px-4 py-2 font-medium">Timestamp</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium">Message</th>
                              <th className="px-4 py-2 font-medium">IOCs Processed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {aggregatorLogs.map((log, idx) => {
                              const renderLogMessage = (log: any) => {
                                if (log.status === 'error') {
                                  return <span className="text-red-400">{log.message}</span>;
                                }
                                
                                const typesMatch = log.message.match(/Types filter:\s*\[(.*?)\]/);
                                const processedMatch = log.message.match(/Processed:\s*(\d+)/);
                                const droppedMatch = log.message.match(/Dropped \(Whitelist\):\s*(\d+)/);
                                const ttlMatch = log.message.match(/TTL applied:\s*(\d+)\s*days/i);
                                
                                if (!typesMatch && !processedMatch && !droppedMatch && !ttlMatch) {
                                  return <span className="text-zinc-300">{log.message}</span>;
                                }

                                const typesStr = typesMatch ? typesMatch[1] : '';
                                const typeEntries = typesStr.split(',').map((s: string) => s.trim()).filter(Boolean);
                                
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-zinc-300">{log.message.split('.')[0]}.</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {typesMatch && (
                                        typeEntries.length > 0 ? typeEntries.map((type: string, i: number) => (
                                          <span key={i} className={`px-2 py-0.5 text-xs font-medium border rounded-full ${getBadgeColor(type)}`}>
                                            {type}
                                          </span>
                                        )) : (
                                          <span className="px-2 py-0.5 text-xs font-medium border rounded-full bg-zinc-800 text-zinc-400 border-zinc-700">
                                            All Types
                                          </span>
                                        )
                                      )}
                                      {processedMatch && (
                                        <span className="px-2 py-0.5 text-xs font-medium border rounded-full bg-blue-500/10 text-blue-400 border-blue-500/20">
                                          Processed: {processedMatch[1]}
                                        </span>
                                      )}
                                      {droppedMatch && parseInt(droppedMatch[1], 10) > 0 && (
                                        <span className="px-2 py-0.5 text-xs font-medium border rounded-full bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                                          Dropped (Whitelist): {droppedMatch[1]}
                                        </span>
                                      )}
                                      {ttlMatch && (
                                        <span className="px-2 py-0.5 text-xs font-medium border rounded-full bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                          TTL: {ttlMatch[1]}d
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              };

                              return (
                                <tr key={idx} className="hover:bg-zinc-900/50">
                                  <td className="px-4 py-2 font-mono text-xs text-zinc-400 align-top">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 align-top">
                                    <span className={`font-medium ${log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 align-top">{renderLogMessage(log)}</td>
                                  <td className="px-4 py-2 font-mono text-zinc-400 align-top">{log.iocs_processed}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* IOCs Section */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Recent IOCs</h3>
                    {aggregatorIocs.length === 0 ? (
                      <p className="text-zinc-500 text-sm">No IOCs available.</p>
                    ) : (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                            <tr>
                              <th className="px-4 py-2 font-medium">Value</th>
                              <th className="px-4 py-2 font-medium">Type</th>
                              <th className="px-4 py-2 font-medium">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {aggregatorIocs.map((ioc, idx) => (
                              <tr key={idx} className="hover:bg-zinc-900/50">
                                <td className="px-4 py-2 font-mono text-zinc-200">{ioc.value}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 border rounded text-xs font-mono uppercase ${getBadgeColor(ioc.type)}`}>
                                    {ioc.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center">
                                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full mr-2 overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500" 
                                        style={{ width: `${ioc.confidence}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono text-zinc-400">{ioc.confidence}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
