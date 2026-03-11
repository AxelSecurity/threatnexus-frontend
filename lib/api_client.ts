export type NodeType = 'miner' | 'aggregator' | 'output';

export interface BaseNode {
  id: string;
  name: string;
  type: NodeType;
  status: 'enabled' | 'disabled';
}

export interface MinerNode extends BaseNode {
  type: 'miner';
  sourceUrl: string;
  parserType: 'csv' | 'json' | 'regex' | 'stix';
  pollingInterval: string; // Cron format
}

export interface AggregatorNode extends BaseNode {
  type: 'aggregator';
  inputMiners: string[]; // Array of Miner IDs
  agingRules: number; // TTL in days
  confidenceOverride: number; // 0-100
  whitelistDomains: string[];
}

export interface OutputNode extends BaseNode {
  type: 'output';
  sourceAggregator: string; // Aggregator ID
  outputFormat: 'txt' | 'json' | 'csv';
  endpointPath: string;
}

export type ThreatNode = MinerNode | AggregatorNode | OutputNode;

// Mock Data
let mockNodes: ThreatNode[] = [
  {
    id: 'miner-1',
    name: 'AlienVault OTX',
    type: 'miner',
    status: 'enabled',
    sourceUrl: 'https://otx.alienvault.com/api/v1/indicators',
    parserType: 'json',
    pollingInterval: '0 */2 * * *',
  },
  {
    id: 'miner-2',
    name: 'Spamhaus DROP',
    type: 'miner',
    status: 'enabled',
    sourceUrl: 'https://www.spamhaus.org/drop/drop.txt',
    parserType: 'csv',
    pollingInterval: '0 0 * * *',
  },
  {
    id: 'agg-1',
    name: 'High Confidence IPs',
    type: 'aggregator',
    status: 'enabled',
    inputMiners: ['miner-1', 'miner-2'],
    agingRules: 30,
    confidenceOverride: 90,
    whitelistDomains: ['microsoft.com', 'google.com'],
  },
  {
    id: 'out-1',
    name: 'Palo Alto EDL',
    type: 'output',
    status: 'enabled',
    sourceAggregator: 'agg-1',
    outputFormat: 'txt',
    endpointPath: '/feeds/high-confidence-ips/txt',
  },
];

// Mock API Client
export const apiClient = {
  async getNodes(): Promise<ThreatNode[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...mockNodes]), 300);
    });
  },

  async getNodeById(id: string): Promise<ThreatNode | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockNodes.find((n) => n.id === id)), 200);
    });
  },

  async createNode(node: Omit<ThreatNode, 'id'>): Promise<ThreatNode> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newNode = { ...node, id: `${node.type}-${Date.now()}` } as ThreatNode;
        mockNodes.push(newNode);
        resolve(newNode);
      }, 400);
    });
  },

  async updateNode(id: string, updates: Partial<ThreatNode>): Promise<ThreatNode> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = mockNodes.findIndex((n) => n.id === id);
        if (index === -1) return reject(new Error('Node not found'));
        
        mockNodes[index] = { ...mockNodes[index], ...updates } as ThreatNode;
        resolve(mockNodes[index]);
      }, 400);
    });
  },

  async deleteNode(id: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        mockNodes = mockNodes.filter((n) => n.id !== id);
        resolve();
      }, 300);
    });
  },
};
