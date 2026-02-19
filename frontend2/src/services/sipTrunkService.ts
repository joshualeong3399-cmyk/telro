import api from './api'

export interface SipTrunk {
  id: number
  name: string
  host: string
  port: number
  username?: string
  secret?: string
  fromDomain?: string
  callerIdName?: string
  callerIdNumber?: string
  transport: 'udp' | 'tcp' | 'tls'
  codecs: string[]
  maxChannels: number
  status: 'registered' | 'unregistered' | 'unknown'
  enabled: boolean
  createdAt: string
}

export interface CreateSipTrunkDto {
  name: string
  host: string
  port?: number
  username?: string
  secret?: string
  fromDomain?: string
  callerIdName?: string
  callerIdNumber?: string
  transport?: SipTrunk['transport']
  codecs?: string[]
  maxChannels?: number
  enabled?: boolean
}

export const sipTrunkService = {
  list: (): Promise<SipTrunk[]> => api.get('/sip-trunks'),
  get: (id: number): Promise<SipTrunk> => api.get(`/sip-trunks/${id}`),
  create: (dto: CreateSipTrunkDto): Promise<SipTrunk> => api.post('/sip-trunks', dto),
  update: (id: number, dto: Partial<CreateSipTrunkDto>): Promise<SipTrunk> =>
    api.put(`/sip-trunks/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/sip-trunks/${id}`),
  reload: (id: number): Promise<void> => api.post(`/sip-trunks/${id}/reload`),
  testConnection: (id: number): Promise<{ success: boolean; message: string }> =>
    api.post(`/sip-trunks/${id}/test`),
}
