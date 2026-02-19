import api from './api'

export type ExtensionType = 'SIP' | 'PJSIP' | 'IAX'
export type ExtensionStatus = 'registered' | 'unregistered'

export interface Extension {
  id: number
  number: string
  name: string
  type: ExtensionType
  status: ExtensionStatus
  registeredIp: string
}

export interface PageResult<T> {
  records: T[]
  total: number
}

export const extensionService = {
  list: (p: { page: number; pageSize: number; keyword?: string }): Promise<PageResult<Extension>> =>
    api.get('/extensions', { params: p }),

  create: (d: Omit<Extension, 'id'>): Promise<Extension> =>
    api.post('/extensions', d),

  update: (id: number, d: Partial<Omit<Extension, 'id'>>): Promise<Extension> =>
    api.put(`/extensions/${id}`, d),

  remove: (id: number): Promise<void> =>
    api.delete(`/extensions/${id}`),
}
