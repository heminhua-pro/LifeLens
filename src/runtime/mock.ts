import type { AgentDef, ChatMessage, LlmTool } from './types'
import { SITE_STATE } from '../data/siteState'

function stat(arr: number[]) {
  return {
    avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    max: Math.max(...arr),
    min: Math.min(...arr)
  }
}

const f1 = (n: number) => n.toFixed(1)

/** 趋势：首段 vs 尾段均值对比，动态判定上升/下降/平稳 */
function trendWord(arr: number[]): string {
  if (arr.length < 6) return '走势平稳'
  const k = Math.max(2, Math.floor(arr.length / 3))
  const head = arr.slice(0, k).reduce((a, b) => a + b, 0) / k
  const tail = arr.slice(-k).reduce((a, b) => a + b, 0) / k
  if (head === 0) return '走势平稳'
  const diff = (tail - head) / head
  if (diff > 0.08) return '近期呈上升趋势'
  if (diff < -0.08) return '近期呈下降趋势'
  return '整体走势平稳'
}

/** 波动：极差/均值 的变异幅度 */
function volatility(arr: number[]): string {
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  if (avg === 0) return '波动很小'
  const cv = (Math.max(...arr) - Math.min(...arr)) / avg
  return cv > 0.4 ? '波动较大' : '波动较小'
}

/** 周末 vs 工作日均值差（按真实日期判定周末） */
function weekendGap(dates: string[], vals: number[]): string {
  let wd = 0, wdN = 0, we = 0, weN = 0
  dates.forEach((d, i) => {
    const day = new Date(d + 'T00:00:00').getDay()
    if (day === 0 || day === 6) { we += vals[i]; weN++ } else { wd += vals[i]; wdN++ }
  })
  if (!weN || !wdN) return ''
  const gap = we / weN - wd / wdN
  const pct = Math.abs(gap / (wd / wdN)) * 100
  if (pct < 8) return '周末与工作日基本持平'
  return gap > 0 ? `周末比工作日多约 ${Math.round(pct)}%` : `工作日比周末多约 ${Math.round(pct)}%`
}

/** Pearson 相关系数（用于跨维度交叉洞察） */
function corr(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 5) return null
  const x = a.slice(-n), y = b.slice(-n)
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    dx += (x[i] - mx) ** 2
    dy += (y[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null
}

function mockAnalyst(inquiry: string): string {
  const s = stat(SITE_STATE.sleep)
  const st = stat(SITE_STATE.steps)
  const en = stat(SITE_STATE.energy)
  const ws = stat(SITE_STATE.walkingSpeed)
  const db = stat(SITE_STATE.headphoneDb)

  if (inquiry.includes('睡眠'))
    return JSON.stringify({
      summary: `${SITE_STATE.windowSleep} 平均睡眠 ${s.avg} 小时（${f1(s.min)}~${f1(s.max)}h），${volatility(SITE_STATE.sleep)}，${trendWord(SITE_STATE.sleep)}；${+s.avg >= 7 ? '达到 7 小时建议线' : '低于 7 小时建议线'}${SITE_STATE.sleepSampled ? `（${SITE_STATE.sleepSampled}）` : ''}`,
      stats: s,
      metric: 'sleep'
    })
  if (inquiry.includes('热量') || inquiry.includes('卡路里') || inquiry.includes('消耗')) {
    const r = corr(SITE_STATE.energy, SITE_STATE.steps)
    const cross = r !== null && Math.abs(r) > 0.5
      ? `，与步数呈${r > 0 ? '正' : '负'}相关（r=${f1(r)}）`
      : ''
    return JSON.stringify({
      summary: `${SITE_STATE.windowEnergy} 平均每日活动消耗 ${en.avg} kcal，最高的一天达到 ${f1(en.max)} kcal，${trendWord(SITE_STATE.energy)}${cross}${SITE_STATE.energySampled ? `（${SITE_STATE.energySampled}）` : ''}`,
      stats: en, metric: 'energy'
    })
  }
  if (inquiry.includes('耳机') || inquiry.includes('音量')) {
    const over = SITE_STATE.headphoneDb.filter(v => v >= 80).length
    return JSON.stringify({
      summary: `${SITE_STATE.windowHeadphoneDb} 日均耳机音量暴露 ${db.avg} dB，最高 ${f1(db.max)} dB，${over ? `有 ${over} 天达到或超过 WHO 80dB 安全线` : '无一天超过 WHO 80dB 安全线'}，${trendWord(SITE_STATE.headphoneDb)}${SITE_STATE.headphoneDbSampled ? `（${SITE_STATE.headphoneDbSampled}）` : ''}`,
      stats: db, metric: 'headphone_db'
    })
  }
  if (inquiry.includes('步速') || inquiry.includes('走路'))
    return JSON.stringify({
      summary: `${SITE_STATE.windowWalkingSpeed} 平均步行速度 ${ws.avg} m/s（${f1(ws.min)}~${f1(ws.max)} m/s），${volatility(SITE_STATE.walkingSpeed)}，${trendWord(SITE_STATE.walkingSpeed)}；含跑步等运动样本，数值高于纯步行${SITE_STATE.walkingSpeedSampled ? `（${SITE_STATE.walkingSpeedSampled}）` : ''}`,
      stats: ws, metric: 'walking_speed'
    })
  const gap = weekendGap(SITE_STATE.stepsDates, SITE_STATE.steps)
  return JSON.stringify({
    summary: `${SITE_STATE.windowSteps} 日均步数 ${st.avg}，最高 ${st.max} 步，${trendWord(SITE_STATE.steps)}${gap ? '，' + gap : ''}${SITE_STATE.stepsSampled ? `（${SITE_STATE.stepsSampled}）` : ''}`,
    stats: st, metric: 'steps'
  })
}

function axis() {
  return { axisLabel: { color: '#8b90a0', fontSize: 12 }, axisLine: { lineStyle: { color: '#d9dcef' } } }
}

function mockChart(metric: string, insight: string): string {
  if (metric === 'sleep')
    return JSON.stringify({
      summary: insight || `平均睡眠 ${stat(SITE_STATE.sleep).avg} 小时，${trendWord(SITE_STATE.sleep)}`,
      echartsOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 16, top: 30, bottom: 28 },
        xAxis: { type: 'category', data: SITE_STATE.sleepDates, ...axis() },        yAxis: { type: 'value', name: '小时', min: (v: { min: number }) => Math.max(0, Math.floor(v.min - 0.5)), ...axis() },
        series: [{
          type: 'line', data: SITE_STATE.sleep, smooth: true, symbol: 'none',
          lineStyle: { color: '#7c6cff', width: 2 },
          areaStyle: { color: 'rgba(124,108,255,.14)' },
          markLine: { silent: true, lineStyle: { color: '#d97706' }, data: [{ yAxis: 7, label: { formatter: '建议 7h', color: '#d97706' } }] }
        }]
      }
    })
  if (metric === 'steps')
    return JSON.stringify({
      summary: insight || `日均步数 ${stat(SITE_STATE.steps).avg}，${trendWord(SITE_STATE.steps)}`,
      echartsOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: 44, right: 16, top: 30, bottom: 28 },
        xAxis: { type: 'category', data: SITE_STATE.stepsDates, ...axis() },
        yAxis: { type: 'value', name: '步', ...axis() },
        series: [{ type: 'bar', data: SITE_STATE.steps, itemStyle: { color: '#7c6cff', borderRadius: [3, 3, 0, 0], opacity: .85 } }]
      }
    })
  if (metric === 'energy')
    return JSON.stringify({
      summary: insight || `日均消耗 ${stat(SITE_STATE.energy).avg} kcal，${trendWord(SITE_STATE.energy)}`,
      echartsOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: 48, right: 16, top: 30, bottom: 28 },
        xAxis: { type: 'category', data: SITE_STATE.energyDates, ...axis() },
        yAxis: { type: 'value', name: 'kcal', ...axis() },
        series: [{ type: 'bar', data: SITE_STATE.energy, itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0], opacity: .85 } }]
      }
    })
  if (metric === 'walking_speed')
    return JSON.stringify({
      summary: insight || `平均步速 ${stat(SITE_STATE.walkingSpeed).avg} m/s，${trendWord(SITE_STATE.walkingSpeed)}`,
      echartsOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: 48, right: 16, top: 30, bottom: 28 },
        xAxis: { type: 'category', data: SITE_STATE.walkingSpeedDates, ...axis() },
        yAxis: { type: 'value', name: 'm/s', min: (v: { min: number }) => Math.max(0, Math.floor((v.min - 0.1) * 10) / 10), ...axis() },
        series: [{
          type: 'line', data: SITE_STATE.walkingSpeed, smooth: true, symbol: 'none',
          lineStyle: { color: '#22d3ee', width: 2 },
          areaStyle: { color: 'rgba(34,211,238,.12)' }
        }]
      }
    })
  if (metric === 'headphone_db')
    return JSON.stringify({
      summary: insight || `日均耳机音量 ${stat(SITE_STATE.headphoneDb).avg} dB，${trendWord(SITE_STATE.headphoneDb)}`,
      echartsOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: 48, right: 16, top: 30, bottom: 28 },
        xAxis: { type: 'category', data: SITE_STATE.headphoneDbDates, ...axis() },
        yAxis: { type: 'value', name: 'dB', min: (v: { min: number }) => Math.max(0, Math.floor(v.min - 5)), ...axis() },
        series: [{
          type: 'line', data: SITE_STATE.headphoneDb, smooth: true, symbol: 'none',
          lineStyle: { color: '#ef4444', width: 2 },
          areaStyle: { color: 'rgba(239,68,68,.10)' },
          markLine: { silent: true, lineStyle: { color: '#d97706' }, data: [{ yAxis: 80, label: { formatter: 'WHO 80dB', color: '#d97706' } }] }
        }]
      }
    })
  return JSON.stringify({
    summary: insight || `日均步数 ${stat(SITE_STATE.steps).avg}，${trendWord(SITE_STATE.steps)}`,
    echartsOption: {
      tooltip: { trigger: 'axis' },
      grid: { left: 44, right: 16, top: 30, bottom: 28 },
      xAxis: { type: 'category', data: SITE_STATE.stepsDates, ...axis() },
      yAxis: { type: 'value', name: '步', ...axis() },
      series: [{ type: 'bar', data: SITE_STATE.steps, itemStyle: { color: '#7c6cff', borderRadius: [3, 3, 0, 0], opacity: .85 } }]
    }
  })
}

/**
 * Mock 模式：本地模拟完整委派链 + 真实计算，保证无 Key 也能演示全流程。
 * 通过 instructions 中的稳定关键词识别当前 agent（不依赖 description）。
 */
export function mockLLM(messages: ChatMessage[], tools: LlmTool[]): { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } {
  const sys = messages[0].content
  const user = messages[messages.length - 1].content
  const toolResults = messages.filter(m => m.role === 'tool')

  if (sys.includes('前台协调员')) {
    let inquiry = user
    try { inquiry = JSON.parse(user).inquiry || user } catch { /* ignore */ }
    if (!toolResults.length) {
      // 跨站演示：用户点名 health_hub / WHO 基准时，委派对等智能体（需已批准，工具列表里才有）
      if (tools.some(tool => tool.function.name === 'delegate_who_benchmark_advisor') &&
          /health_hub|health hub|WHO|基准|健康评估/i.test(inquiry)) {
        const metric = /音量|耳机/.test(inquiry) ? 'headphone_db' : /步/.test(inquiry) ? 'steps' : 'sleep'
        const arr = metric === 'headphone_db' ? SITE_STATE.headphoneDb : metric === 'steps' ? SITE_STATE.steps : SITE_STATE.sleep
        return {
          tool_calls: [{
            id: 'm3',
            function: {
              name: 'delegate_who_benchmark_advisor',
              arguments: JSON.stringify({
                metric,
                summary: JSON.parse(mockAnalyst(metric === 'headphone_db' ? '耳机音量' : metric === 'steps' ? '步数' : '睡眠')).summary,
                stats: stat(arr)
              })
            }
          }]
        }
      }
      return { tool_calls: [{ id: 'm1', function: { name: 'delegate_data_analyst', arguments: JSON.stringify({ inquiry }) } }] }
    }
    // 对等智能体已返回 WHO 评估 → 直接总结（不再走图表链）
    const verdictMsg = toolResults.find(m => m.content.includes('verdict'))
    if (verdictMsg) {
      let v: { verdict?: string; advice?: string } = {}
      try { v = JSON.parse(verdictMsg.content.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { /* ignore */ }
      return { content: `🩺 Health Hub 评估结果：${v.verdict || '（无结论）'}\n${v.advice || ''}` }
    }
    if (!toolResults.some(m => m.content.includes('echartsOption'))) {
      let analysis: { metric?: string; summary?: string } = {}
      try { analysis = JSON.parse(toolResults[0].content.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { /* ignore */ }
      return {
        tool_calls: [{
          id: 'm2',
          function: {
            name: 'delegate_chart_designer',
            arguments: JSON.stringify({ metric: analysis.metric || 'sleep', insight: analysis.summary || '暂无洞察' })
          }
        }]
      }
    }
    const chart = JSON.parse(toolResults.find(m => m.content.includes('echartsOption'))!.content)
    return { content: `📊 ${chart.summary}\n（图表已生成在下方，点「⬇ 下载图表 (PNG)」保存到本地）` }
  }
  if (sys.includes('SITE_STATE')) {
    let inquiry = ''
    try { inquiry = JSON.parse(user).inquiry || '' } catch { /* ignore */ }
    return { content: mockAnalyst(inquiry) }
  }
  if (sys.includes('echartsOption')) {
    try {
      const p = JSON.parse(user)
      return { content: mockChart(p.metric, p.insight) }
    } catch {
      return { content: mockChart('sleep', '') }
    }
  }
  if (sys.includes('WHO 基准顾问')) {
    let p: { metric?: string; summary?: string; stats?: { avg?: number; max?: number } } = {}
    try { p = JSON.parse(user) } catch { /* ignore */ }
    const avg = p.stats?.avg ?? 0
    const max = p.stats?.max ?? 0
    const rules: Record<string, { unit: string; limit: string; ok: (a: number, m: number) => boolean; okTip: string; badTip: string }> = {
      sleep: { unit: '小时', limit: '7-9', ok: (a) => a >= 7, okTip: '睡眠时长达标，建议保持规律作息', badTip: '睡眠低于 WHO 建议的 7 小时，建议提前入睡并减少睡前屏幕时间' },
      headphone_db: { unit: 'dB', limit: '80', ok: (a, m) => m <= 80, okTip: '音量暴露在 WHO 80dB 安全线内，听觉风险较低', badTip: '存在超过 WHO 80dB 安全线的暴露日，建议开启限音功能并减少单次连续收听时长' },
      steps: { unit: '步', limit: '7000-10000', ok: (a) => a >= 7000, okTip: '日均步数达到有益健康的区间，继续保持', badTip: '日均步数低于 7000 步的友好基准，建议利用碎片时间多走动' }
    }
    const r = rules[p.metric || ''] || rules.steps
    const verdict = r.ok(avg, max) ? '达标' : (p.metric === 'headphone_db' ? '超标' : '需注意')
    return { content: JSON.stringify({ verdict, advice: `${p.summary || '统计数据'}。对照 WHO 基准（${r.limit}${r.unit}）：${r.ok(avg, max) ? r.okTip : r.badTip}。` }) }
  }
  return { content: '(Mock) 未匹配到 agent' }
}
