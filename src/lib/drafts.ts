import { db } from '../db';
import { SCENE_PROMPTS } from '../inspire';
import type { ScenePrompt, Word } from '../inspire';
import type { WordSet, Draft, WritingMode, PromptFavorite, PromptFavoriteModule } from '../types';
import { countChars, hasMeaningfulContent } from './util';

/** 历史遗留的空梦境稿（进梦境模式就自动建的那种） */
export function isGhostDreamDraft(draft: Pick<Draft, 'writingMode' | 'content' | 'wordCount'>) {
  return draft.writingMode === 'dream' && !hasMeaningfulContent(draft.content) && (draft.wordCount ?? 0) === 0;
}

/**
 * 启动时修旧数据：
 * - 老版本没有 writingMode 的稿子，按有没有挂词条补成 words / free
 * - v0.1.13–0.1.14 把 AI 生成的场景以 `scene_ai_…` 的 id 写进了收藏表，和收藏按钮用的 `pf_scene_…` 对不上，
 *   改成正规 id（当作已收藏，不删，免得丢了看中的场景）
 */
export async function migrateLegacyData() {
  try {
    const legacy = (await db.drafts.toArray()).filter(d => !d.writingMode);
    for (const d of legacy) {
      const wordSet = d.wordSetId ? await db.wordSets.get(d.wordSetId) : undefined;
      await db.drafts.update(d.id, { writingMode: wordSet && wordSet.words.length > 0 ? 'words' : 'free' });
    }
    if (legacy.length > 0) console.log(`✨ 成功迁移了 ${legacy.length} 篇老版本草稿数据`);

    const strayScenes = await db.promptFavorites.filter(f => f.id.startsWith('scene_')).toArray();
    for (const f of strayScenes) {
      await db.promptFavorites.put({ ...f, id: `pf_scene_${f.itemId}` });
      await db.promptFavorites.delete(f.id);
    }
  } catch (e) {
    console.error('Legacy data migration failed', e);
  }
}

/** 按 id 找场景：内置的直接给，AI 生成的只有收藏过才找得回来 */
export async function findScene(id: string): Promise<ScenePrompt | null> {
  const builtin = SCENE_PROMPTS.find(s => s.id === id);
  if (builtin) return builtin;
  const fav = await db.promptFavorites.get(`pf_scene_${id}`);
  return fav ? { id, title: fav.title, description: fav.description ?? '', tags: fav.tags ?? [] } : null;
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
