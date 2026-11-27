// 写作页的 AI 按钮。提示词在 ../inspire/prompts.ts，请求在 ../services/ai.ts。
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { db } from '../db';
import {
  BUILTIN_CHALLENGES, BUILTIN_CHARACTER_PROMPTS, CHARACTER_LAYERS, parseAiScene, parsePromptLines,
  buildWordInspirationPrompt, buildSceneGeneratePrompt, buildSceneDeepDivePrompt, buildChallengeGeneratePrompt,
  buildCharacterDeepPrompt, buildCharacterGeneratePrompt, buildContinueWritingPrompt, buildWritingFeedbackPrompt,
  buildDreamInterpretationPrompt,
} from '../inspire';
import type { CharacterPrompt, WritingChallenge } from '../inspire';
import { chatCompletion, chatCompletionStream } from '../services/ai';
import { countChars } from '../lib/util';

type Action = 'wordHint' | 'sceneGenerate' | 'sceneDeepDive' | 'challenge' | 'characterDeep' | 'characterGenerate'
  | 'continue' | 'feedback' | 'dream';

/** 结果记下是针对哪个题目/哪组词的，题目一换就自然不显示了 */
type Keyed = { key: string; text: string };
const EMPTY: Keyed = { key: '', text: '' };
const shown = (v: Keyed, key: string) => (v.key === key ? v.text : '');

export function useAiAssist() {
  const store = useStore();
  const { aiConfig, showToast } = store;
  const wordsKey = store.currentWords.map(w => w.id).join(',');
  const sceneKey = store.currentScene?.id ?? '';
  const characterKey = store.currentCharacterPrompt?.id ?? '';

  const [busy, setBusy] = useState<Action | null>(null);
  const [wordHint, setWordHint] = useState<Keyed>(EMPTY);
  const [sceneExtra, setSceneExtra] = useState<Keyed>(EMPTY);
  const [characterExtra, setCharacterExtra] = useState<Keyed>(EMPTY);
  const [dreamInterpret, setDreamInterpret] = useState('');
  // 这一轮 AI 出的候选题（离开写作页就清空），以及其中已经存进题库的
  const [challengeCandidates, setChallengeCandidates] = useState<WritingChallenge[]>([]);
  const [characterCandidates, setCharacterCandidates] = useState<CharacterPrompt[]>([]);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set());

  // 同一时间只跑一个 AI 请求（用 ref 防连点）；离开写作页时取消进行中的请求
  const lockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(action: Action, failMsg: string, task: (signal: AbortSignal) => Promise<void>) {
    if (!store.aiEnabled || lockRef.current) return;
    lockRef.current = true;
    setBusy(action);
    abortRef.current?.abort();
    const { signal } = (abortRef.current = new AbortController());
    try {
      await task(signal);
    } catch (e) {
      if (!signal.aborted) showToast(failMsg);
      console.error(e);
    } finally {
      lockRef.current = false;
      setBusy(null);
    }
  }

  const ask = (msgs: Parameters<typeof chatCompletion>[1], signal: AbortSignal) => chatCompletion(aiConfig, msgs, { signal });

  const wordHintRun = () => store.currentWords.length > 0 && run('wordHint', 'AI 生成失败，请检查设置', async signal => {
    setWordHint(EMPTY);
    const key = wordsKey;
    setWordHint({ key, text: await ask(buildWordInspirationPrompt(store.currentWords, store.drawnGenre), signal) });
  });

  const sceneGenerate = () => run('sceneGenerate', 'AI 场景生成失败', async signal => {
    const scene = parseAiScene(await ask(buildSceneGeneratePrompt({ current: store.currentScene }), signal));
    if (!scene) throw new Error('AI 返回的场景格式不对');
    store.setCurrentScene({ id: `ai_${Date.now()}`, ...scene });
  });

  const sceneDeepDive = () => store.currentScene && run('sceneDeepDive', 'AI 生成失败', async signal => {
    const scene = store.currentScene!;
    setSceneExtra(EMPTY);
    setSceneExtra({ key: scene.id, text: await ask(buildSceneDeepDivePrompt(scene.title, scene.description), signal) });
  });

  const challengeGenerate = () => run('challenge', 'AI 出题失败', async signal => {
    const pool = [...BUILTIN_CHALLENGES, ...await db.challenges.toArray()];
    const msgs = buildChallengeGeneratePrompt({ pool, current: store.currentChallenge?.text, genre: store.drawnGenre });
    const lines = parsePromptLines(await ask(msgs, signal));
    if (lines.length === 0) return;
    // 先当候选，不进题库；看中的再点「存进题库」
    const candidates = lines.map((text, i) => ({ id: `ai_${Date.now()}_${i}`, text, source: 'user' as const }));
    setChallengeCandidates(candidates);
    store.setCurrentChallenge(candidates[0]);
    showToast(`✨ AI 出了 ${lines.length} 道题，看中的点「存进题库」`);
  });

  const characterDeep = () => store.currentCharacterPrompt && run('characterDeep', 'AI 生成失败', async signal => {
    const prompt = store.currentCharacterPrompt!;
    setCharacterExtra(EMPTY);
    const layerName = CHARACTER_LAYERS.find(l => l.id === prompt.layer)?.name || '';
    setCharacterExtra({ key: prompt.id, text: await ask(buildCharacterDeepPrompt(prompt.text, layerName), signal) });
  });

  const characterGenerate = () => run('characterGenerate', 'AI 出题失败', async signal => {
    const layerId = store.currentCharacterPrompt?.layer ?? store.selectedCharacterLayer ?? 'inner';
    const layer = CHARACTER_LAYERS.find(l => l.id === layerId) || CHARACTER_LAYERS[0];
    const pool = [...BUILTIN_CHARACTER_PROMPTS, ...await db.characterPrompts.toArray()];
    const lines = parsePromptLines(await ask(buildCharacterGeneratePrompt({ layer, genre: store.drawnGenre, pool }), signal));
    if (lines.length === 0) return;
    const candidates = lines.map((text, i) => ({ id: `ai_cp_${Date.now()}_${i}`, text, layer: layer.id, source: 'user' as const }));
    setCharacterCandidates(candidates);
    store.setCurrentCharacterPrompt(candidates[0]);
    showToast(`✨ AI 出了 ${lines.length} 道角色题，看中的点「存进题库」`);
  });

  /** 候选题存进题库（之后随机抽题也会抽到它） */
  async function saveToBank(item: WritingChallenge | CharacterPrompt) {
    try {
      if ('layer' in item) await db.characterPrompts.put(item);
      else await db.challenges.put(item);
      setSavedIds(s => new Set(s).add(item.id));
      showToast('📥 已存进题库');
    } catch (e) {
      console.error('Failed to save AI prompt', e);
      showToast('存进题库失败');
    }
  }
  const isCandidate = (id: string) => [...challengeCandidates, ...characterCandidates].some(c => c.id === id);

  const continueWriting = () => store.editorContent.trim() && run('continue', 'AI 续写失败', async signal => {
    const base = store.editorContent;
    const prefix = '\n\n---\n\n### AI 续写\n\n';
    if (countChars(base) > 600) showToast('📝 AI 仅参考最后 600 字进行续写');
    let text = '';
    let rafId = 0;
    // 用 rAF 节流，避免每个 token 都触发重渲染
    await chatCompletionStream(aiConfig, buildContinueWritingPrompt(store.editorTitle, base, store.writingMode), chunk => {
      text += chunk;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => store.setEditorContent(base + prefix + text));
    }, { signal });
    cancelAnimationFrame(rafId);
    store.setEditorContent(base + prefix + text);
  });

  const feedbackRun = () => store.editorContent.trim() && run('feedback', 'AI 反馈失败', async signal => {
    store.setAiFeedback('');
    if (countChars(store.editorContent) > 800) showToast('📝 AI 仅分析前 800 字');
    store.setAiFeedback(await ask(buildWritingFeedbackPrompt(store.editorTitle, store.editorContent), signal));
  });

  const dreamInterpretRun = () => store.editorContent.trim() && run('dream', 'AI 解梦失败', async signal => {
    setDreamInterpret('');
    setDreamInterpret(await ask(buildDreamInterpretationPrompt(store.editorTitle, store.editorContent), signal));
  });

  return {
    enabled: store.aiEnabled,
    wordHint: shown(wordHint, wordsKey), wordHintLoading: busy === 'wordHint', wordHintRun,
    sceneExtra: shown(sceneExtra, sceneKey), sceneLoading: busy === 'sceneGenerate' || busy === 'sceneDeepDive', sceneGenerate, sceneDeepDive,
    challengeLoading: busy === 'challenge', challengeGenerate, challengeCandidates,
    characterExtra: shown(characterExtra, characterKey), characterLoading: busy === 'characterDeep', characterDeep,
    characterGenLoading: busy === 'characterGenerate', characterGenerate, characterCandidates,
    /** 这道题是 AI 刚出的、还没存进题库 */
    unsaved: (id: string) => isCandidate(id) && !savedIds.has(id),
    saveToBank,
    continueLoading: busy === 'continue', continueWriting,
    feedback: store.aiFeedback, feedbackLoading: busy === 'feedback', feedbackRun, clearFeedback: () => store.setAiFeedback(''),
    dreamInterpret, dreamLoading: busy === 'dream', dreamInterpretRun, clearDreamInterpret: () => setDreamInterpret(''),
  };
}

export type AiAssist = ReturnType<typeof useAiAssist>;
