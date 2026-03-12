const BASE_URL = 'http://localhost:8000/api/v1';

export interface ThreatNode {
  id?: string;
  name: string;
  node_type: 'miner' | 'whitelist' | 'aggregator' | 'output';
  is_active: boolean;
  config: any;
}

export interface ThreatEdge {
  id?: string;
  source_id: string;
  target_id: string;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    let errorMessage = `HTTP error! status: ${res.status}`;
    try {
      const errorData = await res.json();
      // FastAPI typically returns validation errors in 'detail'
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        // Handle FastAPI 422 validation array
        errorMessage = errorData.detail.map((e: any) => `${e.loc.join('.')} - ${e.msg}`).join(', ');
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export const apiClient = {
  async getNodes(): Promise<ThreatNode[]> {
    const res = await fetch(`${BASE_URL}/nodes`);
    return handleResponse(res);
  },

  async getNodeById(id: string): Promise<ThreatNode> {
    const res = await fetch(`${BASE_URL}/nodes/${id}`);
    return handleResponse(res);
  },

  async createNode(node: Omit<ThreatNode, 'id'>): Promise<ThreatNode> {
    const res = await fetch(`${BASE_URL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node),
    });
    return handleResponse(res);
  },

  async updateNode(id: string, updates: Partial<ThreatNode>): Promise<ThreatNode> {
    const res = await fetch(`${BASE_URL}/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },

  async deleteNode(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/nodes/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async triggerNode(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/nodes/${id}/trigger`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async getNodeLogs(id: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/nodes/${id}/logs`);
    return handleResponse(res);
  },

  async getNodeIocs(id: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/nodes/${id}/iocs?limit=50`);
    return handleResponse(res);
  },

  async getNodeUnknownIocs(id: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/nodes/${id}/iocs/unknown`);
    return handleResponse(res);
  },

  async reclassifyIocs(payload: { ioc_ids: string[], ioc_type: string }): Promise<any> {
    const res = await fetch(`${BASE_URL}/iocs/reclassify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getEdges(): Promise<ThreatEdge[]> {
    const res = await fetch(`${BASE_URL}/edges`);
    return handleResponse(res);
  },

  async createEdge(edge: Omit<ThreatEdge, 'id'>): Promise<ThreatEdge> {
    const res = await fetch(`${BASE_URL}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge),
    });
    return handleResponse(res);
  },

  async deleteEdge(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/edges/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
};
