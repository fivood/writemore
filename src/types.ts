// 应用自己的数据类型（词、场景、题目这些在 ./inspire）
import type { Word } from './inspire';

export interface WordSet {
  id: string;
  words: Word[];
  genre: string;
  createdAt: Date;
  isFavorite: boolean;
  hasWritten: boolean;
}

export type Theme = 'light' | 'dark';
export type WordCount = 3 | 4 | 5;
export type TimerDuration = 10 | 15 | 20 | 30 | 60;

export type WritingMode = 'words' | 'free' | 'scene' | 'dream' | 'challenge' | 'character';

export type PromptFavoriteModule = 'scene' | 'challenge' | 'character';

export interface PromptFavorite {
  id: string;
  module: PromptFavoriteModule;
  itemId: string;
  title: string;
  description?: string;
  tags?: string[];
  isAi: boolean;
  createdAt: Date;
}

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
  deletedFromPalace?: boolean;
}
