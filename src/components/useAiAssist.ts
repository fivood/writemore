// 写作页的 AI 按钮（从 App.tsx 原样搬来，提示词、调用方式、锁和中断都没改）
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { db } from '../db';
import { BUILTIN_CHARACTER_PROMPTS, CHARACTER_LAYERS } from '../inspire';
import type { CharacterLayerId } from '../inspire';
import { chatCompletion, chatCompletionStream } from '../services/ai';
import {
  buildWordInspirationPrompt, buildSceneGeneratePrompt, buildSceneDeepDivePrompt, buildChallengeGeneratePrompt,
  buildCharacterDeepPrompt, buildCharacterGeneratePrompt, buildContinueWritingPrompt, buildWritingFeedbackPrompt,
  buildDreamInterpretationPrompt,
} from '../services/prompts';

// 去掉模型偶尔加的序号和项目符号，如 "1. "、"①"、"- "、"• "、"（1）"
const stripPrefix = (s: string) => s.replace(/^[\s（（(]*[\d①②③一二三][\s.、.）).）]*/, '').replace(/^[-•*]\s*/, '').trim();

/** 从 AI 返回的文本中提取 JSON（兼容 markdown 代码块包裹） */
function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const braced = text.match(/\{[\s\S]*\}/);
  if (braced) return braced[0];
  return text;
}

/** 结果记下是针对哪个题目/哪组词的，题目一换就自然不显示了 */
type Keyed = { key: string; text: string };
const EMPTY: Keyed = { key: '', text: '' };
const shown = (v: Keyed, key: string) => (v.key === key ? v.text : '');

export function useAiAssist() {
  const store = useStore();
  const { showToast } = store;
  const wordsKey = store.currentWords.map(w => w.id).join(',');
  const sceneKey = store.currentScene?.id ?? '';
  const characterKey = store.currentCharacterPrompt?.id ?? '';

  const [wordHint, setWordHint] = useState<Keyed>(EMPTY);
  const [wordHintLoading, setWordHintLoading] = useState(false);
  const [sceneExtra, setSceneExtra] = useState<Keyed>(EMPTY);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [characterExtra, setCharacterExtra] = useState<Keyed>(EMPTY);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterGenLoading, setCharacterGenLoading] = useState(false);
  const [continueLoading, setContinueLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [dreamInterpret, setDreamInterpret] = useState('');
  const [dreamLoading, setDreamLoading] = useState(false);

  // 同一时间只跑一个 AI 请求；离开写作页时取消进行中的请求
  const lockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 创建新的 AbortController（自动取消上一个） */
  function newAiAbort(): AbortSignal {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  async function wordHintRun() {
    if (!store.aiEnabled || store.currentWords.length === 0 || lockRef.current) return;
    lockRef.current = true;
    setWordHintLoading(true);
    setWordHint(EMPTY);
    const signal = newAiAbort();
    try {
      const msgs = buildWordInspirationPrompt(store.currentWords, store.drawnGenre);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200, signal });
      setWordHint({ key: wordsKey, text: result });
    } catch (e) {
      if (!signal.aborted) showToast('AI 生成失败，请检查设置');
      console.error(e);
    } finally {
      lockRef.current = false;
      setWordHintLoading(false);
    }
  }

  async function sceneGenerate() {
    if (!store.aiEnabled || lockRef.current) return;
    lockRef.current = true;
    setSceneLoading(true);
    const signal = newAiAbort();
    try {
      const existing = store.currentScene ? [store.currentScene.title] : [];
      const msgs = buildSceneGeneratePrompt(existing);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300, signal });
      const parsed = JSON.parse(extractJSON(result));
      if (parsed.title && parsed.description) {
        const newScene = {
          id: `ai_${Date.now()}`,
          title: parsed.title,
          description: parsed.description,
          tags: parsed.tags || [],
        };
        store.setCurrentScene(newScene);
        // 持久化 AI 生成的场景到收藏表，使其可被灵感宫殿引用
        await db.promptFavorites.put({
          id: `scene_${newScene.id}`,
          module: 'scene',
          itemId: newScene.id,
          title: newScene.title,
          description: newScene.description,
          tags: newScene.tags,
          isAi: true,
          createdAt: new Date(),
        });
      }
    } catch (e) {
      if (!signal.aborted) showToast('AI 场景生成失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setSceneLoading(false);
    }
  }

  async function sceneDeepDive() {
    if (!store.aiEnabled || !store.currentScene || lockRef.current) return;
    lockRef.current = true;
    setSceneLoading(true);
    setSceneExtra(EMPTY);
    const signal = newAiAbort();
    try {
      const msgs = buildSceneDeepDivePrompt(store.currentScene.title, store.currentScene.description);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200, signal });
      setSceneExtra({ key: sceneKey, text: result });
    } catch (e) {
      if (!signal.aborted) showToast('AI 生成失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setSceneLoading(false);
    }
  }

  async function challengeGenerate() {
    if (!store.aiEnabled || lockRef.current) return;
    lockRef.current = true;
    setChallengeLoading(true);
    const signal = newAiAbort();
    try {
      const existing = store.currentChallenge ? [store.currentChallenge.text] : [];
      const msgs = buildChallengeGeneratePrompt(existing, store.drawnGenre);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300, signal });
      const lines = result.split('\n').map(l => stripPrefix(l.trim())).filter(l => l.length > 0);
      if (lines.length > 0) {
        const picked = lines[Math.floor(Math.random() * lines.length)];
        store.setCurrentChallenge({ id: `ai_${Date.now()}`, text: picked, source: 'user' });
        // 同时存入本地数据库，其余两条也存入
        await db.challenges.bulkPut(
          lines.map((text, i) => ({ id: `ai_${Date.now()}_${i}`, text, source: 'user' as const })),
        );
        showToast(`✨ AI 出了 ${lines.length} 道题并已保存到题库`);
      }
    } catch (e) {
      if (!signal.aborted) showToast('AI 出题失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setChallengeLoading(false);
    }
  }

  async function characterDeep() {
    const prompt = store.currentCharacterPrompt;
    if (!store.aiEnabled || !prompt || lockRef.current) return;
    lockRef.current = true;
    setCharacterLoading(true);
    setCharacterExtra(EMPTY);
    const signal = newAiAbort();
    try {
      const layerName = CHARACTER_LAYERS.find(l => l.id === prompt.layer)?.name || '';
      const msgs = buildCharacterDeepPrompt(prompt.text, layerName);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200, signal });
      setCharacterExtra({ key: prompt.id, text: result });
    } catch (e) {
      if (!signal.aborted) showToast('AI 生成失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setCharacterLoading(false);
    }
  }

  async function characterGenerate() {
    if (!store.aiEnabled || lockRef.current) return;
    lockRef.current = true;
    setCharacterGenLoading(true);
    const signal = newAiAbort();
    try {
      const layerId = store.currentCharacterPrompt?.layer ?? store.selectedCharacterLayer ?? 'inner';
      const layer = CHARACTER_LAYERS.find(l => l.id === layerId) || CHARACTER_LAYERS[0];
      const userPrompts = await db.characterPrompts.toArray();
      const allTexts = [...BUILTIN_CHARACTER_PROMPTS, ...userPrompts]
        .filter(p => p.layer === layer.id)
        .map(p => p.text);
      const msgs = buildCharacterGeneratePrompt({
        layerId: layer.id,
        layerName: layer.name,
        layerDescription: layer.description,
        genre: store.drawnGenre,
        existingTexts: allTexts,
      });
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 400, signal });
      const lines = result.split('\n').map(l => stripPrefix(l.trim())).filter(l => l.length > 0);
      if (lines.length > 0) {
        const newPrompts = lines.map((text, i) => ({
          id: `ai_cp_${Date.now()}_${i}`,
          text,
          layer: layer.id as CharacterLayerId,
          source: 'user' as const,
        }));
        await db.characterPrompts.bulkPut(newPrompts);
        store.setCurrentCharacterPrompt(newPrompts[0]);
        showToast(`✨ AI 出了 ${lines.length} 道角色题并已保存到题库`);
      }
    } catch (e) {
      if (!signal.aborted) showToast('AI 出题失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setCharacterGenLoading(false);
    }
  }

  async function continueWriting() {
    if (!store.aiEnabled || !store.editorContent.trim() || lockRef.current) return;
    lockRef.current = true;
    setContinueLoading(true);
    const baseContent = store.editorContent;
    const aiSectionPrefix = '\n\n---\n\n### AI 续写\n\n';
    let accumulated = '';
    let rafId = 0;
    const signal = newAiAbort();
    try {
      const msgs = buildContinueWritingPrompt(store.editorTitle, baseContent, store.writingMode);
      if (baseContent.replace(/\s/g, '').length > 600) showToast('📝 AI 仅参考最后 600 字进行续写');
      await chatCompletionStream(store.aiConfig, msgs, (chunk) => {
        accumulated += chunk;
        // 使用 rAF 节流，避免每个 token 都触发 re-render
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => store.setEditorContent(baseContent + aiSectionPrefix + accumulated));
      }, { maxTokens: 400, signal });
      // 确保最终内容被写入
      cancelAnimationFrame(rafId);
      store.setEditorContent(baseContent + aiSectionPrefix + accumulated);
    } catch (e) {
      if (!signal.aborted) showToast('AI 续写失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setContinueLoading(false);
    }
  }

  async function feedbackRun() {
    if (!store.aiEnabled || !store.editorContent.trim() || lockRef.current) return;
    lockRef.current = true;
    setFeedbackLoading(true);
    store.setAiFeedback('');
    const signal = newAiAbort();
    try {
      if (store.editorContent.replace(/\s/g, '').length > 800) showToast('📝 AI 仅分析前 800 字');
      const msgs = buildWritingFeedbackPrompt(store.editorTitle, store.editorContent);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300, signal });
      store.setAiFeedback(result);
    } catch (e) {
      if (!signal.aborted) showToast('AI 反馈失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setFeedbackLoading(false);
    }
  }

  async function dreamInterpretRun() {
    if (!store.aiEnabled || !store.editorContent.trim() || lockRef.current) return;
    lockRef.current = true;
    setDreamLoading(true);
    setDreamInterpret('');
    const signal = newAiAbort();
    try {
      const msgs = buildDreamInterpretationPrompt(store.editorTitle, store.editorContent);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 500, signal });
      setDreamInterpret(result);
    } catch (e) {
      if (!signal.aborted) showToast('AI 解梦失败');
      console.error(e);
    } finally {
      lockRef.current = false;
      setDreamLoading(false);
    }
  }

  return {
    enabled: store.aiEnabled,
    wordHint: shown(wordHint, wordsKey), wordHintLoading, wordHintRun,
    sceneExtra: shown(sceneExtra, sceneKey), sceneLoading, sceneGenerate, sceneDeepDive,
    challengeLoading, challengeGenerate,
    characterExtra: shown(characterExtra, characterKey), characterLoading, characterDeep, characterGenLoading, characterGenerate,
    continueLoading, continueWriting,
    feedback: store.aiFeedback, feedbackLoading, feedbackRun, clearFeedback: () => store.setAiFeedback(''),
    dreamInterpret, dreamLoading, dreamInterpretRun, clearDreamInterpret: () => setDreamInterpret(''),
  };
}

export type AiAssist = ReturnType<typeof useAiAssist>;
