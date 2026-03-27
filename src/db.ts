import Dexie, { type Table } from 'dexie';
import type { Word, WordSet, Draft, PromptFavorite } from './types';
import type { WritingChallenge } from './data/challenges';
import type { CharacterPrompt } from './data/characterPrompts';

export class WriteMoreDB extends Dexie {
  words!: Table<Word>;
  wordSets!: Table<WordSet>;
  drafts!: Table<Draft>;
  promptFavorites!: Table<PromptFavorite>;
  challenges!: Table<WritingChallenge>;
  characterPrompts!: Table<CharacterPrompt>;

  constructor() {
    super('writemore');
    this.version(1).stores({
      words: 'id, text, genre, source, enabled',
      wordSets: 'id, createdAt, isFavorite, hasWritten, genre',
      drafts: 'id, wordSetId, updatedAt',
    });
    this.version(2).stores({
      words: 'id, text, genre, source, enabled',
      wordSets: 'id, createdAt, isFavorite, hasWritten, genre',
      drafts: 'id, wordSetId, updatedAt, writingMode',
    });
    this.version(3).stores({
      words: 'id, text, genre, source, enabled',
      wordSets: 'id, createdAt, isFavorite, hasWritten, genre',
      drafts: 'id, wordSetId, updatedAt, writingMode',
      challenges: 'id, source',
    });
    this.version(4).stores({
      words: 'id, text, genre, source, enabled',
      wordSets: 'id, createdAt, isFavorite, hasWritten, genre',
      drafts: 'id, wordSetId, updatedAt, writingMode',
      challenges: 'id, source',
      characterPrompts: 'id, layer, source',
    });
    this.version(5).stores({
      words: 'id, text, genre, source, enabled',
      wordSets: 'id, createdAt, isFavorite, hasWritten, genre',
      drafts: 'id, wordSetId, updatedAt, writingMode',
      challenges: 'id, source',
      characterPrompts: 'id, layer, source',
      promptFavorites: 'id, module, itemId, createdAt, isAi',
    });
  }
}

export const db = new WriteMoreDB();
