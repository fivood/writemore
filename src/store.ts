import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Genre, WordCategory, WordCount, Theme, TimerDuration, Word, WritingMode, ScenePrompt } from './types';
import type { WritingChallenge } from './data/challenges';
import type { CharacterPrompt, CharacterLayerId } from './data/characterPrompts';
import type { AIConfig } from './services/ai';

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;

  // Genre filter (used by pickRandomGenre for style banner)
  selectedGenres: Genre[];
  toggleGenre: (g: Genre) => void;
  setSelectedGenres: (g: Genre[]) => void;

  // Category filter (controls which word types are drawn)
  selectedCategories: WordCategory[];
  toggleCategory: (c: WordCategory) => void;
  setSelectedCategories: (c: WordCategory[]) => void;

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
  editorTitle: string;
  setEditorTitle: (t: string) => void;
  editorContent: string;
  setEditorContent: (c: string) => void;
  currentWordSetId: string | null;
  setCurrentWordSetId: (id: string | null) => void;
  currentDraftId: string | null;
  setCurrentDraftId: (id: string | null) => void;
  isCurrentWordSetFavorite: boolean;
  setIsCurrentWordSetFavorite: (fav: boolean) => void;

  // Drawn genre (style prompt for current session)
  drawnGenre: Genre | null;
  setDrawnGenre: (g: Genre | null) => void;

  // Writing mode
  writingMode: WritingMode | null;
  setWritingMode: (m: WritingMode | null) => void;
  currentScene: ScenePrompt | null;
  setCurrentScene: (s: ScenePrompt | null) => void;
  currentChallenge: WritingChallenge | null;
  setCurrentChallenge: (c: WritingChallenge | null) => void;
  currentCharacterPrompt: CharacterPrompt | null;
  setCurrentCharacterPrompt: (p: CharacterPrompt | null) => void;
  selectedCharacterLayer: CharacterLayerId | null;
  setSelectedCharacterLayer: (l: CharacterLayerId | null) => void;

  // Font size
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (s: 'small' | 'medium' | 'large') => void;

  // AI settings
  aiConfig: AIConfig;
  setAiConfig: (c: Partial<AIConfig>) => void;
  aiEnabled: boolean;
  setAiEnabled: (e: boolean) => void;

  // Cloud auth
  cloudUser: { id: string; email: string } | null;
  setCloudUser: (u: { id: string; email: string } | null) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (t) => set({ theme: t === 'dark' ? 'dark' : 'light' }),

      selectedGenres: [],
      toggleGenre: (g) => {
        const cur = get().selectedGenres;
        set({ selectedGenres: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] });
      },
      setSelectedGenres: (g) => set({ selectedGenres: g }),

      selectedCategories: [],
      toggleCategory: (c) => {
        const cur = get().selectedCategories;
        set({ selectedCategories: cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c] });
      },
      setSelectedCategories: (c) => set({ selectedCategories: c }),

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

      editorTitle: '',
      setEditorTitle: (t) => set({ editorTitle: t }),
      editorContent: '',
      setEditorContent: (c) => set({ editorContent: c }),
      currentWordSetId: null,
      setCurrentWordSetId: (id) => set({ currentWordSetId: id }),
      currentDraftId: null,
      setCurrentDraftId: (id) => set({ currentDraftId: id }),
      isCurrentWordSetFavorite: false,
      setIsCurrentWordSetFavorite: (fav) => set({ isCurrentWordSetFavorite: fav }),

      drawnGenre: null,
      setDrawnGenre: (g) => set({ drawnGenre: g }),

      writingMode: null,
      setWritingMode: (m) => set({ writingMode: m }),
      currentScene: null,
      setCurrentScene: (s) => set({ currentScene: s }),
      currentChallenge: null,
      setCurrentChallenge: (c) => set({ currentChallenge: c }),
      currentCharacterPrompt: null,
      setCurrentCharacterPrompt: (p) => set({ currentCharacterPrompt: p }),
      selectedCharacterLayer: null,
      setSelectedCharacterLayer: (l) => set({ selectedCharacterLayer: l }),

      fontSize: 'medium',
      setFontSize: (s) => set({ fontSize: s }),

      aiConfig: { apiKey: '', apiBase: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      setAiConfig: (c) => set(s => ({ aiConfig: { ...s.aiConfig, ...c } })),
      aiEnabled: false,
      setAiEnabled: (e) => set({ aiEnabled: e }),

      cloudUser: null,
      setCloudUser: (u) => set({ cloudUser: u }),
    }),
    {
      name: 'writemore-store',
      version: 2,
      migrate: (persistedState: any, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        if (version < 2 && persistedState.theme === 'system') {
          const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
          return { ...persistedState, theme: prefersDark ? 'dark' : 'light' };
        }
        return persistedState;
      },
      partialize: (s) => ({
        theme: s.theme,
        selectedGenres: s.selectedGenres,
        selectedCategories: s.selectedCategories,
        wordCount: s.wordCount,
        timerDuration: s.timerDuration,
        sidebarCollapsed: s.sidebarCollapsed,
        splitRatio: s.splitRatio,
        streak: s.streak,
        lastActiveDate: s.lastActiveDate,
        fontSize: s.fontSize,
        aiConfig: s.aiConfig,
        aiEnabled: s.aiEnabled,
        cloudUser: s.cloudUser,
        editorTitle: s.editorTitle,
        editorContent: s.editorContent,
        currentWordSetId: s.currentWordSetId,
        currentDraftId: s.currentDraftId,
        isCurrentWordSetFavorite: s.isCurrentWordSetFavorite,
        currentWords: s.currentWords,
        writingMode: s.writingMode,
        currentScene: s.currentScene,
        currentChallenge: s.currentChallenge,
        currentCharacterPrompt: s.currentCharacterPrompt,
        selectedCharacterLayer: s.selectedCharacterLayer,
      }),
    }
  )
);
