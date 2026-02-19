import { create } from 'zustand'

type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

interface AgentState {
  status: AgentStatus
  currentCallId: string | null
  setStatus: (status: AgentStatus) => void
  setCurrentCall: (callId: string | null) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  status: 'offline',
  currentCallId: null,

  setStatus: (status) => set({ status }),

  setCurrentCall: (callId) => set({ currentCallId: callId }),
}))
