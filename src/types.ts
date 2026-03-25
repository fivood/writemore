export type Genre = '科幻' | '悬疑' | '奇幻' | '言情' | '武侠' | '都市' | '历史' | '恐怖' | '通用';

export const ALL_GENRES: Genre[] = ['科幻', '悬疑', '奇幻', '言情', '武侠', '都市', '历史', '恐怖', '通用'];
export const FICTION_GENRES: Genre[] = ['科幻', '悬疑', '奇幻', '言情', '武侠', '都市', '历史', '恐怖'];

export interface Word {
  id: string;
  text: string;
  explanation?: string;
  genre: Genre;
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
