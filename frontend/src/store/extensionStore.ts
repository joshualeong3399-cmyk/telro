import { create } from 'zustand';
import { Extension } from '@/services/extension';

interface ExtensionStore {
  extensions: Extension[];
  selectedExtension: Extension | null;
  loading: boolean;
  
  setExtensions: (extensions: Extension[]) => void;
  addExtension: (extension: Extension) => void;
  updateExtension: (id: string, data: Partial<Extension>) => void;
  removeExtension: (id: string) => void;
  selectExtension: (extension: Extension | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useExtensionStore = create<ExtensionStore>((set) => ({
  extensions: [],
  selectedExtension: null,
  loading: false,
  
  setExtensions: (extensions) => set({ extensions }),
  addExtension: (extension) => set((state) => ({
    extensions: [extension, ...state.extensions],
  })),
  updateExtension: (id, data) => set((state) => ({
    extensions: state.extensions.map((ext) =>
      ext.id === id ? { ...ext, ...data } : ext
    ),
  })),
  removeExtension: (id) => set((state) => ({
    extensions: state.extensions.filter((ext) => ext.id !== id),
  })),
  selectExtension: (extension) => set({ selectedExtension: extension }),
  setLoading: (loading) => set({ loading }),
}));
