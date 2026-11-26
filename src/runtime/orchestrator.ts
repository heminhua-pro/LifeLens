import type { AgentDef, ChartResult, ChatMessage, LlmTool } from './types'
import { callLLM } from './llm'
import { loadCfg } from './config'
import { SITE_STATE } from '../data/siteState'

export type TraceFn = (html: string) => void

export function systemFor(agent: AgentDef): string {
  let s = agent.instructions
  if (agent.name === 'data_analyst' || agent.name === 'chart_designer')
    // 全量站点数据只注入提示词、不出浏览器；禁止模型编造或增删数据点
    s += '\n站点数据(JSON)：' + JSON.stringify(SITE_STATE)
  if (agent.name === 'chart_designer')
    s += '\n图表的 x 轴/数据系列必须使用上面站点数据中的全部数据点（站点已控制注入体积；若某维度带 sampled 抽样标注，图表须照实呈现），禁止编造、增加或删减数据点；数据点较多时坐标轴标签稀疏显示（axisLabel interval）以免重叠。'
  if (agent.name === 'chart_designer')
    s += '\n配色使用 #7c6cff 为主色调，坐标轴文字 #8b90a0。'
  return s
}

/** 从 agent 回复文本中提取图表 JSON；无图表时返回 null */
export function extractChart(text: string): ChartResult | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced
    ? fenced[1]
    : text.includes('{')
      ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
      : null
  if (!raw) return null
  try {
    const json = JSON.parse(raw)
    if (json && json.echartsOption)
      return { summary: json.summary || '', echartsOption: json.echartsOption }
  } catch { /* 非 JSON 回复 */ }
  return null
}

export interface AgentRunResult {
  content: string
  /** 委派链中 chart_designer 产出的图表（向上冒泡），与最终文本是否回贴 JSON 无关 */
  chart: ChartResult | null
}

/**
 * 核心委派循环：
 * agent.tools 声明的下游 + （仅入口 agent）已批准的对等 agent，
 * 都被转换为 LLM function 定义；委派 = 递归 run()。
 */
export async function runAgent(
  agents: Record<string, AgentDef>,
  peerAgents: Record<string, AgentDef>,
  agentName: string,
  params: Record<string, unknown>,
  trace: TraceFn,
  depth = 0
): Promise<AgentRunResult> {
  const agent = agents[agentName] || peerAgents[agentName]
  if (!agent) throw new Error(`未找到 agent: ${agentName}`)
  if (depth > 6) return { content: '(超过委派深度上限)', chart: null }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemFor(agent) },
    { role: 'user', content: JSON.stringify(params) }
  ]

  const llmTools: LlmTool[] = (agent.tools || [])
    .filter(name => agents[name] || peerAgents[name])
    .map(name => {
      const t = agents[name] || peerAgents[name]
      return {
        type: 'function' as const,
        function: {
          name: 'delegate_' + name,
          description: `委派给 ${name}：${t.function.description}`,
          parameters: t.function.parameters
        }
      }
    })
  // 入口 agent 额外暴露已批准的 peer agents（跨站委派）
  if (depth === 0) {
    for (const name of Object.keys(peerAgents)) {
      if (agent.tools?.includes(name)) continue
      const t = peerAgents[name]
      llmTools.push({
        type: 'function',
        function: {
          name: 'delegate_' + name,
          description: `委派给对等站点 agent ${name}：${t.function.description}`,
          parameters: t.function.parameters
        }
      })
    }
  }

  let bubbledChart: ChartResult | null = null
  for (let i = 0; i < 5; i++) {
    const reply = await callLLM(messages, llmTools, loadCfg())
    if (reply.tool_calls?.length) {
      messages.push({ role: 'assistant', content: reply.content || '', tool_calls: reply.tool_calls })
      for (const tc of reply.tool_calls) {
        const fn = tc.function.name
        if (!fn.startsWith('delegate_')) continue
        const sub = fn.slice('delegate_'.length)
        if (!agents[sub] && !peerAgents[sub]) continue
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(tc.function.arguments || '{}') } catch { /* ignore */ }
        trace(`委派 <b>${agentName}</b> → <b>${sub}</b>${peerAgents[sub] && !agents[sub] ? '（跨站）' : ''}`)
        const subResult = await runAgent(agents, peerAgents, sub, args, trace, depth + 1)
        if (subResult.chart) bubbledChart = subResult.chart
        messages.push({ role: 'tool', tool_call_id: tc.id, content: String(subResult.content).slice(0, 4000) })
      }
      continue
    }
    const content = reply.content || '(空回复)'
    return { content, chart: bubbledChart ?? extractChart(content) }
  }
  return { content: '(超过委派轮次上限)', chart: bubbledChart }
}
