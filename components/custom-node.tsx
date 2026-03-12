'use client';

import { Handle, Position } from '@xyflow/react';
import { Database, GitMerge, Send } from 'lucide-react';

const iconMap = {
  miner: Database,
  whitelist: Database,
  aggregator: GitMerge,
  output: Send,
};

const colorMap = {
  miner: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  whitelist: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  aggregator: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  output: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

export function CustomNode({ data }: any) {
  const Icon = iconMap[data.type as keyof typeof iconMap] || Database;
  const colors = colorMap[data.type as keyof typeof colorMap] || colorMap.miner;

  return (
    <div className={`px-4 py-3 rounded-lg border ${colors} backdrop-blur-sm min-w-[200px] shadow-lg`}>
      {data.type === 'output' && (
        <Handle type="target" position={Position.Left} id="target-left" className="w-2 h-2 !bg-zinc-500 border-none" />
      )}
      {data.type === 'aggregator' && (
        <>
          <Handle type="target" position={Position.Left} id="target-left" className="w-2 h-2 !bg-zinc-500 border-none" />
          <Handle type="target" position={Position.Top} id="target-top" className="w-2 h-2 !bg-zinc-500 border-none" />
          <Handle type="target" position={Position.Bottom} id="target-bottom" className="w-2 h-2 !bg-zinc-500 border-none" />
        </>
      )}
      
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-md bg-zinc-950/50">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider opacity-70 mb-0.5">
            {data.type}
          </div>
          <div className="text-sm font-medium text-zinc-100">
            {data.label}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
        <div className="flex items-center space-x-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${data.status === 'enabled' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-[10px] font-mono uppercase text-zinc-400">
            {data.status}
          </span>
        </div>
        {data.details && (
          <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[80px]">
            {data.details}
          </span>
        )}
      </div>

      {data.type !== 'output' && (
        <Handle type="source" position={Position.Right} id="source-right" className="w-2 h-2 !bg-zinc-500 border-none" />
      )}
    </div>
  );
}
