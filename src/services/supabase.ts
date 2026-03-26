/**
 * Supabase 服务层 — 用户认证 + 数据云同步
 */
import { createClient } from '@supabase/supabase-js';
import type { Draft, WordSet } from '../types';

// 构建时从环境变量注入（本地填 .env.local，Actions 用 Secrets）
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? '';

/** 凭据为空时云功能全部禁用，用户纯本地使用 */
export const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null as unknown as ReturnType<typeof createClient>;

// ── 认证 ──────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

// ── Draft 同步 ────────────────────────────────────────────

function draftToRow(draft: Draft, userId: string) {
  return {
    id: draft.id,
    user_id: userId,
    title: draft.title,
    content: draft.content,
    word_count: draft.wordCount,
    writing_mode: draft.writingMode ?? null,
    word_set_id: draft.wordSetId ?? null,
    scene_id: draft.sceneId ?? null,
    challenge_id: draft.challengeId ?? null,
    character_prompt_id: draft.characterPromptId ?? null,
    deleted_from_palace: draft.deletedFromPalace ?? false,
    created_at: draft.createdAt instanceof Date ? draft.createdAt.toISOString() : draft.createdAt,
    updated_at: draft.updatedAt instanceof Date ? draft.updatedAt.toISOString() : draft.updatedAt,
  };
}

function rowToDraft(row: Record<string, unknown>): Draft {
  return {
    id: row.id as string,
    wordSetId: (row.word_set_id as string) ?? '',
    title: row.title as string,
    content: row.content as string,
    wordCount: row.word_count as number,
    writingMode: row.writing_mode as Draft['writingMode'],
    sceneId: row.scene_id as string | undefined,
    challengeId: row.challenge_id as string | undefined,
    characterPromptId: row.character_prompt_id as string | undefined,
    deletedFromPalace: (row.deleted_from_palace as boolean) ?? false,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/** 推送单条 draft 到云端（upsert） */
export async function pushDraft(draft: Draft, userId: string): Promise<void> {
  const { error } = await supabase.from('drafts').upsert(draftToRow(draft, userId));
  if (error) throw error;
}

/** 拉取云端所有 drafts */
export async function pullDrafts(userId: string): Promise<Draft[]> {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => rowToDraft(r as Record<string, unknown>));
}

// ── WordSet 同步 ───────────────────────────────────────────

function wordSetToRow(ws: WordSet, userId: string) {
  return {
    id: ws.id,
    user_id: userId,
    words: ws.words,
    genre: ws.genre,
    is_favorite: ws.isFavorite,
    has_written: ws.hasWritten,
    created_at: ws.createdAt instanceof Date ? ws.createdAt.toISOString() : ws.createdAt,
  };
}

function rowToWordSet(row: Record<string, unknown>): WordSet {
  return {
    id: row.id as string,
    words: row.words as WordSet['words'],
    genre: row.genre as string,
    isFavorite: (row.is_favorite as boolean) ?? false,
    hasWritten: (row.has_written as boolean) ?? false,
    createdAt: new Date(row.created_at as string),
  };
}

export async function pushWordSet(ws: WordSet, userId: string): Promise<void> {
  const { error } = await supabase.from('word_sets').upsert(wordSetToRow(ws, userId));
  if (error) throw error;
}

export async function pullWordSets(userId: string): Promise<WordSet[]> {
  const { data, error } = await supabase
    .from('word_sets')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(r => rowToWordSet(r as Record<string, unknown>));
}
