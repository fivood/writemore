import raw from './words.json';
import { FICTION_GENRES, pickOne } from './types';
import type { Genre, Rng, Word, WordCategory } from './types';

/** 旧数据只有单个 genre 字段，没有 genres 数组 */
export type RawWord = Omit<Word, 'genres' | 'category'> & { genres?: Genre[]; genre?: Genre; category?: WordCategory };

export function normalizeWord(w: RawWord): Word {
  if (Array.isArray(w.genres)) return w as Word;
  const { genre, ...rest } = w;
  return { ...rest, category: w.category || '意象', genres: genre ? [genre] : ['通用'] };
}

/** 内置词库（1800 多条），只读，别直接改里面的对象 */
export const BUILTIN_WORDS: readonly Word[] = (raw as unknown as RawWord[]).map(normalizeWord);

export interface DrawOptions {
  /** 候选词，默认内置词库；enabled === false 的会跳过 */
  pool?: readonly Word[];
  /** 只抽这些分类，空数组表示不限 */
  categories?: readonly string[];
  /** 位置 → 词，抽的时候这些位置保持不变 */
  locked?: ReadonlyMap<number, Word>;
  rng?: Rng;
}

/** 抽 count 个不重复的词。候选不够时返回的会少于 count 个 */
export function drawWords(count: number, { pool = BUILTIN_WORDS, categories = [], locked, rng = Math.random }: DrawOptions = {}): Word[] {
  const result: (Word | undefined)[] = new Array(count);
  const used = new Set<string>();
  locked?.forEach((w, i) => {
    if (i < count) { result[i] = w; used.add(w.id); }
  });
  const available = pool.filter(w =>
    w.enabled !== false && !used.has(w.id) && (categories.length === 0 || categories.includes(w.category)));
  for (let i = 0; i < count && available.length > 0; i++) {
    if (!result[i]) result[i] = available.splice(Math.floor(rng() * available.length), 1)[0];
  }
  return result.filter((w): w is Word => !!w);
}

/** 抽一个写作风格；pool 为空或只有「通用」时从全部题材里抽 */
export function pickGenre(pool: readonly Genre[] = FICTION_GENRES, rng: Rng = Math.random): Genre {
  const candidates = pool.filter(g => g !== '通用');
  return pickOne(candidates.length > 0 ? candidates : FICTION_GENRES, rng)!;
}

export interface ParsedWord {
  text: string;
  explanation: string;
  /** 文件里写的分类原文，可能是新分类 */
  category: string;
}

/**
 * 解析用户导入的词表。
 * md / txt 每行一条：`[分类]（词语）：（释义）`、`[分类](词语):(释义)`、`[分类] 词语：释义`，
 * 也接受只写一个词（分类记为「通用」）。json 是 `{ text, explanation?, category? }[]`，格式不对会抛错。
 */
export function parseWordList(content: string, format: 'md' | 'json'): ParsedWord[] {
  if (format === 'json') {
    const data: unknown = JSON.parse(content);
    if (!Array.isArray(data)) throw new Error('Invalid JSON format');
    return data
      .filter((item): item is Record<string, unknown> => !!item && typeof item.text === 'string')
      .map(item => ({
        text: (item.text as string).trim(),
        explanation: String(item.explanation || '').trim(),
        category: String(item.category || item.genre || '意象').trim(),
      }));
  }

  const patterns = [
    /^\[([^\]]+)\][（(]([^）)]+)[）)][：:][（(]([^）)]*)[）)]$/, // [分类]（词语）：（释义）
    /^\[([^\]]+)\][（(]([^）)]+)[）)][：:](.*)$/,                // [分类]（词语）：释义
    /^\[([^\]]+)\]\s*([^\s：:]+)\s*[：:]\s*(.*)$/,               // [分类] 词语：释义
  ];
  const items: ParsedWord[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('---')) continue;
    const m = patterns.map(re => line.match(re)).find(m => m && m[2].trim());
    if (m) items.push({ text: m[2].trim(), explanation: (m[3] || '').trim(), category: m[1].trim() });
    else if (line.length <= 20 && !line.includes(' ')) items.push({ text: line, explanation: '', category: '通用' });
  }
  return items;
}

/** 导出成 parseWordList 能读回来的 md */
export function formatWordListMd(words: readonly Pick<Word, 'text' | 'explanation' | 'category'>[]): string {
  return words.map(w => `[${w.category}]（${w.text}）${w.explanation ? `：（${w.explanation}）` : ''}`).join('\n');
}
