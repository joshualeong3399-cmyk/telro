import api from './api';

export interface TimeRange {
  days: number[]; // 0=Sun,1=Mon...6=Sat
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface TimeCondition {
  id: string;
  name: string;
  description: string;
  timeRanges: TimeRange[];
  matchDestinationType: 'extension' | 'ivr' | 'queue' | 'hangup';
  matchDestinationId: string | null;
  noMatchDestinationType: 'extension' | 'ivr' | 'queue' | 'voicemail' | 'hangup';
  noMatchDestinationId: string | null;
  forceMode: 'auto' | 'force_open' | 'force_closed';
  holidays: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const timeConditionService = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/time-conditions', { params }).then(r => r.data),
  getOne: (id: string): Promise<TimeCondition> =>
    api.get(`/time-conditions/${id}`).then(r => r.data),
  create: (data: Partial<TimeCondition>) =>
    api.post('/time-conditions', data).then(r => r.data),
  update: (id: string, data: Partial<TimeCondition>) =>
    api.put(`/time-conditions/${id}`, data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/time-conditions/${id}`).then(r => r.data),
  setForceMode: (id: string, forceMode: TimeCondition['forceMode']) =>
    api.patch(`/time-conditions/${id}/force-mode`, { forceMode }).then(r => r.data),
  check: (id: string) =>
    api.get(`/time-conditions/${id}/check`).then(r => r.data),
};

export default timeConditionService;
