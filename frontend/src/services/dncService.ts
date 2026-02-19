import api from './api'

export interface DncEntry {
  id: number
  phone: string
  reason?: string
  addedBy: string
  createdAt: string
}

export interface DncImportResult {
  total: number
  imported: number
  duplicates: number
  invalid: number
}

export const dncService = {
  list: (params?: { page?: number; pageSize?: number; phone?: string }): Promise<{
    data: DncEntry[]
    total: number
  }> => api.get('/dnc', { params }),

  add: (phone: string, reason?: string): Promise<DncEntry> =>
    api.post('/dnc', { phone, reason }),

  delete: (id: number): Promise<void> => api.delete(`/dnc/${id}`),

  deleteBatch: (ids: number[]): Promise<void> => api.post('/dnc/batch-delete', { ids }),

  check: (phone: string): Promise<{ blocked: boolean }> =>
    api.get('/dnc/check', { params: { phone } }),

  import: (file: File): Promise<DncImportResult> => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/dnc/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  exportUrl: '/api/dnc/export',
}
