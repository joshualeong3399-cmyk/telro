import api from './api';

export interface OutboundRoute {
  id: string;
  name: string;
  description: string;
  dialPatterns: string[];
  sipTrunkId: string | null;
  trunkSequence: string[];
  stripDigits: number;
  prepend: string;
  callerIdOverride: string;
  priority: number;
  allowedExtensions: string[];
  enabled: boolean;
  sipTrunk?: { id: string; name: string; host: string; status: string };
  createdAt: string;
  updatedAt: string;
}

const outboundRouteService = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/outbound-routes', { params }).then(r => r.data),
  getOne: (id: string): Promise<OutboundRoute> =>
    api.get(`/outbound-routes/${id}`).then(r => r.data),
  create: (data: Partial<OutboundRoute>) =>
    api.post('/outbound-routes', data).then(r => r.data),
  update: (id: string, data: Partial<OutboundRoute>) =>
    api.put(`/outbound-routes/${id}`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/outbound-routes/${id}`).then(r => r.data),
  setEnabled: (id: string, enabled: boolean) =>
    api.patch(`/outbound-routes/${id}/enabled`, { enabled }).then(r => r.data),
  testMatch: (dialNumber: string) =>
    api.post('/outbound-routes/match', { dialNumber }).then(r => r.data),
};

export default outboundRouteService;
