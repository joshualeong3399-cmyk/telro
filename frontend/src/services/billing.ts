import api from './api';

export interface BillingRecord {
  id: string;
  extensionId: string;
  callId: string;
  amount: number;
  duration: number;
  rate: number;
  type: 'extension' | 'trunk';
  status: 'pending' | 'invoiced' | 'paid';
  date: string;
}

export interface BillingMonth {
  year: number;
  month: number;
  total: number;
  records: BillingRecord[];
}

export const billingAPI = {
  getMonthly: (params: { year: number; month: number }) =>
    api.get<BillingMonth>('/billing/monthly', { params }),
  
  getRange: (params: { startDate: string; endDate: string }) =>
    api.get<{ data: BillingRecord[]; total: number }>('/billing/range', { params }),
  
  getTopUsers: (params?: { limit?: number }) =>
    api.get('/billing/top-users', { params }),
  
  getTrend: (extensionId: string, params?: { months?: number }) =>
    api.get(`/billing/trend/${extensionId}`, { params }),
  
  generateInvoice: (params: { year: number; month: number; extensionId?: string }) =>
    api.post('/billing/invoice/generate', params),
  
  exportReport: (params: { year: number; month: number }) =>
    api.get('/billing/export', { params, responseType: 'blob' }),
};
