import builtinWords from '../data/words.json';
import type { Word, Genre } from '../types';

let allWords: Word[] = [...(builtinWords as Word[])];

export function getAllWords(): Word[] {
  return allWords;
}

export function getWordsByGenres(genres: Genre[]): Word[] {
  if (genres.length === 0) return allWords.filter(w => w.enabled !== false);
  return allWords.filter(w => w.enabled !== false && (genres.includes(w.genre) || w.genre === '通用'));
}

export function drawRandomWords(count: number, genres: Genre[], locked: Map<number, Word>): Word[] {
  const pool = getWordsByGenres(genres);
  const result: Word[] = new Array(count);
  const usedIds = new Set<string>();

  // Place locked words
  locked.forEach((word, idx) => {
    if (idx < count) {
      result[idx] = word;
      usedIds.add(word.id);
    }
  });

  // Fill remaining slots
  const available = pool.filter(w => !usedIds.has(w.id));
  for (let i = 0; i < count; i++) {
    if (result[i]) continue;
    if (available.length === 0) break;
    const idx = Math.floor(Math.random() * available.length);
    result[i] = available[idx];
    usedIds.add(available[idx].id);
    available.splice(idx, 1);
  }

  return result;
}

export function addUserWord(word: Omit<Word, 'id' | 'source' | 'enabled'>): Word {
  const newWord: Word = {
    ...word,
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: 'user',
    enabled: true,
  };
  allWords.push(newWord);
  saveUserWords();
  return newWord;
}

export function updateUserWord(id: string, updates: Partial<Word>) {
  const idx = allWords.findIndex(w => w.id === id);
  if (idx !== -1 && allWords[idx].source === 'user') {
    allWords[idx] = { ...allWords[idx], ...updates };
    saveUserWords();
  }
}

export function deleteUserWord(id: string) {
  allWords = allWords.filter(w => w.id !== id || w.source !== 'user');
  saveUserWords();
}

export function toggleWordEnabled(id: string) {
  const idx = allWords.findIndex(w => w.id === id);
  if (idx !== -1) {
    allWords[idx].enabled = !allWords[idx].enabled;
    if (allWords[idx].source === 'user') saveUserWords();
    else saveDisabledBuiltins();
  }
}

function saveUserWords() {
  const userWords = allWords.filter(w => w.source === 'user');
  localStorage.setItem('writemore_user_words', JSON.stringify(userWords));
}

function saveDisabledBuiltins() {
  const disabled = allWords.filter(w => w.source === 'builtin' && !w.enabled).map(w => w.id);
  localStorage.setItem('writemore_disabled_builtins', JSON.stringify(disabled));
}

export function loadUserData() {
  try {
    const userStr = localStorage.getItem('writemore_user_words');
    if (userStr) {
      const userWords: Word[] = JSON.parse(userStr);
      allWords = [...(builtinWords as Word[]), ...userWords];
    }
    const disabledStr = localStorage.getItem('writemore_disabled_builtins');
    if (disabledStr) {
      const disabled: string[] = JSON.parse(disabledStr);
      const set = new Set(disabled);
      allWords.forEach(w => {
        if (set.has(w.id)) w.enabled = false;
      });
    }
  } catch (e) {
    console.error('Failed to load user data', e);
  }
}
