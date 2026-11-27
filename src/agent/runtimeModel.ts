/**
 * 运行时模型配置（硅基流动 · 免费开源模型）。
 *
 * 【安全铁律 · 不要改】
 * 1. API Key 只保存在**当前页面的 JS 内存**里，刷新 / 关闭页面立即消失。
 * 2. 绝不写入 localStorage / sessionStorage / IndexedDB / Cookie。
 * 3. 绝不 console 打印密钥，绝不拼进 URL，绝不写进任何文件。
 * 4. 密钥只在调用硅基流动官方接口时作为 Authorization 头发出，
 *    不经过任何中间服务器，也不会被本项目上传或保存。
 * 5. 这里没有任何默认值 / 兜底 key，源码与构建包里都不含真实密钥。
 *
 * 之所以用「模块变量 + 订阅」而不是 Context：让 llm.ts 和 UI 读到同一份
 * 内存态，同时用 useSyncExternalStore 保持 React 响应，改动面最小。
 */

export interface FreeModel {
  id: string;
  label: string;
  note: string;
}

/**
 * 硅基流动价格页上曾标注为 0 元的对话模型（便于选取的快捷项）。
 * 免费是活动制、会变动——界面上必须提示「以平台实时价格页为准」，
 * 且允许用户填任意模型 ID，不把这些写死成唯一选项。
 */
export const FREE_MODELS: FreeModel[] = [
  { id: 'THUDM/GLM-4-9B-0414', label: 'GLM-4-9B', note: '对话稳，适合陪聊' },
  { id: 'THUDM/GLM-Z1-9B-0414', label: 'GLM-Z1-9B', note: '推理模型，回答偏长' },
  { id: 'XingChenAGI/Xing4.0-29B', label: '星辰 29B', note: '体量较大，回复更完整' },
  { id: 'tencent/Hunyuan-MT-7B', label: '混元 7B', note: '轻快，适合短回复' },
];

export const DEFAULT_MODEL = FREE_MODELS[0].id;
export const SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
export const SILICONFLOW_SIGNUP = 'https://cloud.siliconflow.cn/';
export const SILICONFLOW_KEY_PAGE = 'https://cloud.siliconflow.cn/me/account/ak';
export const SILICONFLOW_PRICING = 'https://siliconflow.cn/pricing';

let runtimeKey = '';
let runtimeModel = DEFAULT_MODEL;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

/** useSyncExternalStore 用：返回稳定字符串快照（不能返回对象，否则会重复渲染）。 */
export function snapshot(): string {
  return runtimeKey ? `on:${runtimeModel}` : 'off';
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasRuntimeKey(): boolean {
  return runtimeKey.length > 0;
}

/** 仅供内部发请求使用；UI 不要读取或显示这个值。 */
function getRuntimeKey(): string {
  return runtimeKey;
}

export function getRuntimeModel(): string {
  return runtimeModel;
}

/** 设置内存态配置。trim 后为空视为未配置。 */
export function setRuntimeConfig(key: string, model: string): void {
  runtimeKey = key.trim();
  runtimeModel = model.trim() || DEFAULT_MODEL;
  notify();
}

/** 清空内存态配置（关闭页面也会自然清空）。 */
export function clearRuntimeConfig(): void {
  runtimeKey = '';
  runtimeModel = DEFAULT_MODEL;
  notify();
}

type WireMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface CallResult {
  text: string | null;
  error?: string;
}

/**
 * 直接请求硅基流动官方 OpenAI 兼容接口。
 * 失败一律返回 null，由调用方回退本地引擎；错误文案只给状态码，不泄漏密钥。
 */
export async function callSiliconFlow(messages: WireMessage[]): Promise<CallResult> {
  const key = getRuntimeKey();
  if (!key) return { text: null, error: '尚未配置密钥' };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(SILICONFLOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: runtimeModel,
        messages,
        stream: false,
        max_tokens: 512,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let hint = '';
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        hint = body.error?.message ? `：${body.error.message}` : '';
      } catch {
        // 错误体解析失败，状态码足够定位。
      }
      // 只在开发态出日志，且绝不打印 key。
      if (import.meta.env.DEV) console.warn(`[回音谷] 硅基流动 HTTP ${response.status}${hint}`);
      return { text: null, error: `HTTP ${response.status}${hint}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim()
      ? { text: content.trim() }
      : { text: null, error: '模型返回为空' };
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[回音谷] 硅基流动请求异常', error);
    return { text: null, error: '连接失败或超时' };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 连通性测试：用当前（或传入的）配置发一条极短请求。
 * 只回传成功与否和错误描述，绝不回显密钥。
 */
export async function testSiliconFlow(key: string, model: string): Promise<CallResult> {
  const savedKey = runtimeKey;
  const savedModel = runtimeModel;
  runtimeKey = key.trim();
  runtimeModel = model.trim() || DEFAULT_MODEL;
  try {
    return await callSiliconFlow([
      { role: 'user', content: '只回复两个字：收到' },
    ]);
  } finally {
    // 测试不改动用户已保存的运行时配置。
    runtimeKey = savedKey;
    runtimeModel = savedModel;
  }
}
