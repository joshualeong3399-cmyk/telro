import api from './api';

export interface CallRecord {
  id: string;
  extensionId: string;
  fromNumber: string;
  toNumber: string;
  startTime: string;
  endTime: string;
  duration: number;
  talkTime: number;
  ringTime: number;
  recordingId?: string;
  status: 'active' | 'completed' | 'failed';
  hangupCause?: string;
  cost: number;
}

export interface ActiveCall {
  id: string;
  extensionId: string;
  number: string;
  fromNumber: string;
  toNumber: string;
  startTime: string;
  duration: number;
  direction: 'inbound' | 'outbound';
}

export const callAPI = {
  getRecords: (params?: { limit?: number; offset?: number; extensionId?: string }) =>
    api.get<{ data: CallRecord[]; total: number }>('/calls', { params }),
  
  getActiveList: () =>
    api.get<{ data: ActiveCall[] }>('/calls/active/list'),
  
  getExtensionHistory: (extensionId: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ data: CallRecord[]; total: number }>(`/calls/extension/${extensionId}`, { params }),
  
  dial: (data: { extensionId: string; phoneNumber: string }) =>
    api.post('/calls/dial', data),
  
  transfer: (data: { callId: string; toExtension: string }) =>
    api.post('/calls/transfer', data),
  
  hangup: (callId: string) =>
    api.post(`/calls/${callId}/hangup`, {}),
  
  monitor: (callId: string) =>
    api.post(`/calls/${callId}/monitor`, {}),
};
