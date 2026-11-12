import { create } from 'zustand';
import type { DayKey, Discipline } from '@/domain/types';

export interface Celebration {
  kind: 'level-up' | 'perfect-day' | 'badge' | 'hundred';
  title: string;
  subtitle?: string;
}

interface UiState {
  sheet: { discipline: Discipline; day?: DayKey; editId?: string } | null;
  openSheet: (discipline: Discipline, day?: DayKey, editId?: string) => void;
  closeSheet: () => void;
  celebrations: Celebration[];
  celebrate: (c: Celebration | Celebration[]) => void;
  shiftCelebration: () => void;
  updateReady: boolean;
  applyUpdate: (() => void) | null;
  setUpdate: (apply: (() => void) | null) => void;
  installPrompt: (Event & { prompt: () => Promise<void> }) | null;
  setInstallPrompt: (e: UiState['installPrompt']) => void;
  tick: number; // bumped when the clock override changes so views recompute "today"
  bump: () => void;
}

export const useUi = create<UiState>((set) => ({
  sheet: null,
  openSheet: (discipline, day, editId) => set({ sheet: { discipline, day, editId } }),
  closeSheet: () => set({ sheet: null }),
  celebrations: [],
  celebrate: (c) => set((s) => ({ celebrations: [...s.celebrations, ...(Array.isArray(c) ? c : [c])] })),
  shiftCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),
  updateReady: false,
  applyUpdate: null,
  setUpdate: (apply) => set({ updateReady: !!apply, applyUpdate: apply }),
  installPrompt: null,
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));
