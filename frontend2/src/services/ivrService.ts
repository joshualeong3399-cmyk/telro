import api from './api'

export type IvrNodeType = 'greeting' | 'menu' | 'playback' | 'transfer' | 'hangup' | 'condition'

export interface IvrNode {
  id: string
  type: IvrNodeType
  label: string
  audioFile?: string
  dtmfOptions?: Record<string, string> // digit -> next node id
  transferTarget?: string
  timeout?: number
  retries?: number
}

export interface IvrFlow {
  id: number
  name: string
  extension: string
  entryNode: string
  nodes: IvrNode[]
  enabled: boolean
  description?: string
  createdAt: string
}

export interface CreateIvrFlowDto {
  name: string
  extension: string
  entryNode?: string
  nodes?: IvrNode[]
  enabled?: boolean
  description?: string
}

export const ivrService = {
  list: (): Promise<IvrFlow[]> => api.get('/ivr'),
  get: (id: number): Promise<IvrFlow> => api.get(`/ivr/${id}`),
  create: (dto: CreateIvrFlowDto): Promise<IvrFlow> => api.post('/ivr', dto),
  update: (id: number, dto: Partial<CreateIvrFlowDto>): Promise<IvrFlow> =>
    api.put(`/ivr/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/ivr/${id}`),
  syncAsterisk: (id: number): Promise<void> => api.post(`/ivr/${id}/sync`),
}
