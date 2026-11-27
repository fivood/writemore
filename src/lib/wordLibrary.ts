// 词库 = 内置词 + 用户自建词，停用状态存在 localStorage（键名沿用旧版）
import { BUILTIN_WORDS, normalizeWord } from '../inspire';
import type { RawWord, Word } from '../inspire';

const USER_KEY = 'writemore_user_words';
const DISABLED_KEY = 'writemore_disabled_builtins';

function load(): Word[] {
  try {
    const user: RawWord[] = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
    const disabled = new Set<string>(JSON.parse(localStorage.getItem(DISABLED_KEY) || '[]'));
    return [
      ...BUILTIN_WORDS.map(w => (disabled.has(w.id) ? { ...w, enabled: false } : w)),
      ...user.map(normalizeWord),
    ];
  } catch (e) {
    console.error('Failed to load user data', e);
    return [...BUILTIN_WORDS];
  }
}

// 每次改动都换一个新数组，组件可以按引用判断有没有变
let words = load();

function commit(next: Word[]) {
  words = next;
  localStorage.setItem(USER_KEY, JSON.stringify(words.filter(w => w.source === 'user')));
  localStorage.setItem(DISABLED_KEY, JSON.stringify(words.filter(w => w.source === 'builtin' && !w.enabled).map(w => w.id)));
}

export function getAllWords(): Word[] {
  return words;
}

export function addUserWord(word: Omit<Word, 'id' | 'source' | 'enabled'>): Word {
  const w: Word = { ...word, id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, source: 'user', enabled: true };
  commit([...words, w]);
  return w;
}

export function updateUserWord(id: string, updates: Partial<Word>) {
  commit(words.map(w => (w.id === id && w.source === 'user' ? { ...w, ...updates } : w)));
}

export function deleteUserWord(id: string) {
  commit(words.filter(w => w.id !== id || w.source !== 'user'));
}

export function toggleWordEnabled(id: string) {
  commit(words.map(w => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
}
