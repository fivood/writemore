export type Genre = '科幻' | '悬疑' | '奇幻' | '言情' | '武侠' | '都市' | '历史' | '恐怖' | '通用';

export const ALL_GENRES: Genre[] = ['科幻', '悬疑', '奇幻', '言情', '武侠', '都市', '历史', '恐怖', '通用'];
export const FICTION_GENRES: Genre[] = ['科幻', '悬疑', '奇幻', '言情', '武侠', '都市', '历史', '恐怖'];

// Word category — classifies words by their intrinsic nature
export type WordCategory = '意象' | '实物' | '动作' | '状态' | '感官' | '抽象' | '人物' | '地名' | '典故' | string;

export const WORD_CATEGORIES: WordCategory[] = ['意象', '实物', '动作', '状态', '感官', '抽象', '人物', '地名', '典故'];

export const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  '意象': { icon: '🌀', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  '实物': { icon: '📦', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  '动作': { icon: '🏃', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  '状态': { icon: '🎭', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  '感官': { icon: '👁', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  '抽象': { icon: '💭', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  '人物': { icon: '👤', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  '地名': { icon: '🗺', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  '典故': { icon: '📜', color: 'bg-stone-100 text-stone-700 border-stone-200' },
};

export interface Word {
  id: string;
  text: string;
  explanation?: string;
  category: WordCategory;   // intrinsic nature of the word
  genres: Genre[];           // writing themes this word fits (can be multiple)
  // Legacy compat: old data may have `genre: Genre` which gets migrated on load
  genre?: Genre;
  source: 'builtin' | 'user';
  enabled: boolean;
}

export interface WordSet {
  id: string;
  words: Word[];
  genre: string;
  createdAt: Date;
  isFavorite: boolean;
  hasWritten: boolean;
}

export interface Draft {
  id: string;
  wordSetId: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  wordSets: WordSet[];
  hasWritten: boolean;
  totalWords: number;
}

export type Theme = 'light' | 'dark' | 'system';
export type WordCount = 3 | 4 | 5;
export type TimerDuration = 10 | 15 | 20 | 30 | 60;

export const GENRE_COLORS: Record<Genre, string> = {
  '科幻': '#6366f1',
  '悬疑': '#8b5cf6',
  '奇幻': '#06b6d4',
  '言情': '#ec4899',
  '武侠': '#f59e0b',
  '都市': '#10b981',
  '历史': '#b45309',
  '恐怖': '#dc2626',
  '通用': '#6b7280',
};
