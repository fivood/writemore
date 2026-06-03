/**
 * AI 服务层 — 统一封装 OpenAI 兼容 API 调用
 * 支持 OpenAI / DeepSeek / Ollama 等兼容接口
 */

export interface AIConfig {
  apiKey: string;
  apiBase: string;   // e.g. "https://api.openai.com/v1"
  model: string;     // e.g. "gpt-4o-mini"
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionChoice {
  message: { content: string };
}

interface ChatCompletionResponse {
  choices: ChatCompletionChoice[];
}

/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT_MS = 30_000;

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

/**
 * 调用 AI 聊天补全接口
 */
export async function chatCompletion(
  config: AIConfig,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal; timeoutMs?: number },
): Promise<string> {
  const base = config.apiBase.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const { signal, cleanup } = createTimeoutSignal(options?.signal, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 200)}`);
    }

    const data: ChatCompletionResponse = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 返回内容为空');
    return content.trim();
  } finally {
    cleanup();
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

/**
 * 流式调用 AI（SSE），逐 token 回调
 */
export async function chatCompletionStream(
  config: AIConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal; timeoutMs?: number },
): Promise<string> {
  const base = config.apiBase.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  // 流式请求通常更慢，给更长的超时（默认 60s）
  const { signal, cleanup } = createTimeoutSignal(options?.signal, options?.timeoutMs ?? 60_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const delta = processSSELine(line);
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      }
    }

    // 处理 buffer 中残留的最后一行数据（服务端未以 \n 结尾时）
    if (buffer.trim()) {
      const delta = processSSELine(buffer);
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    }

    return full;
  } finally {
    cleanup();
  }
}

/**
 * 测试 API 连接是否正常，成功返回 null，失败返回错误信息字符串。
 * 优先使用轻量的 /models 端点（不消耗 token），失败后 fallback 到 chat 补全。
 */
export async function testConnection(config: AIConfig): Promise<string | null> {
  const base = config.apiBase.replace(/\/+$/, '');

  // 1. 先尝试 GET /models（轻量，不消耗 token）
  try {
    const res = await fetch(`${base}/models`, {
      method: 'GET',
      headers: {
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return null;
    // 4xx/5xx 可能是端点不支持，继续 fallback
    if (res.status === 401 || res.status === 403) {
      return `认证失败 (${res.status})：请检查 API Key`;
    }
  } catch (e) {
    // 网络错误或超时，继续 fallback
    if (e instanceof TypeError) {
      return `无法连接到 ${base}，请检查 API 地址`;
    }
  }

  // 2. Fallback: 用最小化的 chat 补全验证
  try {
    const result = await chatCompletion(config, [
      { role: 'user', content: '回复"ok"两个字母。' },
    ], { maxTokens: 10, timeoutMs: 15_000 });
    return result.length > 0 ? null : '返回内容为空';
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** 预设的 API 供应商 */
export const API_PRESETS: { label: string; base: string; models: string[] }[] = [
  { label: 'OpenAI',        base: 'https://api.openai.com/v1',  models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'] },
  { label: 'Gemini',        base: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'] },
  { label: 'Kimi (月之暗面)', base: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  { label: 'DeepSeek',      base: 'https://api.deepseek.com/v1', models: ['deepseek-chat'] },
  { label: '智谱 GLM',       base: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-air', 'glm-4'] },
  { label: 'Ollama (本地)',  base: 'http://localhost:11434/v1', models: ['qwen2.5', 'llama3', 'mistral'] },
];
