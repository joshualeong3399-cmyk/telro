import api from './api';

export interface Queue {
  id: string;
  name: string;
  extensionId: string;
  strategy: 'ringall' | 'roundrobin' | 'leastrecent' | 'fewestcalls';
  maxRetries: number;
  retryInterval: number;
  wrapupTime: number;
  status: 'active' | 'paused' | 'stopped';
  createdAt: string;
}

export interface QueueTask {
  id: string;
  queueId: string;
  phoneNumber: string;
  attempts: number;
  lastAttemptTime?: string;
  result?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export const queueAPI = {
  getList: (params?: { limit?: number; offset?: number }) =>
    api.get<{ data: Queue[]; total: number }>('/queue', { params }),
  
  getDetail: (id: string) =>
    api.get<Queue>(`/queue/${id}`),
  
  create: (data: Partial<Queue>) =>
    api.post<Queue>('/queue', data),
  
  update: (id: string, data: Partial<Queue>) =>
    api.put<Queue>(`/queue/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/queue/${id}`),
  
  addTasks: (queueId: string, data: { phoneNumbers: string[]; maxAttempts: number }) =>
    api.post(`/queue/${queueId}/tasks`, data),
  
  getTasks: (queueId: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ data: QueueTask[]; total: number }>(`/queue/${queueId}/tasks`, { params }),
  
  start: (queueId: string) =>
    api.post(`/queue/${queueId}/start`, {}),
  
  pause: (queueId: string) =>
    api.post(`/queue/${queueId}/pause`, {}),
  
  stop: (queueId: string) =>
    api.post(`/queue/${queueId}/stop`, {}),
  
  getStats: (queueId: string) =>
    api.get(`/queue/${queueId}/stats`),
};
