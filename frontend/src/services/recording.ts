import api from './api';

export interface Recording {
  id: string;
  callId: string;
  extensionId: string;
  filename: string;
  duration: number;
  format: string;
  quality: string;
  fileSize: number;
  status: 'recording' | 'completed' | 'processing' | 'failed';
  createdAt: string;
}

export const recordingAPI = {
  getList: (params?: { limit?: number; offset?: number }) =>
    api.get<{ data: Recording[]; total: number }>('/recordings', { params }),
  
  getDetail: (id: string) =>
    api.get<Recording>(`/recordings/${id}`),
  
  getExtensionRecordings: (extensionId: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ data: Recording[]; total: number }>(`/recordings/extension/${extensionId}`, { params }),
  
  download: (id: string) =>
    api.get(`/recordings/${id}/download`, { responseType: 'blob' }),
  
  delete: (id: string) =>
    api.delete(`/recordings/${id}`),
  
  archive: (id: string) =>
    api.post(`/recordings/${id}/archive`, {}),
  
  getStats: () =>
    api.get('/recordings/stats'),
};
