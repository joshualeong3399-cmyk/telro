import api from './api'

export interface Voicemail {
  id: number
  mailbox: string
  callerId: string
  callerIdNumber: string
  duration: number       // seconds
  folder: 'INBOX' | 'Old' | 'Work' | 'Family' | 'Friends'
  listened: boolean
  transcription?: string
  filename: string
  createdAt: string
}

export const voicemailService = {
  list: (params?: {
    folder?: string
    listened?: boolean
    page?: number
    pageSize?: number
  }): Promise<{ data: Voicemail[]; total: number }> =>
    api.get('/voicemail', { params }),

  get: (id: number): Promise<Voicemail> => api.get(`/voicemail/${id}`),

  markListened: (id: number): Promise<void> =>
    api.patch(`/voicemail/${id}`, { listened: true }),

  delete: (id: number): Promise<void> => api.delete(`/voicemail/${id}`),

  deleteBatch: (ids: number[]): Promise<void> =>
    api.post('/voicemail/batch-delete', { ids }),

  getAudioUrl: (id: number): string => `/api/voicemail/${id}/audio`,
}
