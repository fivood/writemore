import Dexie, { type Table } from 'dexie';
import type { Word, WordSet, Draft } from './types';

export class WriteMoreDB extends Dexie {
  words!: Table<Word>;
  wordSets!: Table<WordSet>;
  drafts!: Table<Draft>;

  constructor() {
    super('writemore');
    this.version(1).stores({
      words: 'id, text, genre, source, enabled',
      wordSets: 'id, createdAt, isFavorite, hasWritten, genre',
      drafts: 'id, wordSetId, updatedAt',
    });
  }
}

export const db = new WriteMoreDB();
