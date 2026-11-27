// 写作流程：选模式、抽词、换题、保存。直接读写 store，哪个组件都能调。
import { useStore } from '../store';
import { db } from '../db';
import { drawWords, pickGenre, pickScene, pickChallenge, pickCharacterPrompt } from '../inspire';
import type { CharacterLayerId, Word } from '../inspire';
import type { WritingMode } from '../types';
import { pushDraft, SUPABASE_ENABLED } from '../services/supabase';
import { getAllWords } from './wordLibrary';
import { saveDraftToDb, toggleFavoriteWordSet } from './drafts';
import { countChars, dayKey, hasMeaningfulContent } from './util';
import { playCardShuffle, playCarriageReturn } from './soundEngine';

const st = () => useStore.getState();

let saving = false;
// 每开一轮新抽词 / 切模式就 +1；保存途中发现变了，就不把旧稿 id 写回去
let session = 0;

function mergeAiFeedback(content: string, feedback: string) {
  const f = feedback.trim();
  if (!f || content.includes('（AI点评：')) return content;
  return `${content}\n\n（AI点评：\n${f}\n）`;
}

export async function saveDraft() {
  if (saving) return;
  const s = st();
  const content = mergeAiFeedback(s.editorContent, s.aiFeedback);
  // 只有标题不算（标题可能是自动生成的）
  if (!hasMeaningfulContent(content)) return;
  saving = true;
  const startedAt = session;
  try {
    const { wordSetId, draftId } = await saveDraftToDb({
      title: s.editorTitle || '未命名灵感',
      content,
      words: s.currentWords,
      wordSetId: s.currentWordSetId,
      draftId: s.currentDraftId,
      genre: s.drawnGenre,
      mode: s.writingMode,
      sceneId: s.currentScene?.id,
      challengeId: s.currentChallenge?.id,
      characterPromptId: s.currentCharacterPrompt?.id,
    });
    if (session === startedAt) {
      s.setCurrentWordSetId(wordSetId);
      s.setCurrentDraftId(draftId);
    }
    s.showToast(`💾 已保存 (${countChars(content)}字)`);
    if (SUPABASE_ENABLED && s.cloudUser) {
      const saved = await db.drafts.get(draftId);
      if (saved) pushDraft(saved, s.cloudUser.id).catch(console.error);
    }
  } catch (e) {
    console.error('Failed to save draft', e);
  } finally {
    saving = false;
  }
}

function saveIfDirty() {
  if (hasMeaningfulContent(st().editorContent)) void saveDraft();
}

/** 清空编辑器，断开和旧稿、旧词组的关联 */
function resetEditor() {
  const s = st();
  session++;
  s.setAiFeedback('');
  s.setEditorTitle('');
  s.setEditorContent('');
  s.setCurrentWordSetId(null);
  s.setCurrentDraftId(null);
  s.setIsCurrentWordSetFavorite(false);
}

function clearPrompts() {
  const s = st();
  // 风格是词汇模式抽的，别的模式看不到它，也就别让它混进 AI 出题
  s.setDrawnGenre(null);
  s.setCurrentWords([]);
  s.setCurrentScene(null);
  s.setCurrentChallenge(null);
  s.setCurrentCharacterPrompt(null);
  s.setSelectedCharacterLayer(null);
}

export function startMode(mode: WritingMode) {
  saveIfDirty();
  resetEditor();
  const s = st();
  s.setWritingMode(mode);
  if (mode === 'words') {
    drawNewWords();
    return;
  }
  clearPrompts();
  if (mode === 'scene') s.setCurrentScene(pickScene());
  else if (mode === 'dream') s.setEditorTitle('梦境记录 · ' + new Date().toLocaleDateString('zh-CN'));
  else if (mode === 'challenge') void pickNextChallenge();
  else if (mode === 'character') void pickNextCharacterPrompt();
}

/** 首页按钮：先存再回模式选择 */
export function backToHome() {
  saveIfDirty();
  resetEditor();
  st().setWritingMode(null);
  clearPrompts();
}

/** 从别的标签页回到「灵感」：回模式选择，编辑器内容留着（下次进模式时会先存） */
export function exitWriting() {
  st().setAiFeedback('');
  st().setWritingMode(null);
  clearPrompts();
}

/** 抽一组新词，锁定的位置保留。词卡翻到侧面（300ms）时换字，600ms 翻完 */
export function drawNewWords() {
  session++;
  const s = st();
  const locked = new Map<number, Word>();
  s.lockedIndices.forEach(i => {
    if (s.currentWords[i]) locked.set(i, s.currentWords[i]);
  });
  const words = drawWords(s.wordCount, { pool: getAllWords(), categories: s.selectedCategories, locked });
  playCardShuffle();
  s.setWordsFlipping(true);
  setTimeout(() => {
    // 新的一组词就是新灵感，和之前打开的稿子、词组断开
    s.setCurrentWordSetId(null);
    s.setCurrentDraftId(null);
    s.setIsCurrentWordSetFavorite(false);
    s.setCurrentWords(words);
    s.setDrawnGenre(pickGenre());
    s.updateStreak();
  }, 300);
  setTimeout(() => s.setWordsFlipping(false), 600);
}

/** 拆今日盲盒：三个词 + 随机一道场景或挑战题，存进 store，一天一次 */
export function openDailyBox() {
  const s = st();
  const words = drawWords(3, { pool: getAllWords() });
  s.setDailyBoxData(Math.random() > 0.5
    ? { words, promptType: 'scene', promptData: pickScene() }
    : { words, promptType: 'challenge', promptData: pickChallenge()! });
  s.setDailyBoxOpenedDate(dayKey());
  playCarriageReturn(true);
  s.showToast('📮 今日灵感电报已拆封！');
}

/** 用今天的盲盒开写 */
export function startDailyBox() {
  const data = st().dailyBoxData;
  if (!data) return;
  saveIfDirty();
  resetEditor();
  clearPrompts();
  const s = st();
  s.clearLocks();
  s.setCurrentWords(data.words);
  if (data.promptType === 'scene') {
    s.setWritingMode('scene');
    s.setCurrentScene(data.promptData);
  } else {
    s.setWritingMode('challenge');
    s.setCurrentChallenge(data.promptData);
  }
  s.showToast('✍️ 开始今日限定挑战！');
}

export async function pickNextChallenge(exclude?: string) {
  const extra = await db.challenges.toArray();
  st().setCurrentChallenge(pickChallenge({ extra, exclude }));
}

export async function pickNextCharacterPrompt(exclude?: string, layer: CharacterLayerId | null = st().selectedCharacterLayer) {
  const extra = await db.characterPrompts.toArray();
  st().setCurrentCharacterPrompt(pickCharacterPrompt({ layer, extra, exclude }));
}

export async function toggleWordSetFavorite() {
  const s = st();
  if (s.currentWords.length === 0) return;
  try {
    const { wordSetId, isFavorite } = await toggleFavoriteWordSet(s.currentWords, s.currentWordSetId, s.isCurrentWordSetFavorite);
    s.setCurrentWordSetId(wordSetId);
    s.setIsCurrentWordSetFavorite(isFavorite);
    s.showToast(isFavorite ? '⭐ 已收藏本组词条' : '取消收藏');
  } catch (e) {
    console.error('Failed to toggle favorite', e);
  }
}
