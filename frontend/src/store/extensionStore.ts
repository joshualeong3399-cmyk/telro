import { create } from 'zustand'

export type ExtensionStatus = 'idle' | 'ringing' | 'in-use' | 'unavailable' | 'unknown'

export interface ExtensionState {
  extensionId: number
  extensionNumber: string
  displayName: string
  status: ExtensionStatus
  currentCallId?: string
  lastUpdate: number
}

interface ExtensionStoreState {
  extensions: Record<string, ExtensionState>  // keyed by extensionNumber
  setExtensionStatus: (ext: ExtensionState) => void
  setMultiple: (exts: ExtensionState[]) => void
  getStatus: (extensionNumber: string) => ExtensionStatus
  reset: () => void
}

export const useExtensionStore = create<ExtensionStoreState>((set, get) => ({
  extensions: {},

  setExtensionStatus: (ext) =>
    set((s) => ({
      extensions: {
        ...s.extensions,
        [ext.extensionNumber]: { ...ext, lastUpdate: Date.now() },
      },
    })),

  setMultiple: (exts) =>
    set((s) => {
      const updates = Object.fromEntries(
        exts.map((e) => [e.extensionNumber, { ...e, lastUpdate: Date.now() }]),
      )
      return { extensions: { ...s.extensions, ...updates } }
    }),

  getStatus: (extensionNumber) =>
    get().extensions[extensionNumber]?.status ?? 'unknown',

  reset: () => set({ extensions: {} }),
}))
