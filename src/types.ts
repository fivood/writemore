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

export interface DayRecord {
  date: string; // YYYY-MM-DD
  wordSets: WordSet[];
  hasWritten: boolean;
  totalWords: number;
}

export type Theme = 'light' | 'dark' | 'system';
export type WordCount = 3 | 4 | 5;
export type TimerDuration = 10 | 15 | 20 | 30 | 60;

// ── Writing Modes ──

export type WritingMode = 'words' | 'free' | 'scene' | 'dream' | 'challenge' | 'character';

export const WRITING_MODES: { mode: WritingMode; label: string; icon: string; desc: string; color: string }[] = [
  { mode: 'words',     label: '词汇灵感', icon: 'casino',          desc: '随机抽取词条，围绕它们展开想象',         color: 'bg-amber-50 border-amber-200 text-amber-800'   },
  { mode: 'free',      label: '自由发挥', icon: 'edit_note',        desc: '今天不用提示，我有想法',                 color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { mode: 'scene',     label: '场景描写', icon: 'landscape',        desc: '给出一个场景，来一段精彩描写',           color: 'bg-blue-50 border-blue-200 text-blue-800'     },
  { mode: 'dream',     label: '梦境记录', icon: 'nights_stay',      desc: '趁记忆还热乎，记录昨晚的梦',             color: 'bg-violet-50 border-violet-200 text-violet-800' },
  { mode: 'challenge', label: '写作挑战', icon: 'quiz',             desc: '你问我不一定答——挑战式写作练习',        color: 'bg-rose-50 border-rose-200 text-rose-800'     },
  { mode: 'character', label: '人物描写', icon: 'person_search',   desc: '六个维度，深挖你笔下的角色',             color: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800' },
];

export interface ScenePrompt {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

// Extend Draft to support writing mode metadata
export interface Draft {
  id: string;
  wordSetId: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  writingMode?: WritingMode;
  sceneId?: string;
  challengeId?: string;
  characterPromptId?: string;
}

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
