const BASE_URL = 'http://localhost:8000/api/v1';

export interface ThreatNode {
  id?: string;
  name: string;
  node_type: 'miner' | 'aggregator' | 'output';
  is_active: boolean;
  config: any;
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
};
