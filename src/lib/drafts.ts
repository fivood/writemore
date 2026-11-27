import { db } from '../db';
import type { Word } from '../inspire';
import type { WordSet, Draft, WritingMode, PromptFavorite, PromptFavoriteModule } from '../types';
import { countChars, hasMeaningfulContent } from './util';

/** 历史遗留的空梦境稿（进梦境模式就自动建的那种） */
export function isGhostDreamDraft(draft: Pick<Draft, 'writingMode' | 'content' | 'wordCount'>) {
  return draft.writingMode === 'dream' && !hasMeaningfulContent(draft.content) && (draft.wordCount ?? 0) === 0;
}

/** 一次性迁移：老版本没有 writingMode 的稿子，按有没有挂词条补成 words / free */
export async function migrateLegacyDrafts() {
  try {
    const legacy = (await db.drafts.toArray()).filter(d => !d.writingMode);
    for (const d of legacy) {
      const wordSet = d.wordSetId ? await db.wordSets.get(d.wordSetId) : undefined;
      await db.drafts.update(d.id, { writingMode: wordSet && wordSet.words.length > 0 ? 'words' : 'free' });
    }
    if (legacy.length > 0) console.log(`✨ 成功迁移了 ${legacy.length} 篇老版本草稿数据`);
  } catch (e) {
    console.error('Legacy drafts migration failed', e);
  }
}

export interface SaveDraftInput {
  title: string;
  content: string;
  words: Word[];
  wordSetId: string | null;
  draftId: string | null;
  genre?: string | null;
  mode?: WritingMode | null;
  sceneId?: string | null;
  challengeId?: string | null;
  characterPromptId?: string | null;
}

export async function saveDraftToDb(input: SaveDraftInput): Promise<{ wordSetId: string; draftId: string }> {
  const { title, content, words, genre } = input;
  const now = new Date();
  let wordSetId = input.wordSetId;

  // 每篇稿子都挂一个词组；没抽词就挂个空的
  if (!wordSetId) {
    wordSetId = words.length > 0 ? `ws_${Date.now()}` : `ws_empty_${Date.now()}`;
    await db.wordSets.put({
      id: wordSetId,
      words,
      genre: genre || words[0]?.genres?.[0] || '通用',
      createdAt: now,
      isFavorite: false,
      hasWritten: true,
    });
  }

  const fields = {
    wordSetId,
    title,
    content,
    wordCount: countChars(content),
    writingMode: input.mode || undefined,
    sceneId: input.sceneId || undefined,
    challengeId: input.challengeId || undefined,
    characterPromptId: input.characterPromptId || undefined,
    updatedAt: now,
  };

  // 已有稿子就更新；更新返回 0 说明被删了，当新稿存
  if (input.draftId && (await db.drafts.update(input.draftId, fields)) > 0) {
    return { wordSetId, draftId: input.draftId };
  }
  const draft: Draft = { id: `draft_${Date.now()}`, createdAt: now, ...fields };
  await db.drafts.put(draft);
  return { wordSetId, draftId: draft.id };
}

export async function toggleFavoriteWordSet(
  words: Word[],
  existingWordSetId: string | null,
  currentFavoriteStatus: boolean,
): Promise<{ wordSetId: string; isFavorite: boolean }> {
  const isFavorite = !currentFavoriteStatus;
  if (existingWordSetId) {
    await db.wordSets.update(existingWordSetId, { isFavorite });
    return { wordSetId: existingWordSetId, isFavorite };
  }
  if (words.length === 0) return { wordSetId: '', isFavorite: currentFavoriteStatus };
  const wordSet: WordSet = {
    id: `ws_${Date.now()}`,
    words,
    genre: words[0]?.genres?.[0] || '通用',
    createdAt: new Date(),
    isFavorite,
    hasWritten: false,
  };
  await db.wordSets.put(wordSet);
  return { wordSetId: wordSet.id, isFavorite };
}

export async function isPromptFavorited(module: PromptFavoriteModule, itemId: string): Promise<boolean> {
  return !!(await db.promptFavorites.get(`pf_${module}_${itemId}`));
}

export async function togglePromptFavorite(entry: Omit<PromptFavorite, 'id' | 'createdAt'>): Promise<boolean> {
  const id = `pf_${entry.module}_${entry.itemId}`;
  if (await db.promptFavorites.get(id)) {
    await db.promptFavorites.delete(id);
    return false;
  }
  await db.promptFavorites.put({ ...entry, id, createdAt: new Date() });
  return true;
}
