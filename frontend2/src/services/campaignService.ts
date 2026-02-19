import api from './api'

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed'

export interface Campaign {
  id: number
  name: string
  status: CampaignStatus
  aiFlowId?: number
  aiFlowName?: string
  trunkId?: number
  trunkName?: string
  callerIdNumber: string
  totalContacts: number
  dialedCount: number
  answeredCount: number
  dtmfEnabled: boolean
  dtmfKey?: string
  maxRetries: number
  retryInterval: number  // minutes
  startTime?: string
  endTime?: string
  createdAt: string
}

export interface CreateCampaignDto {
  name: string
  aiFlowId?: number
  trunkId?: number
  callerIdNumber: string
  dtmfEnabled: boolean
  dtmfKey?: string
  maxRetries: number
  retryInterval: number
}

export const campaignService = {
  list: (): Promise<Campaign[]> => api.get('/campaigns'),
  get: (id: number): Promise<Campaign> => api.get(`/campaigns/${id}`),
  create: (dto: CreateCampaignDto): Promise<Campaign> => api.post('/campaigns', dto),
  update: (id: number, dto: Partial<CreateCampaignDto>): Promise<Campaign> =>
    api.put(`/campaigns/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/campaigns/${id}`),
  start: (id: number): Promise<void> => api.post(`/campaigns/${id}/start`),
  pause: (id: number): Promise<void> => api.post(`/campaigns/${id}/pause`),
  resume: (id: number): Promise<void> => api.post(`/campaigns/${id}/resume`),
  stop: (id: number): Promise<void> => api.post(`/campaigns/${id}/stop`),
  importContacts: (id: number, file: File): Promise<{ imported: number }> => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/campaigns/${id}/contacts/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
