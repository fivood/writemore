/**
 * AI Prompt 模板 — 各写作模式的 AI 增强 prompt 构造
 */

import type { ChatMessage } from './ai';
import type { Word, Draft } from '../types';

const SYSTEM_BASE = '你是一个中文创意写作助手，擅长文学、诗歌和小说写作。回复应简洁、有文学性、有启发性。';

/**
 * 词汇灵感 — 为一组词条生成写作引导
 */
export function buildWordInspirationPrompt(words: Word[], genre: string | null): ChatMessage[] {
  const wordList = words.map(w => `${w.text}（${w.category}）`).join('、');
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `我抽到了这些词条：${wordList}。${genre ? `写作风格倾向：${genre}。` : ''}

请为这组词条生成一段简短的写作引导（50字以内），帮助我找到它们之间的联系并激发灵感。不要直接写故事，只给出一个引导方向或意象画面。`,
    },
  ];
}

/**
 * 场景描写 — AI 生成新场景
 */
export function buildSceneGeneratePrompt(existingTitles: string[]): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `请生成一个创意写作用的场景描写提示，包含以下 JSON 格式：
{"title": "场景标题（3-6字）", "description": "场景描述（30-60字，包含感官细节提示）", "tags": ["标签1", "标签2", "标签3"]}

要求：
- 场景要有画面感，适合练习描写
- 不要和以下已有场景重复：${existingTitles.slice(0, 10).join('、')}
- 只返回 JSON，不要其他内容`,
    },
  ];
}

/**
 * 场景描写 — 为已有场景添加感官细节引导
 */
export function buildSceneDeepDivePrompt(title: string, description: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `当前场景是「${title}」：${description}

请为这个场景补充具体的感官引导（30字以内），格式：
- 听觉：...
- 嗅觉：...
- 触觉：...

每条只写一个具体细节，简洁有力。`,
    },
  ];
}

/**
 * 写作挑战 — AI 生成新挑战题
 */
export function buildChallengeGeneratePrompt(existingChallenges: string[]): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `请生成 3 条创意写作挑战题目，每条一行，不加序号不加符号。

要求：
- 每条 15-30 字
- 侧重写作技巧的练习（如视角转换、感官描写、对话技巧、展示而非叙述等）
- 不要和以下已有题目太相似：${existingChallenges.slice(0, 8).join('；')}
- 只返回题目文本，不要其他内容`,
    },
  ];
}

/**
 * 角色描写 — AI 生成深化提示
 */
export function buildCharacterDeepPrompt(currentPrompt: string, layerName: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `当前角色描写的维度是「${layerName}」，提示是：「${currentPrompt}」

请基于这个提示，生成一个更具体、更有深度的追问提示（20-40字），帮助作者更深入地挖掘角色。只返回提示文本。`,
    },
  ];
}

/**
 * 灵感宫殿 — 从已有草稿中重新组合生成新灵感
 */
export function buildInspirationRemixPrompt(drafts: Draft[]): ChatMessage[] {
  const excerpts = drafts
    .map(d => `《${d.title}》：${d.content.slice(0, 150)}`)
    .join('\n\n');

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `以下是我过去的几篇创作片段：

${excerpts}

请从这些片段中提取意象、角色或场景元素，重新组合生成一个全新的写作灵感提示（50-80字）。这个提示应该能激发一篇新的创作，但不是简单复述原有内容。只返回提示文本。`,
    },
  ];
}

/**
 * AI 续写 — 基于已写内容自然续写
 */
export function buildContinueWritingPrompt(title: string, content: string, mode: string | null): ChatMessage[] {
  const modeHint: Record<string, string> = {
    scene: '（这是一篇场景描写练习）',
    dream: '（这是一篇梦境记录）',
    challenge: '（这是一篇习作练习）',
    character: '（这是一篇角色描写练习）',
  };
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `这是一篇正在写作中的文章${mode && modeHint[mode] ? modeHint[mode] : ''}：

标题：${title || '（无标题）'}

${content.slice(-600)}

请自然地续写上面的内容，保持风格和节奏一致，续写 80—150 字。只返回续写内容，不要重复已有内容。`,
    },
  ];
}

/**
 * AI 写后反馈 — 分析已写内容，给出建议
 */
export function buildWritingFeedbackPrompt(title: string, content: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `请为以下创意写作给出简短反馈（100 字以内）：

标题：${title || '（无标题）'}
${content.slice(0, 800)}

请选拡一个亮点和一个可提升方向，面向下列维度进行选择：感官描写、节奏感、画面感、情感表达、语言新鲜度。语气以鼓励为主。`,
    },
  ];
}
