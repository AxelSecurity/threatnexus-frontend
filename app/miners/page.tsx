'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Database, AlertCircle, Play, Eye, X } from 'lucide-react';
import { apiClient, ThreatNode } from '@/lib/api_client';

const minerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  sourceUrl: z.string().url('Must be a valid URL'),
  parserType: z.enum(['csv', 'json', 'regex', 'stix', 'txt']),
  pollingInterval: z.string().min(1, 'Cron expression is required'),
  status: z.enum(['enabled', 'disabled']),
  authType: z.enum(['none', 'basic', 'bearer']),
  authUsername: z.string().optional(),
  authPassword: z.string().optional(),
  authToken: z.string().optional(),
});

type MinerFormValues = z.infer<typeof minerSchema>;

const cronToMinutes = (cron: string): number => {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length >= 5) {
      const minute = parts[0];
      const hour = parts[1];
      
      if (hour.startsWith('*/')) {
        return parseInt(hour.replace('*/', '')) * 60;
      }
      if (minute.startsWith('*/')) {
        return parseInt(minute.replace('*/', ''));
      }
      if (minute !== '*' && hour !== '*') {
        return 24 * 60; 
      }
    }
  } catch (e) {}
  return 120; // Default fallback
};

export default function MinersPage() {
  const [miners, setMiners] = useState<ThreatNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMiner, setSelectedMiner] = useState<ThreatNode | null>(null);
  const [minerLogs, setMinerLogs] = useState<any[]>([]);
  const [minerIocs, setMinerIocs] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MinerFormValues>({
    resolver: zodResolver(minerSchema),
    defaultValues: {
      status: 'enabled',
      parserType: 'json',
      authType: 'none',
    },
  });

  const authType = watch('authType');

  const loadMiners = async () => {
    setLoading(true);
    try {
      const nodes = await apiClient.getNodes();
      setMiners(nodes.filter((n) => n.node_type === 'miner'));
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
          setMiners(nodes.filter((n) => n.node_type === 'miner'));
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
      const configPayload = {
        url: data.sourceUrl,
        parser: data.parserType,
        polling_interval: cronToMinutes(data.pollingInterval),
        auth_type: data.authType,
        ...(data.authType === 'basic' && {
          auth_username: data.authUsername,
          auth_password: data.authPassword,
        }),
        ...(data.authType === 'bearer' && {
          auth_token: data.authToken,
        })
      };

      const payload = {
        name: data.name,
        node_type: 'miner' as const,
        is_active: data.status === 'enabled',
        config: configPayload,
      };

      if (editingId) {
        await apiClient.updateNode(editingId, payload);
      } else {
        await apiClient.createNode(payload as any);
      }
      await loadMiners();
      closeForm();
    } catch (error: any) {
      console.error('Failed to save miner', error);
      alert(`Errore: ${error.message}`);
    }
  };

  const handleEdit = (miner: ThreatNode) => {
    setEditingId(miner.id || null);
    setValue('name', miner.name);
    setValue('status', miner.is_active ? 'enabled' : 'disabled');
    
    if (miner.config) {
      setValue('sourceUrl', miner.config.url || '');
      setValue('parserType', miner.config.parser || 'json');
      setValue('pollingInterval', miner.config.polling_interval ? `*/${miner.config.polling_interval} * * * *` : '0 */2 * * *');
      setValue('authType', miner.config.auth_type || 'none');
      setValue('authUsername', miner.config.auth_username || '');
      setValue('authPassword', miner.config.auth_password || '');
      setValue('authToken', miner.config.auth_token || '');
    } else {
      setValue('sourceUrl', '');
      setValue('parserType', 'json');
      setValue('pollingInterval', '0 */2 * * *');
      setValue('authType', 'none');
      setValue('authUsername', '');
      setValue('authPassword', '');
      setValue('authToken', '');
    }
    
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this miner?')) {
      await apiClient.deleteNode(id);
      await loadMiners();
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await apiClient.triggerNode(id);
      alert('Miner avviato in background');
    } catch (error: any) {
      console.error('Failed to trigger miner', error);
      alert(`Errore: ${error.message}`);
    }
  };

  const handleOpenInfo = async (miner: ThreatNode) => {
    setSelectedMiner(miner);
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    try {
      if (miner.id) {
        const [logs, iocs] = await Promise.all([
          apiClient.getNodeLogs(miner.id).catch(e => {
            console.error("Logs fetch error:", e);
            throw new Error("Impossibile scaricare i Logs. Verifica che il backend sia in esecuzione e che le API /logs esistano.");
          }),
          apiClient.getNodeIocs(miner.id).catch(e => {
            console.error("IOCs fetch error:", e);
            throw new Error("Impossibile scaricare gli IOCs. Verifica che il backend sia in esecuzione e che le API /iocs esistano.");
          })
        ]);
        setMinerLogs(logs || []);
        setMinerIocs(iocs || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch miner details', error);
      setModalError(error.message || "Errore di rete: Impossibile connettersi al backend (Possibile blocco CORS o Mixed Content).");
    } finally {
      setModalLoading(false);
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
          <h2 className="text-lg font-medium mb-4 text-white">
            {editingId ? 'Edit Miner' : 'Create New Miner'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Miner Name</label>
                <input
                  {...register('name')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., AlienVault OTX"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Source URL</label>
                <input
                  {...register('sourceUrl')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="https://..."
                />
                {errors.sourceUrl && <p className="text-red-400 text-xs mt-1">{errors.sourceUrl.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Parser Type</label>
                <select
                  {...register('parserType')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="regex">Regex</option>
                  <option value="stix">STIX/TAXII</option>
                  <option value="txt">TXT (Plain Text List)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Polling Interval (Cron)</label>
                <input
                  {...register('pollingInterval')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="0 */2 * * *"
                />
                {errors.pollingInterval && <p className="text-red-400 text-xs mt-1">{errors.pollingInterval.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Authentication Type</label>
                <select
                  {...register('authType')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="none">None</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                <select
                  {...register('status')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {authType === 'basic' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Username</label>
                    <input
                      {...register('authUsername')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
                    <input
                      type="password"
                      {...register('authPassword')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              {authType === 'bearer' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Token</label>
                  <input
                    type="password"
                    {...register('authToken')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="ey..."
                  />
                </div>
              )}
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
                  <td className="px-6 py-4 text-zinc-400 truncate max-w-[200px]" title={miner.config?.url}>
                    {miner.config?.url}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono uppercase">
                      {miner.config?.parser}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">{miner.config?.polling_interval ? `${miner.config.polling_interval} min` : 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      miner.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        miner.is_active ? 'bg-emerald-400' : 'bg-red-400'
                      }`}></span>
                      {miner.is_active ? 'enabled' : 'disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => miner.id && handleRunNow(miner.id)}
                      className="p-2 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Run Now"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenInfo(miner)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors ml-1"
                      title="Info"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(miner)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors ml-1"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => miner.id && handleDelete(miner.id)}
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

      {isModalOpen && selectedMiner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Database className="w-5 h-5 mr-3 text-blue-500" />
                Miner Details: {selectedMiner.name}
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
                  {/* Logs Section */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Recent Logs</h3>
                    {minerLogs.length === 0 ? (
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
                            {minerLogs.map((log, idx) => (
                              <tr key={idx} className="hover:bg-zinc-900/50">
                                <td className="px-4 py-2 font-mono text-xs text-zinc-400">
                                  {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`font-medium ${log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-zinc-300">{log.message}</td>
                                <td className="px-4 py-2 font-mono text-zinc-400">{log.iocs_processed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* IOCs Section */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">Recent IOCs</h3>
                    {minerIocs.length === 0 ? (
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
                            {minerIocs.map((ioc, idx) => (
                              <tr key={idx} className="hover:bg-zinc-900/50">
                                <td className="px-4 py-2 font-mono text-zinc-200">{ioc.value}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono uppercase">
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
