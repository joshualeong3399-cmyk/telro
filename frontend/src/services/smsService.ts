import api from './api'

export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed'
export type SmsDirection = 'inbound' | 'outbound'

export interface SmsMessage {
  id: number
  direction: SmsDirection
  from: string
  to: string
  body: string
  status: SmsStatus
  trunkId?: number
  agentId?: number
  agentName?: string
  error?: string
  createdAt: string
  deliveredAt?: string
}

export interface SendSmsDto {
  to: string
  body: string
  trunkId?: number
}

export const smsService = {
  list: (params?: {
    direction?: SmsDirection
    status?: SmsStatus
    phone?: string
    page?: number
    pageSize?: number
    startDate?: string
    endDate?: string
  }): Promise<{ data: SmsMessage[]; total: number }> =>
    api.get('/sms', { params }),

  send: (dto: SendSmsDto): Promise<SmsMessage> => api.post('/sms/send', dto),

  get: (id: number): Promise<SmsMessage> => api.get(`/sms/${id}`),

  retry: (id: number): Promise<SmsMessage> => api.post(`/sms/${id}/retry`),
}
