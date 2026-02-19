import api from './api';

export interface Extension {
  id: string;
  number: string;
  name: string;
  type: 'SIP' | 'IAX2';
  status: 'online' | 'offline' | 'busy' | 'dnd';
  maxCalls: number;
  createdAt: string;
  updatedAt: string;
}

export const extensionAPI = {
  getList: (params?: { limit?: number; offset?: number }) =>
    api.get<{ data: Extension[]; total: number }>('/extensions', { params }),
  
  getDetail: (id: string) =>
    api.get<Extension>(`/extensions/${id}`),
  
  create: (data: Partial<Extension>) =>
    api.post<Extension>('/extensions', data),
  
  update: (id: string, data: Partial<Extension>) =>
    api.put<Extension>(`/extensions/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/extensions/${id}`),
  
  getStatus: (id: string) =>
    api.get(`/extensions/${id}/status`),
  
  setDND: (id: string, enabled: boolean) =>
    api.put(`/extensions/${id}/dnd`, { enabled }),
  
  enable: (id: string) =>
    api.put(`/extensions/${id}/enable`, {}),
  
  disable: (id: string) =>
    api.put(`/extensions/${id}/disable`, {}),
};
