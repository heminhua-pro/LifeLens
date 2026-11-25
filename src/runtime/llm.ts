import type { ChatMessage, LlmConfig, LlmTool, ToolCall } from './types'
import { isMock } from './config'
import { mockLLM } from './mock'

/** OpenAI 兼容 /chat/completions 调用（BYOK，Key 只在浏览器） */
export async function callLLM(
  messages: ChatMessage[],
  tools: LlmTool[],
  cfg: LlmConfig
): Promise<{ content?: string; tool_calls?: ToolCall[] }> {
  if (isMock(cfg)) return mockLLM(messages, tools)
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
  if (!res.ok) throw new Error(`LLM API ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message ?? { content: '(空回复)' }
}
