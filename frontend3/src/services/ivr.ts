import api from './api';

export interface IvrOption {
  digit: string;
  label: string;
  destinationType: 'extension' | 'ivr' | 'queue' | 'hangup';
  destinationId: string;
}

export interface IVR {
  id: string;
  name: string;
  description: string;
  greeting: string;
  greetingType: 'file' | 'tts';
  timeout: number;
  options: IvrOption[];
  invalidMessage: string;
  maxRetries: number;
  timeoutDestinationType: 'extension' | 'ivr' | 'queue' | 'hangup';
  timeoutDestinationId: string | null;
  directDial: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const ivrService = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/ivr', { params }).then(r => r.data),
  getOne: (id: string): Promise<IVR> =>
    api.get(`/ivr/${id}`).then(r => r.data),
  create: (data: Partial<IVR>) =>
    api.post('/ivr', data).then(r => r.data),
  update: (id: string, data: Partial<IVR>) =>
    api.put(`/ivr/${id}`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/ivr/${id}`).then(r => r.data),
  setEnabled: (id: string, enabled: boolean) =>
    api.patch(`/ivr/${id}/enabled`, { enabled }).then(r => r.data),
  getDialplan: (id: string): Promise<string> =>
    api.get(`/ivr/${id}/dialplan`).then(r => r.data),
};

export default ivrService;
