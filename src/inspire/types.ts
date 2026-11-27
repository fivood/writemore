export type Genre = '科幻' | '悬疑' | '奇幻' | '言情' | '武侠' | '都市' | '历史' | '恐怖' | '通用';

/** 抽风格时的候选池（不含「通用」） */
export const FICTION_GENRES: Genre[] = ['科幻', '悬疑', '奇幻', '言情', '武侠', '都市', '历史', '恐怖'];

/** 词条按本身性质分类；用户可以自建分类，所以也接受任意字符串 */
export type WordCategory = '意象' | '实物' | '动作' | '状态' | '感官' | '抽象' | '人物' | '地名' | '典故' | string;

export const WORD_CATEGORIES: WordCategory[] = ['意象', '实物', '动作', '状态', '感官', '抽象', '人物', '地名', '典故'];

export interface Word {
  id: string;
  text: string;
  explanation?: string;
  category: WordCategory;
  /** 适合的题材，可多个 */
  genres: Genre[];
  source: 'builtin' | 'user';
  enabled: boolean;
}

export interface ScenePrompt {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

export interface WritingChallenge {
  id: string;
  text: string;
  source: 'builtin' | 'user';
}

export type CharacterLayerId = 'inner' | 'relationship' | 'voice' | 'body' | 'history' | 'edge';

export interface CharacterLayer {
  id: CharacterLayerId;
  name: string;
  description: string;
}

export interface CharacterPrompt {
  id: string;
  text: string;
  layer: CharacterLayerId;
  source: 'builtin' | 'user';
}

/** 返回 [0, 1) 的随机数，默认 Math.random；传固定种子的函数就能每天出同一题 */
export type Rng = () => number;

export function pickOne<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  return items[Math.floor(rng() * items.length)];
}
