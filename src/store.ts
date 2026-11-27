import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WordCategory, Word, ScenePrompt, WritingChallenge, CharacterPrompt, CharacterLayerId, Genre } from './inspire';
import type { WordCount, Theme, TimerDuration, WritingMode } from './types';
import type { AIConfig } from './services/ai';
import { dayKey } from './lib/util';

/** 今日盲盒：三个词 + 一道场景或挑战题 */
export type DailyBox = { words: Word[] } & (
  | { promptType: 'scene'; promptData: ScenePrompt }
  | { promptType: 'challenge'; promptData: WritingChallenge }
);

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;

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

  // AI settings
  aiConfig: AIConfig;
  setAiConfig: (c: Partial<AIConfig>) => void;
  /** 各服务商上次用的 Key 和型号，按接口地址存 */
  aiProfiles: Record<string, { apiKey: string; model: string }>;
  /** 切到另一个接口地址：先记下当前这家，再取出那家上次的（没用过就是空 Key + 默认型号） */
  switchAiProvider: (apiBase: string, defaultModel: string) => void;
  aiEnabled: boolean;
  setAiEnabled: (e: boolean) => void;

  // Cloud auth
  cloudUser: { id: string; email: string } | null;
  setCloudUser: (u: { id: string; email: string } | null) => void;

  // Daily box
  dailyBoxOpenedDate: string | null;
  setDailyBoxOpenedDate: (d: string | null) => void;
  dailyBoxData: DailyBox | null;
  setDailyBoxData: (data: DailyBox | null) => void;

  // 以下不持久化
  toast: string;
  showToast: (msg: string) => void;
  /** AI 写后反馈，保存草稿时会附在正文后面 */
  aiFeedback: string;
  setAiFeedback: (f: string) => void;
  /** 换词时词卡正在翻转 */
  wordsFlipping: boolean;
  setWordsFlipping: (f: boolean) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (t) => set({ theme: t === 'dark' ? 'dark' : 'light' }),

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
        if (s.has(i)) s.delete(i); else s.add(i);
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

      streak: 0,
      lastActiveDate: '',
      updateStreak: () => {
        const d = dayKey();
        const last = get().lastActiveDate;
        if (last === d) return;
        const yesterday = dayKey(Date.now() - 86400000);
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

      aiConfig: { apiKey: '', apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-4-hydrogen' },
      setAiConfig: (c) => set(s => ({ aiConfig: { ...s.aiConfig, ...c } })),
      aiProfiles: {},
      switchAiProvider: (apiBase, defaultModel) => set(s => {
        const { apiKey, model } = s.aiConfig;
        const aiProfiles = { ...s.aiProfiles, [s.aiConfig.apiBase]: { apiKey, model } };
        const saved = aiProfiles[apiBase];
        return { aiProfiles, aiConfig: { apiBase, apiKey: saved?.apiKey ?? '', model: saved?.model ?? defaultModel } };
      }),
      aiEnabled: false,
      setAiEnabled: (e) => set({ aiEnabled: e }),

      cloudUser: null,
      setCloudUser: (u) => set({ cloudUser: u }),

      dailyBoxOpenedDate: null,
      setDailyBoxOpenedDate: (d) => set({ dailyBoxOpenedDate: d }),
      dailyBoxData: null,
      setDailyBoxData: (data) => set({ dailyBoxData: data }),

      toast: '',
      showToast: (msg) => {
        clearTimeout(toastTimer);
        set({ toast: msg });
        toastTimer = setTimeout(() => set({ toast: '' }), 2500);
      },
      aiFeedback: '',
      setAiFeedback: (f) => set({ aiFeedback: f }),
      wordsFlipping: false,
      setWordsFlipping: (f) => set({ wordsFlipping: f }),
    }),
    {
      name: 'writemore-store',
      version: 2,
      migrate: (persistedState, version) => {
        const st = persistedState as Partial<Record<keyof AppState, unknown>> | null;
        if (st && typeof st === 'object' && version < 2 && st.theme === 'system') {
          const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
          return { ...st, theme: prefersDark ? 'dark' : 'light' } as AppState;
        }
        return st as AppState;
      },
      // Always start at the home screen, never resume mid-session on reload.
      // This runs synchronously during store hydration, so the very first render
      // already sees writingMode: null — no flash of the writing interface.
      onRehydrateStorage: () => (state) => {
        if (state) state.writingMode = null;
      },
      partialize: (s) => ({
        theme: s.theme,
        selectedCategories: s.selectedCategories,
        wordCount: s.wordCount,
        timerDuration: s.timerDuration,
        sidebarCollapsed: s.sidebarCollapsed,
        streak: s.streak,
        lastActiveDate: s.lastActiveDate,
        aiConfig: s.aiConfig,
        aiProfiles: s.aiProfiles,
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
        dailyBoxOpenedDate: s.dailyBoxOpenedDate,
        dailyBoxData: s.dailyBoxData,
      }),
    }
  )
);
