import api from './api';

export interface DNCEntry {
  id: string;
  phoneNumber: string;
  reason: 'customer_request' | 'regulatory' | 'invalid_number' | 'manual' | 'imported';
  notes: string;
  expiresAt: string | null;
  addedByUserId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const dncService = {
  getAll: (params?: { reason?: string; limit?: number; offset?: number }) =>
    api.get('/dnc', { params }).then((r: { data: any; }) => r.data),
  add: (data: Partial<DNCEntry>) =>
    api.post('/dnc', data).then((r: { data: any; }) => r.data),
  remove: (id: string) =>
    api.delete(`/dnc/${id}`).then((r: { data: any; }) => r.data),
  setEnabled: (id: string, enabled: boolean) =>
    api.patch(`/dnc/${id}/enabled`, { enabled }).then((r: { data: any; }) => r.data),
  check: (phoneNumber: string): Promise<{ success: boolean; blocked: boolean }> =>
    api.get(`/dnc/check/${phoneNumber}`).then((r: { data: any; }) => r.data),
  bulkImport: (numbers: string[], reason?: string) =>
    api.post('/dnc/import', { numbers, reason }).then((r: { data: any; }) => r.data),
};

export default dncService;
