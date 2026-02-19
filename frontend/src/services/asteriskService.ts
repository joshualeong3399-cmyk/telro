import api from './api'

export interface AsteriskStatus {
  version: string
  uptime: string
  activeCalls: number
  peersOnline: number
  peersTotal: number
  channelsActive: number
}

export interface SyncResult {
  module: string
  status: 'success' | 'error'
  message: string
  duration: number
}

export const asteriskService = {
  getStatus: (): Promise<AsteriskStatus> => api.get('/asterisk/status'),

  syncAll: (): Promise<SyncResult[]> => api.post('/asterisk/sync/all'),

  syncModule: (module: 'extensions' | 'trunks' | 'queues' | 'ivr' | 'routes'): Promise<SyncResult> =>
    api.post(`/asterisk/sync/${module}`),

  reloadModule: (module: string): Promise<{ success: boolean }> =>
    api.post('/asterisk/reload', { module }),

  runCommand: (command: string): Promise<{ output: string }> =>
    api.post('/asterisk/command', { command }),
}
