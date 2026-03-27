import { db } from '../db';
import type { Word, WordSet, Draft, WritingMode, PromptFavorite, PromptFavoriteModule } from '../types';

export async function saveDraftToDb(
  title: string,
  content: string,
  currentWords: Word[],
  existingWordSetId: string | null,
  existingDraftId: string | null,
  drawnGenre?: string | null,
  writingMode?: WritingMode | null,
  sceneId?: string | null,
  challengeId?: string | null,
  characterPromptId?: string | null,
): Promise<{ wordSetId: string; draftId: string }> {
  
  let wordSetId = existingWordSetId;
  const now = new Date();

  // Create WordSet if it doesn't exist yet for these drawn words
  if (!wordSetId && currentWords.length > 0) {
    wordSetId = `ws_${Date.now()}`;
    const wordSet: WordSet = {
      id: wordSetId,
      words: currentWords,
      genre: drawnGenre || currentWords[0]?.genres?.[0] || '通用',
      createdAt: now,
      isFavorite: false,
      hasWritten: true,
    };
    await db.wordSets.put(wordSet);
  } else if (!wordSetId) {
     // User hit save but never drew words, so no words are associated. 
     wordSetId = `ws_empty_${Date.now()}`;
     await db.wordSets.put({
       id: wordSetId,
       words: [],
       genre: drawnGenre || '通用',
       createdAt: now,
       isFavorite: false,
       hasWritten: true,
     });
  }

  let draftId = existingDraftId;
  const wordCount = content.replace(/\s+/g, '').length; // Simple Chinese word count

  if (draftId) {
    // Update existing draft; if it was hard-deleted (update returns 0), fall back to creating a new one
    const updated = await db.drafts.update(draftId, {
      wordSetId,
      title,
      content,
      wordCount,
      writingMode: writingMode || undefined,
      sceneId: sceneId || undefined,
      challengeId: challengeId || undefined,
      characterPromptId: characterPromptId || undefined,
      updatedAt: now,
    });
    if (updated === 0) {
      draftId = `draft_${Date.now()}`;
      const draft: Draft = {
        id: draftId,
        wordSetId,
        title,
        content,
        wordCount,
        createdAt: now,
        updatedAt: now,
        writingMode: writingMode || undefined,
        sceneId: sceneId || undefined,
        challengeId: challengeId || undefined,
        characterPromptId: characterPromptId || undefined,
      };
      await db.drafts.put(draft);
    }
  } else {
    // Create new draft
    draftId = `draft_${Date.now()}`;
    const draft: Draft = {
      id: draftId,
      wordSetId,
      title,
      content,
      wordCount,
      createdAt: now,
      updatedAt: now,
      writingMode: writingMode || undefined,
      sceneId: sceneId || undefined,
      challengeId: challengeId || undefined,
      characterPromptId: characterPromptId || undefined,
    };
    await db.drafts.put(draft);
  }

  return { wordSetId, draftId };
}

export async function toggleFavoriteWordSet(
  currentWords: Word[],
  existingWordSetId: string | null,
  currentFavoriteStatus: boolean
): Promise<{ wordSetId: string; isFavorite: boolean }> {
  let wordSetId = existingWordSetId;
  const newFavoriteStatus = !currentFavoriteStatus;
  
  if (!wordSetId) {
    if (currentWords.length === 0) return { wordSetId: existingWordSetId || '', isFavorite: currentFavoriteStatus };
    wordSetId = `ws_${Date.now()}`;
    const wordSet: WordSet = {
      id: wordSetId,
      words: currentWords,
      genre: currentWords[0]?.genres?.[0] || '通用',
      createdAt: new Date(),
      isFavorite: newFavoriteStatus,
      hasWritten: false,
    };
    await db.wordSets.put(wordSet);
  } else {
    await db.wordSets.update(wordSetId, { isFavorite: newFavoriteStatus });
  }
  
  return { wordSetId, isFavorite: newFavoriteStatus };
}

export async function isPromptFavorited(module: PromptFavoriteModule, itemId: string): Promise<boolean> {
  const id = `pf_${module}_${itemId}`;
  const hit = await db.promptFavorites.get(id);
  return !!hit;
}

export async function togglePromptFavorite(
  entry: Omit<PromptFavorite, 'id' | 'createdAt'>
): Promise<boolean> {
  const id = `pf_${entry.module}_${entry.itemId}`;
  const existing = await db.promptFavorites.get(id);
  if (existing) {
    await db.promptFavorites.delete(id);
    return false;
  }
  await db.promptFavorites.put({
    ...entry,
    id,
    createdAt: new Date(),
  });
  return true;
}
