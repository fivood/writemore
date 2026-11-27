/**
 * AI 服务层：同一套调用，按接口地址分两条路
 * - api.anthropic.com → Anthropic 官方 SDK（Claude）
 * - 其他 → OpenAI 兼容的 /chat/completions（Gemini、DeepSeek，以及手填的 OpenAI、Ollama 等）
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from '../inspire';

export interface AIConfig {
  apiKey: string;
  apiBase: string;   // e.g. "https://generativelanguage.googleapis.com/v1beta/openai"
  model: string;     // e.g. "gemini-4-hydrogen"
}

interface CallOptions {
  /** 输出上限。思考也算在里面，别给太小；长度由提示词控制 */
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_MAX_TOKENS = 4096;
/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT_MS = 30_000;

/** 预设的 API 供应商：只给地址和一个默认型号，其余型号在设置里用「可用模型」现查 */
export const API_PRESETS: { label: string; base: string; model: string }[] = [
  // 最新一代里有免费档的；更强的 gemini-4-neon 没有免费档
  { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-4-hydrogen' },
  { label: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { label: 'Claude', base: 'https://api.anthropic.com', model: 'claude-haiku-5-5' },
];

const trimBase = (base: string) => base.replace(/\/+$/, '');
const isClaude = (config: AIConfig) => /(^|[/.])anthropic\.com/.test(config.apiBase);
const isDeepSeek = (config: AIConfig) => /(^|[/.])deepseek\.com/.test(config.apiBase);
/** Gemini 3 及以上：思考关不掉，默认档位偏高（Gemini 4 是 high），压到 low；这几代都支持 low */
const isThinkingGemini = (config: AIConfig) =>
  /generativelanguage\.googleapis\.com/.test(config.apiBase) && /gemini-(?:[3-9]|\d{2})/.test(config.model);

/**
 * 创建带超时的 AbortSignal。
 * 如果调用方已传入 signal，则合并：任一触发即中止。
 */
function createTimeoutSignal(
  externalSignal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`AI 请求超时 (${timeoutMs / 1000}s)`)), timeoutMs);

  // 如果外部 signal 已中止，立即中止
  if (externalSignal?.aborted) {
    clearTimeout(timer);
    controller.abort(externalSignal.reason);
    return { signal: controller.signal, cleanup: () => {} };
  }

  // 监听外部 signal 中止事件
  const onExternalAbort = () => controller.abort(externalSignal!.reason);
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  const cleanup = () => {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  };

  return { signal: controller.signal, cleanup };
}

// ── Claude（Anthropic 官方 SDK） ─────────────────────────────

function claudeClient(config: AIConfig) {
  return new Anthropic({
    apiKey: config.apiKey,
    // SDK 自己会拼 /v1/messages，地址里带了 /v1 就去掉
    baseURL: trimBase(config.apiBase).replace(/\/v1$/, ''),
    // Key 只存在用户自己的浏览器里，请求直接发给 Anthropic
    dangerouslyAllowBrowser: true,
  });
}

/** system 消息放到顶层 system 字段，其余作为对话；思考交给模型自适应，力度最低档 */
function claudeParams(config: AIConfig, messages: ChatMessage[], maxTokens: number) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  return {
    model: config.model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    output_config: { effort: 'low' as const },
  };
}

function checkClaudeStop(stopReason: Anthropic.StopReason | null) {
  if (stopReason === 'refusal') throw new Error('Claude 拒绝回答这个请求');
}

// ── OpenAI 兼容 ──────────────────────────────────────────

function openAiRequest(config: AIConfig, messages: ChatMessage[], options: CallOptions, stream: boolean): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(stream ? { stream: true } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      // DeepSeek 默认开深度思考（high），写几十字的引导用不着
      ...(isDeepSeek(config) ? { thinking: { type: 'disabled' } } : {}),
      ...(isThinkingGemini(config) ? { reasoning_effort: 'low' } : {}),
    }),
  };
}

async function ensureOk(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * 解析 SSE buffer 中的单行数据，提取 delta content
 */
function processSSELine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data: ')) return null;
  const payload = trimmed.slice(6);
  if (payload === '[DONE]') return null;
  try {
    const json = JSON.parse(payload);
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

// ── 对外 ─────────────────────────────────────────────────

/**
 * 调用 AI 聊天补全接口
 */
export async function chatCompletion(config: AIConfig, messages: ChatMessage[], options: CallOptions = {}): Promise<string> {
  const { signal, cleanup } = createTimeoutSignal(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let content: string | undefined;
    if (isClaude(config)) {
      const res = await claudeClient(config).messages.create(
        claudeParams(config, messages, options.maxTokens ?? DEFAULT_MAX_TOKENS), { signal });
      checkClaudeStop(res.stop_reason);
      content = res.content.map(b => (b.type === 'text' ? b.text : '')).join('');
    } else {
      const res = await fetch(`${trimBase(config.apiBase)}/chat/completions`, { ...openAiRequest(config, messages, options, false), signal });
      await ensureOk(res);
      const data: { choices?: { message?: { content?: string } }[] } = await res.json();
      content = data.choices?.[0]?.message?.content;
    }
    if (!content?.trim()) throw new Error('AI 返回内容为空');
    return content.trim();
  } finally {
    cleanup();
  }
}

/**
 * 流式调用 AI，逐段回调
 */
export async function chatCompletionStream(
  config: AIConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options: CallOptions = {},
): Promise<string> {
  // 流式请求通常更慢，给更长的超时（默认 60s）
  const { signal, cleanup } = createTimeoutSignal(options.signal, options.timeoutMs ?? 60_000);
  let full = '';
  const emit = (delta: string | null) => {
    if (!delta) return;
    full += delta;
    onChunk(delta);
  };

  try {
    if (isClaude(config)) {
      const stream = claudeClient(config).messages.stream(
        claudeParams(config, messages, options.maxTokens ?? DEFAULT_MAX_TOKENS), { signal });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') emit(event.delta.text);
      }
      checkClaudeStop((await stream.finalMessage()).stop_reason);
      return full;
    }

    const res = await fetch(`${trimBase(config.apiBase)}/chat/completions`, { ...openAiRequest(config, messages, options, true), signal });
    await ensureOk(res);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(line => emit(processSSELine(line)));
    }
    // 处理 buffer 中残留的最后一行数据（服务端未以 \n 结尾时）
    if (buffer.trim()) emit(processSSELine(buffer));
    return full;
  } finally {
    cleanup();
  }
}

// 列表里混着语音、图像、音乐、向量、实时语音、机器人等不能拿来对话的型号
const NON_CHAT = /embed|tts|image|imagen|banana|audio|live|transcri|translate|robotics|computer-use|lyria|veo|aqa|genie|whisper|dall-e|moderation|deep-research|antigravity|decision|omni|customtools/i;
const versionOf = (id: string) => Number(id.match(/\d+(?:\.\d+)?/)?.[0] ?? -1);

/** 列出这个 Key 能用的对话模型（设置里的「可用模型」按钮），版本新的排前面 */
export async function listModels(config: AIConfig): Promise<string[]> {
  let ids: string[] = [];
  if (isClaude(config)) {
    for await (const m of claudeClient(config).models.list()) ids.push(m.id);
  } else {
    const res = await fetch(`${trimBase(config.apiBase)}/models`, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
    });
    await ensureOk(res);
    const data = await res.json();
    ids = ((data.data ?? data.models ?? []) as Record<string, string>[]).map(m => m.id ?? m.name ?? '');
  }
  return ids
    .map(id => id.replace(/^models\//, ''))
    .filter(id => id && !NON_CHAT.test(id))
    .sort((a, b) => versionOf(b) - versionOf(a) || a.localeCompare(b));
}

/**
 * 测试 API 连接是否正常，成功返回 null，失败返回错误信息字符串。
 * 优先列模型（不消耗 token），失败后再用一次最小的对话验证。
 */
export async function testConnection(config: AIConfig): Promise<string | null> {
  try {
    await listModels(config);
    return null;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return '认证失败 (401)：请检查 API Key';
    if (e instanceof Error && /\((401|403)\)/.test(e.message)) return `认证失败：请检查 API Key`;
    if (e instanceof TypeError) return `无法连接到 ${trimBase(config.apiBase)}，请检查 API 地址`;
    // 有的服务不支持列模型，继续用对话验证
  }
  try {
    await chatCompletion(config, [{ role: 'user', content: '回复"ok"两个字母。' }], { timeoutMs: 15_000 });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
