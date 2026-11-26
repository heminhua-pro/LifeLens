/** OAWC MVP Profile 0.2 相关类型定义 */

export interface ParamSchema {
  type: string
  properties?: Record<string, { type: string; description?: string; enum?: string[]; enumLabels?: Record<string, string> }>
  required?: string[]
}

export interface AgentDef {
  name: string
  function: { description: string; parameters: ParamSchema }
  instructions: string
  tools?: string[]
  actions?: string[]
}

/** 站点动作（grounded capability）：agent 可调用、对外部环境产生实际效果的工具 */
export interface ActionDef {
  name: string
  description: string
  parameters: ParamSchema
}

export interface Network {
  metadata: { description: string }
  tools: AgentDef[]
}

export interface Manifest {
  name: string
  front_man: string
  hocon: string
  'peer-link'?: Record<string, string>
  'peer-policy'?: { allow?: string[] }
}

export interface LlmConfig {
  base: string
  key: string
  model: string
}

export interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface LlmTool {
  type: 'function'
  function: { name: string; description: string; parameters: ParamSchema }
}

export interface ChartResult {
  summary: string
  echartsOption: Record<string, unknown>
}

export interface PeerInfo {
  label: string
  url: string
  approved: boolean
  error?: string
  agents?: Record<string, AgentDef>
}
