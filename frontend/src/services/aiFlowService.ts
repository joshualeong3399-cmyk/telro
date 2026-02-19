import api from './api'
import type { AiFlow } from '@/types/aiFlow'

export const aiFlowService = {
  list: (): Promise<AiFlow[]> => api.get('/ai-flows'),

  create: (data: Omit<AiFlow, 'id'>): Promise<AiFlow> =>
    api.post('/ai-flows', data),

  update: (id: number, data: Partial<Omit<AiFlow, 'id'>>): Promise<AiFlow> =>
    api.put(`/ai-flows/${id}`, data),

  remove: (id: number): Promise<void> =>
    api.delete(`/ai-flows/${id}`),

  duplicate: (id: number): Promise<AiFlow> =>
    api.post(`/ai-flows/${id}/duplicate`),
}
