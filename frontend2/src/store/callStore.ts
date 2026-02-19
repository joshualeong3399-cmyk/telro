import { create } from 'zustand'
import type { CallUpdatePayload } from '@/services/socket'

interface CallState extends CallUpdatePayload {
  recentCalls: RecentCall[]
  setCallStats: (stats: CallUpdatePayload) => void
  addRecentCall: (call: RecentCall) => void
  reset: () => void
}

export interface RecentCall {
  callId: string
  direction: 'inbound' | 'outbound'
  callerIdNumber: string
  callerIdName?: string
  destinationNumber: string
  duration: number
  disposition: 'ANSWERED' | 'NO ANSWER' | 'BUSY' | 'FAILED'
  startTime: string
}

const initialStats: CallUpdatePayload = {
  totalCalls: 0,
  answeredCalls: 0,
  queuedCalls: 0,
  onlineAgents: 0,
}

export const useCallStore = create<CallState>((set) => ({
  ...initialStats,
  recentCalls: [],

  setCallStats: (stats) => set({ ...stats }),

  addRecentCall: (call) =>
    set((s) => ({
      recentCalls: [call, ...s.recentCalls].slice(0, 100), // keep last 100
    })),

  reset: () => set({ ...initialStats, recentCalls: [] }),
}))
