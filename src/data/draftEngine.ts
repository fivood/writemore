import { db } from '../db';
import type { Word, WordSet, Draft } from '../types';

export async function saveDraftToDb(
  title: string,
  content: string,
  currentWords: Word[],
  existingWordSetId: string | null,
  existingDraftId: string | null
): Promise<{ wordSetId: string; draftId: string }> {
  
  let wordSetId = existingWordSetId;
  const now = new Date();

  // Create WordSet if it doesn't exist yet for these drawn words
  if (!wordSetId && currentWords.length > 0) {
    wordSetId = `ws_${Date.now()}`;
    const wordSet: WordSet = {
      id: wordSetId,
      words: currentWords,
      genre: currentWords[0]?.genre || '通用',
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
       genre: '通用',
       createdAt: now,
       isFavorite: false,
       hasWritten: true,
     });
  }

  let draftId = existingDraftId;
  const wordCount = content.replace(/\s+/g, '').length; // Simple Chinese word count

  if (draftId) {
    // Update existing draft
    await db.drafts.update(draftId, {
      title,
      content,
      wordCount,
      updatedAt: now,
    });
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
      genre: currentWords[0]?.genre || '通用',
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
