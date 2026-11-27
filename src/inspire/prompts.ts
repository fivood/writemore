/**
 * AI Prompt 模板 — 各写作模式的 AI 增强 prompt 构造。
 * 只拼消息，不发请求：返回 OpenAI 格式的 ChatMessage[]，接哪家模型由调用方决定。
 * 每个函数返回的第一条都是 system（人设）；别的项目想换口吻，替换 messages[0].content 即可。
 */

import { sampleItems } from './types';
import type { CharacterLayer, CharacterPrompt, ChatMessage, Rng, ScenePrompt, WritingChallenge, Word } from './types';
import { SCENE_PROMPTS } from './scenes';
import { BUILTIN_CHALLENGES } from './challenges';
import { BUILTIN_CHARACTER_PROMPTS } from './characters';

/** 默认人设：五木文风（克制的英式黑色幽默）的出题人兼责编 */
export const WRITING_PERSONA = `你是一个中文写作练习的出题人兼责编。口吻是克制的英式黑色幽默：像见过太多闹剧的老管家，波澜不惊，略带一点得意，但不嘲笑写的人，也不拿真实的痛苦开玩笑。

写的时候：
- 具体、家常。用物件、动作、声音、时间和数字说话；比喻从食物、家务、交通、职场、动物里找，可以带一点荒诞。
- 轻重倒置：大事轻轻带过，小事认真写。要夸张就穿上计数和测量的外衣，比如「等了十一分钟」「至少亮了两千流明」。
- 好笑的地方来自换一个框架看事情、人物给自己找的理由，不来自段子和感叹。
- 情绪只用低音量的说法。不煽情，不总结，不升华，不讲道理。
- 不用排比和工整对句，不用「仿佛」「宛如」「像潮水般」这类空泛比喻，不写诗化的结尾；少用破折号，不用感叹号，不写「不是……而是……」式的铺垫。
- 只给被要求的内容，不寒暄，不解释自己在做什么。`;

/** 告诉模型别重复的旧题数量：从题库里随机抽，当前这道一定在里面 */
const AVOID_COUNT = 10;
/** 当作口吻范例的内置题数量 */
const EXAMPLE_COUNT = 3;

function avoidList(texts: readonly string[], current: string | undefined, rng?: Rng): string[] {
  const rest = texts.filter(t => t !== current);
  return current ? [current, ...sampleItems(rest, AVOID_COUNT - 1, rng)] : sampleItems(rest, AVOID_COUNT, rng);
}

const system = (content = WRITING_PERSONA): ChatMessage => ({ role: 'system', content });

/**
 * 词汇灵感 — 为一组词条生成写作引导
 */
export function buildWordInspirationPrompt(words: Pick<Word, 'text' | 'category' | 'explanation'>[], genre: string | null): ChatMessage[] {
  const wordList = words.map(w => `${w.text}（${w.category}${w.explanation ? `：${w.explanation}` : ''}）`).join('、');
  return [
    system(),
    {
      role: 'user',
      content: `我抽到了这些词条：${wordList}。${genre ? `写作风格倾向：${genre}。` : ''}

请用 50 字以内给一个写作的切入点：把这几个词放进同一个具体的场面里，找到它们之间的联系。不要直接写故事。`,
    },
  ];
}

/**
 * 场景描写 — AI 生成新场景。
 * pool 是已有场景（默认内置题库），从中抽 10 个标题让模型避开；口吻范例从内置题库里抽 3 个。
 */
export function buildSceneGeneratePrompt(
  { pool = SCENE_PROMPTS, current, rng }: { pool?: readonly ScenePrompt[]; current?: ScenePrompt | null; rng?: Rng } = {},
): ChatMessage[] {
  const examples = sampleItems(SCENE_PROMPTS, EXAMPLE_COUNT, rng);
  const avoid = avoidList(pool.filter(s => !examples.includes(s)).map(s => s.title), current?.title, rng);
  return [
    system(),
    {
      role: 'user',
      content: `请出一个场景描写练习，只返回下面格式的 JSON：
{"title": "场景标题（十个字左右）", "description": "场景描述（30-60字）", "tags": ["标签1", "标签2"]}

题库里现有的场景是这个口吻，照这个具体程度写：
${examples.map(s => `- 「${s.title}」${s.description}`).join('\n')}

要求：
- 一个具体的时间和地点，两三个看得见、听得见或闻得到的细节，留一处没说破的地方让人想写下去
- 不要和这些已有场景重复：${[...examples.map(s => s.title), ...avoid].join('、')}
- 只返回 JSON，不要其他内容`,
    },
  ];
}

/**
 * 场景描写 — 为已有场景添加感官细节引导
 */
export function buildSceneDeepDivePrompt(title: string, description: string): ChatMessage[] {
  return [
    system(),
    {
      role: 'user',
      content: `当前场景是「${title}」：${description}

请为这个场景补三条感官细节，每条一行、15 字以内，格式：
- 听觉：...
- 嗅觉：...
- 触觉：...

每条只写一个具体的东西，不写感受。`,
    },
  ];
}

/**
 * 写作挑战 — AI 生成新挑战题。
 * pool 是已有题目（内置 + 用户导入 + AI 出过的），从中抽 10 条让模型避开；current 是当前这道。
 * 范例用手写的三条：内置挑战题多是技巧练习，和这里要的情境题不是一类。
 */
export function buildChallengeGeneratePrompt(
  { pool = BUILTIN_CHALLENGES, current, genre = null, rng }:
  { pool?: readonly WritingChallenge[]; current?: string; genre?: string | null; rng?: Rng } = {},
): ChatMessage[] {
  const genreHint = genre && genre !== '通用'
    ? `\n本次挑战以「${genre}」风格为主，题目要有该风格的质感和氛围。`
    : '';

  return [
    system(),
    {
      role: 'user',
      content: `请生成 3 条写作挑战题目，每条一行，不加序号不加符号。${genreHint}

好题目的范例（有具体的物件或情境，有一处没说破的矛盾）：
- 「雨停之后，她发现门缝里塞着一封没有署名的信，上面只有三个字。」
- 「他们约好的见面地点是一家三年前关门的咖啡馆，今天，灯亮着。」
- 「写一个人如何用'我很好'三个字装下今天发生的所有事。」

要求：
- 每条 15-35 字
- 至少一个具体的感官细节或情境锚点（地点、气味、声音、物件等），不能是纯技巧说明
- 题目本身有内在矛盾或悬念，让人想写
- 不要和这些已有题目太相似：${avoidList(pool.map(c => c.text), current, rng).join('；')}
- 只返回题目文本，不要其他内容`,
    },
  ];
}

/**
 * 角色描写 — AI 生成新角色提示（按维度+风格）。
 * pool 是已有角色题（内置 + 用户导入 + AI 出过的），只看 layer 这一维：
 * 从内置题里抽 3 条当范例，其余抽 10 条让模型避开。
 */
export function buildCharacterGeneratePrompt(params: {
  layer: CharacterLayer;
  genre?: string | null;
  pool?: readonly CharacterPrompt[];
  rng?: Rng;
}): ChatMessage[] {
  const { layer, genre = null, pool = BUILTIN_CHARACTER_PROMPTS, rng } = params;
  const inLayer = pool.filter(p => p.layer === layer.id);
  const examples = sampleItems(inLayer.filter(p => p.source === 'builtin'), EXAMPLE_COUNT, rng);
  const avoid = avoidList(inLayer.filter(p => !examples.includes(p)).map(p => p.text), undefined, rng);

  const genreHint = genre && genre !== '通用'
    ? `\n当前写作风格是「${genre}」，如适合可让题目融入该风格的设定或氛围，但不要强行贴标签。`
    : '';

  return [
    system(),
    {
      role: 'user',
      content: `请为角色描写的「${layer.name}」维度生成 3 条写作引导题目，每条一行，不加序号不加符号。
维度说明：${layer.description}${genreHint}

题库里现有的题目是这个口吻（注意深度和具体感）：
${examples.map(e => `「${e.text}」`).join('\n')}

要求：
- 每条 25-60 字
- 引导作者挖掘角色内部矛盾、具体细节或反常行为，不能泛泛而谈
- 用「他/她」指代角色，保持性别中立
${avoid.length > 0 ? `- 不要和这些已有题目太相似：${avoid.join('；')}\n` : ''}- 只返回题目文本，不要其他内容`,
    },
  ];
}

/**
 * 角色描写 — AI 生成深化提示
 */
export function buildCharacterDeepPrompt(currentPrompt: string, layerName: string): ChatMessage[] {
  return [
    system(),
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
export function buildInspirationRemixPrompt(drafts: { title: string; content: string }[]): ChatMessage[] {
  const excerpts = drafts
    .map(d => `《${d.title}》：${d.content.slice(0, 150)}`)
    .join('\n\n');

  return [
    system(),
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
    system(),
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
 * AI 写后反馈 — 像责编一样直说最该改的地方
 */
export function buildWritingFeedbackPrompt(title: string, content: string): ChatMessage[] {
  return [
    system(),
    {
      role: 'user',
      content: `请当这段习作的责编，给一段简短反馈（150 字以内）：

标题：${title || '（无标题）'}
${content.slice(0, 800)}

要求：
- 不夸奖，不寒暄，不打分。挑出最值得改的一到两处，引用原句（不超过 15 字），说清楚为什么，再给一个具体的改法。
- 优先看这些毛病：情绪直给或煽情；空泛的形容和抒情比喻；大事小事一样的分量；不干活的细节；结尾在总结或升华。
- 写得确实没毛病，就说一句「这段不用改」，再指出读者最可能记住的那一句。`,
    },
  ];
}

/**
 * 梦境记录 — AI 解梦与象征分析（口吻沿用默认人设）
 */
export function buildDreamInterpretationPrompt(title: string, content: string): ChatMessage[] {
  return [
    system(`${WRITING_PERSONA}

这次你负责解梦：借用荣格原型理论和文学隐喻分析，不做预测，不讲神秘主义套话，帮做梦的人看见梦里的情绪，以及能拿来写的东西。`),
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

// ── 解析回复 ──

const NUMBERING = /^(?:[（(]\s*(?:\d+|[一二三四五六七八九十]+)\s*[)）]|(?:\d+|[一二三四五六七八九十]+)\s*[.．、:：)）](?!\d)|[①-⑳])\s*/;
const BULLET = /^[-•*●·]\s*/;

/**
 * 多行文本拆成一条条提示：去掉空行和开头的序号、项目符号
 * （「1. 」「2、」「（3）」「①」「一、」「- 」「• 」「● 」）。
 * 序号后面必须跟标点，所以「一封信……」「3 天后……」不会被误删。
 * 用来解析 AI 出的题（buildChallengeGeneratePrompt / buildCharacterGeneratePrompt 的回复）和用户导入的题。
 */
export function parsePromptLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim().replace(BULLET, '').replace(NUMBERING, '').trim())
    .filter(l => l.length > 0);
}

/** 解析 buildSceneGeneratePrompt 的回复，兼容 ```json 代码块和前后多余的话；解析不出返回 null */
export function parseAiScene(text: string): Pick<ScenePrompt, 'title' | 'description' | 'tags'> | null {
  const json = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    const o = JSON.parse(json.trim());
    if (!o || typeof o.title !== 'string' || typeof o.description !== 'string' || !o.title || !o.description) return null;
    const tags: unknown[] = Array.isArray(o.tags) ? o.tags : [];
    return { title: o.title, description: o.description, tags: tags.filter((t): t is string => typeof t === 'string') };
  } catch {
    return null;
  }
}
