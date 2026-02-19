import api from './api';

export interface InboundRoute {
  id: string;
  name: string;
  description: string;
  did: string;
  callerIdMatch: string;
  destinationType: 'extension' | 'ivr' | 'queue' | 'voicemail' | 'hangup' | 'time_condition';
  destinationId: string | null;
  timeConditionId: string | null;
  priority: number;
  callerIdName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const inboundRouteService = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/inbound-routes', { params }).then((r: { data: any; }) => r.data),
  getOne: (id: string): Promise<InboundRoute> =>
    api.get(`/inbound-routes/${id}`).then((r: { data: any; }) => r.data),
  create: (data: Partial<InboundRoute>) =>
    api.post('/inbound-routes', data).then((r: { data: any; }) => r.data),
  update: (id: string, data: Partial<InboundRoute>) =>
    api.put(`/inbound-routes/${id}`, data).then((r: { data: any; }) => r.data),
  remove: (id: string) =>
    api.delete(`/inbound-routes/${id}`).then((r: { data: any; }) => r.data),
  setEnabled: (id: string, enabled: boolean) =>
    api.patch(`/inbound-routes/${id}/enabled`, { enabled }).then((r: { data: any; }) => r.data),
  testMatch: (did: string, callerId: string) =>
    api.post('/inbound-routes/match', { did, callerId }).then((r: { data: any; }) => r.data),
};

export default inboundRouteService;
