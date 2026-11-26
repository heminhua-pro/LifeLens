import type { ChatMessage, LlmConfig, LlmTool, ToolCall } from './types'
import { isMock } from './config'
import { mockLLM } from './mock'

/** trace 走 v-html 直出，动态文本须转义 HTML（与 orchestrator 一致） */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** OpenAI 兼容 /chat/completions 调用（BYOK，Key 只在浏览器） */
export async function callLLM(
  messages: ChatMessage[],
  tools: LlmTool[],
  cfg: LlmConfig,
  trace?: (html: string) => void
): Promise<{ content?: string; tool_calls?: ToolCall[] }> {
  if (isMock(cfg)) {
    trace?.('⚙ router: <b>Mock</b>（本地模拟，无网络请求）')
    return mockLLM(messages, tools)
  }
  // 只记录 host + model（BYOK 直连端点），绝不输出 Key 或带凭证的完整 URL
  let host = '(invalid base)'
  try { host = new URL(cfg.base).host } catch { /* ignore */ }
  trace?.(`⚙ router: <b>${esc(cfg.model)}</b> @ ${esc(host)}（BYOK 直连）`)
  const t0 = performance.now()
  const res = await fetch(cfg.base.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cfg.key
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools: tools.length ? tools : undefined
    })
  })
  trace?.(`↗ POST <code>${esc(host)}/chat/completions</code> → ${res.status}（${Math.round(performance.now() - t0)}ms）`)
  if (!res.ok) throw new Error(`LLM API ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message ?? { content: '(空回复)' }
}
