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
 * 写作挑战 — AI 生成新挑战题（支持风格）
 */
export function buildChallengeGeneratePrompt(existingChallenges: string[], genre: string | null = null): ChatMessage[] {
  const genreHint = genre && genre !== '通用'
    ? `\n本次挑战以「${genre}」风格为主，题目要有该风格的语言质感和氛围。`
    : '';

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `请生成 3 条创意写作挑战题目，每条一行，不加序号不加符号。${genreHint}

好题目的范例（注意：有具体感官锚点，有内在悬念，驱动写作欲）：
- 「雨停之后，她发现门缝里塞着一封没有署名的信，上面只有三个字。」
- 「他们约好的见面地点是一家三年前关门的咖啡馆，今天，灯亮着。」
- 「写一个人如何用'我很好'三个字装下今天发生的所有事。」

要求：
- 每条 15-35 字
- 必须包含至少一个具体感官细节或情境锚点（地点、气味、声音、物件等），不能是纯技巧说明
- 题目本身有内在矛盾或悬念，驱动写作欲
- 不要和以下已有题目太相似：${existingChallenges.slice(0, 8).join('；')}
- 只返回题目文本，不要其他内容`,
    },
  ];
}

/**
 * 角色描写 — AI 生成新角色提示（按维度+风格）
 */
export function buildCharacterGeneratePrompt(params: {
  layerId: string;
  layerName: string;
  layerDescription: string;
  genre: string | null;
  existingTexts: string[];
}): ChatMessage[] {
  const { layerId, layerName, layerDescription, genre, existingTexts } = params;

  const layerExamples: Record<string, string[]> = {
    inner: [
      '他/她有一套关于世界的理论，支撑他/她走到今天。写那套理论第一次出现裂缝的时刻。',
      '他/她有一件事从来不允许自己希望。写他/她某次差点希望了，然后把那个念头掐死的过程。',
    ],
    relationship: [
      '双方有一个从来不说出口的规则，都在遵守，都不承认它存在。写这个规则如何在一次对话里悄悄运作。',
      '写一个人如何在另一个人不注意的时候照顾对方——用他/她永远不会承认是"照顾"的方式。',
    ],
    voice: [
      '写他/她在说谎时的语言习惯。句子在撒谎时会变短，还是会变长，还是会突然变得很精确？',
      '他/她从不说"对不起"。写他/她用来代替道歉的那些动作或话，以及接受方是否总能看懂。',
    ],
    body: [
      '写他/她在极度平静时身体里发生的事。那种表面静止、内部在燃烧的状态，从皮肤往里写。',
      '他/她的身体记住了一件他/她的意识想忘记的事。写它在什么时候、以什么方式提醒他/她。',
    ],
    history: [
      '他/她有一个非常小的习惯，没有人知道是从哪里来的。写那个习惯的来源，以及他/她现在做这件事时还不还记得为什么。',
      '他/她人生中有一个"之前"和"之后"。写那个分界点，但不要从事件本身写，从一个细节切入。',
    ],
    edge: [
      '从一个只见过他/她三次的陌生人视角，写他/她走进一个房间。',
      '他/她的一个旧敌会怎么描述他/她？写那个描述，并让读者意识到敌人可能是对的。',
    ],
  };

  const examples = (layerExamples[layerId] || layerExamples['inner'])
    .map(e => `「${e}」`)
    .join('\n');

  const genreHint = genre && genre !== '通用'
    ? `\n当前写作风格是「${genre}」，如适合可让题目融入该风格的设定或氛围，但不要强行贴标签。`
    : '';

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `请为角色描写的「${layerName}」维度生成 3 条写作引导题目，每条一行，不加序号不加符号。
维度说明：${layerDescription}${genreHint}

好题目的参考范例（注意深度和具体感）：
${examples}

要求：
- 每条 25-60 字
- 引导作者挖掘角色内部矛盾、具体细节或反常行为，不能泛泛而谈
- 用「他/她」指代角色，保持性别中立
- 不要和以下已有题目太相似：${existingTexts.slice(0, 6).join('；')}
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

/**
 * 梦境记录 — AI 解梦与象征分析
 */
export function buildDreamInterpretationPrompt(title: string, content: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一位融合荣格原型理论与文学隐喻分析的解梦师。你的解读不追求"预测"，而是帮助做梦者发现潜意识中的情绪、渴望与象征意义，并将其转化为创作灵感。回复语言富有诗意，简洁有力，避免神秘主义套话。`,
    },
    {
      role: 'user',
      content: `我记录了一个梦：

标题：${title || '（无标题）'}
内容：
${content.slice(0, 1000)}

请从以下三个角度解读这个梦（每个角度 2-3 句，总字数控制在 180 字以内）：

1. **核心象征**：梦中最突出的意象或场景代表什么情绪或心理原型？
2. **潜意识信号**：这个梦可能在回应你生活中的哪种情绪状态或内心渴望？
3. **创作灵感**：从这个梦中提炼出一个可以用于写作的核心意象或情感线索。

用第二人称"你"直接对我说话。`,
    },
  ];
}
