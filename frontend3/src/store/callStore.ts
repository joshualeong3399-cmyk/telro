import { create } from 'zustand';
import { CallRecord, ActiveCall } from '@/services/call';

interface CallStore {
  activeCalls: ActiveCall[];
  recentCalls: CallRecord[];
  selectedCall: CallRecord | null;
  
  setActiveCalls: (calls: ActiveCall[]) => void;
  addActiveCall: (call: ActiveCall) => void;
  removeActiveCall: (callId: string) => void;
  
  setRecentCalls: (calls: CallRecord[]) => void;
  selectCall: (call: CallRecord | null) => void;
}

export const useCallStore = create<CallStore>((set) => ({
  activeCalls: [],
  recentCalls: [],
  selectedCall: null,
  
  setActiveCalls: (calls) => set({ activeCalls: calls }),
  addActiveCall: (call) => set((state) => ({
    activeCalls: [call, ...state.activeCalls],
  })),
  removeActiveCall: (callId) => set((state) => ({
    activeCalls: state.activeCalls.filter((c) => c.id !== callId),
  })),
  
  setRecentCalls: (calls) => set({ recentCalls: calls }),
  selectCall: (call) => set({ selectedCall: call }),
}));
