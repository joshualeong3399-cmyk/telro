import api from './api'

export interface AudioFile {
  id: number
  name: string
  filename: string
  duration: number    // seconds
  size: number        // bytes
  format: string      // mp3/wav/gsm
  category?: string
  usedIn: string[]    // IVR/Campaign names using this file
  createdAt: string
}

export const audioFileService = {
  list: (params?: { category?: string }): Promise<AudioFile[]> =>
    api.get('/audio-files', { params }),

  get: (id: number): Promise<AudioFile> => api.get(`/audio-files/${id}`),

  upload: (
    file: File,
    meta: { name: string; category?: string },
  ): Promise<AudioFile> => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', meta.name)
    if (meta.category) form.append('category', meta.category)
    return api.post('/audio-files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update: (id: number, dto: { name?: string; category?: string }): Promise<AudioFile> =>
    api.put(`/audio-files/${id}`, dto),

  delete: (id: number): Promise<void> => api.delete(`/audio-files/${id}`),

  getPlayUrl: (id: number): string => `/api/audio-files/${id}/play`,
}
