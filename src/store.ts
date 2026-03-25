import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Genre, WordCount, Theme, TimerDuration, Word } from './types';

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;

  // Genre filter
  selectedGenres: Genre[];
  toggleGenre: (g: Genre) => void;
  setSelectedGenres: (g: Genre[]) => void;

  // Word count
  wordCount: WordCount;
  setWordCount: (c: WordCount) => void;

  // Current words
  currentWords: Word[];
  lockedIndices: Set<number>;
  setCurrentWords: (w: Word[]) => void;
  toggleLock: (i: number) => void;
  clearLocks: () => void;

  // Timer
  timerDuration: TimerDuration;
  setTimerDuration: (d: TimerDuration) => void;
  timerActive: boolean;
  timerSeconds: number;
  setTimerActive: (a: boolean) => void;
  setTimerSeconds: (s: number) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (t: string) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Split ratio
  splitRatio: number;
  setSplitRatio: (r: number) => void;

  // Focus mode
  focusMode: boolean;
  setFocusMode: (f: boolean) => void;

  // Streak
  streak: number;
  lastActiveDate: string;
  updateStreak: () => void;

  // Editor
  editorContent: string;
  setEditorContent: (c: string) => void;
  currentWordSetId: string | null;
  setCurrentWordSetId: (id: string | null) => void;

  // Font size
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (s: 'small' | 'medium' | 'large') => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (t) => set({ theme: t }),

      selectedGenres: [],
      toggleGenre: (g) => {
        const cur = get().selectedGenres;
        set({ selectedGenres: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] });
      },
      setSelectedGenres: (g) => set({ selectedGenres: g }),

      wordCount: 3,
      setWordCount: (c) => set({ wordCount: c }),

      currentWords: [],
      lockedIndices: new Set(),
      setCurrentWords: (w) => set({ currentWords: w }),
      toggleLock: (i) => {
        const s = new Set(get().lockedIndices);
        s.has(i) ? s.delete(i) : s.add(i);
        set({ lockedIndices: s });
      },
      clearLocks: () => set({ lockedIndices: new Set() }),

      timerDuration: 15,
      setTimerDuration: (d) => set({ timerDuration: d }),
      timerActive: false,
      timerSeconds: 0,
      setTimerActive: (a) => set({ timerActive: a }),
      setTimerSeconds: (s) => set({ timerSeconds: s }),

      activeTab: 'inspire',
      setActiveTab: (t) => set({ activeTab: t }),

      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      splitRatio: 0.4,
      setSplitRatio: (r) => set({ splitRatio: r }),

      focusMode: false,
      setFocusMode: (f) => set({ focusMode: f }),

      streak: 0,
      lastActiveDate: '',
      updateStreak: () => {
        const d = today();
        const last = get().lastActiveDate;
        if (last === d) return;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        set({
          streak: last === yesterday ? get().streak + 1 : 1,
          lastActiveDate: d,
        });
      },

      editorContent: '',
      setEditorContent: (c) => set({ editorContent: c }),
      currentWordSetId: null,
      setCurrentWordSetId: (id) => set({ currentWordSetId: id }),

      fontSize: 'medium',
      setFontSize: (s) => set({ fontSize: s }),
    }),
    {
      name: 'writemore-store',
      partialize: (s) => ({
        theme: s.theme,
        selectedGenres: s.selectedGenres,
        wordCount: s.wordCount,
        timerDuration: s.timerDuration,
        sidebarCollapsed: s.sidebarCollapsed,
        splitRatio: s.splitRatio,
        streak: s.streak,
        lastActiveDate: s.lastActiveDate,
        fontSize: s.fontSize,
      }),
    }
  )
);
