import api from './api';

export interface SipTrunk {
  id: string;
  name: string;
  provider: string;
  host: string;
  port: number;
  protocol: 'SIP' | 'UDP' | 'TCP' | 'TLS';
  context: string;
  username: string;
  secret: string;
  authid: string;
  fromuser: string;
  fromdomain: string;
  status: 'active' | 'inactive' | 'error';
  priority: number;
  ratePerMinute: number;
  costPer1000: number;
  enabled: boolean;
  supportsSms: boolean;
  smsApiUrl?: string;
  smsApiKey?: string;
  smsApiSecret?: string;
  createdAt: string;
  updatedAt: string;
}

const sipTrunkService = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/sip-trunks', { params }).then((r: { data: any; }) => r.data),
  getOne: (id: string): Promise<SipTrunk> =>
    api.get(`/sip-trunks/${id}`).then((r: { data: any; }) => r.data),
  create: (data: Partial<SipTrunk>) =>
    api.post('/sip-trunks', data).then((r: { data: any; }) => r.data),
  update: (id: string, data: Partial<SipTrunk>) =>
    api.put(`/sip-trunks/${id}`, data).then((r: { data: any; }) => r.data),
  remove: (id: string) =>
    api.delete(`/sip-trunks/${id}`).then((r: { data: any; }) => r.data),
  test: (id: string) =>
    api.post(`/sip-trunks/${id}/test`).then((r: { data: any; }) => r.data),
  setEnabled: (id: string, enabled: boolean) =>
    api.patch(`/sip-trunks/${id}/enabled`, { enabled }).then((r: { data: any; }) => r.data),
};

export default sipTrunkService;
