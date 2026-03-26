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

/**
 * 调用 AI 聊天补全接口
 */
export async function chatCompletion(
  config: AIConfig,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const base = config.apiBase.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 200)}`);
  }

  const data: ChatCompletionResponse = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回内容为空');
  return content.trim();
}

/**
 * 流式调用 AI（SSE），逐 token 回调
 */
export async function chatCompletionStream(
  config: AIConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const base = config.apiBase.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? 1024,
      stream: true,
    }),
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
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return full;
}

/**
 * 测试 API 连接是否正常
 */
export async function testConnection(config: AIConfig): Promise<boolean> {
  try {
    const result = await chatCompletion(config, [
      { role: 'user', content: '回复"连接成功"四个字。' },
    ], { maxTokens: 20 });
    return result.length > 0;
  } catch {
    return false;
  }
}

/** 预设的 API 供应商 */
export const API_PRESETS: { label: string; base: string; models: string[] }[] = [
  { label: 'OpenAI',   base: 'https://api.openai.com/v1',  models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'] },
  { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', models: ['deepseek-chat'] },
  { label: 'Ollama (本地)', base: 'http://localhost:11434/v1', models: ['qwen2.5', 'llama3', 'mistral'] },
];
