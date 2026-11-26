import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { SITE_STATE } from '../data/siteState'
import { METRIC_LABELS } from './actions'
import { analysisSummary, chartOption } from './mock'

// 与 ChartCard 同一套按需注册（重复 use 幂等），保证导出图与页面所见一致
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

export const METRIC_META: Record<string, { unit: string; values: number[]; dates: string[]; window: string; sampled: string }> = {
  sleep: { unit: '小时', values: SITE_STATE.sleep, dates: SITE_STATE.sleepDates, window: SITE_STATE.windowSleep, sampled: SITE_STATE.sleepSampled },
  steps: { unit: '步', values: SITE_STATE.steps, dates: SITE_STATE.stepsDates, window: SITE_STATE.windowSteps, sampled: SITE_STATE.stepsSampled },
  energy: { unit: 'kcal', values: SITE_STATE.energy, dates: SITE_STATE.energyDates, window: SITE_STATE.windowEnergy, sampled: SITE_STATE.energySampled },
  walking_speed: { unit: 'm/s', values: SITE_STATE.walkingSpeed, dates: SITE_STATE.walkingSpeedDates, window: SITE_STATE.windowWalkingSpeed, sampled: SITE_STATE.walkingSpeedSampled },
  headphone_db: { unit: 'dB', values: SITE_STATE.headphoneDb, dates: SITE_STATE.headphoneDbDates, window: SITE_STATE.windowHeadphoneDb, sampled: SITE_STATE.headphoneDbSampled }
}

/** 用与页面相同的 option 离屏渲染一张 2x PNG，返回 dataURL（保证报告图文一致） */
function renderChartPng(metric: string): string {
  const div = document.createElement('div')
  div.style.cssText = 'position:fixed;left:-99999px;top:0;width:760px;height:320px;'
  document.body.appendChild(div)
  let url = ''
  try {
    const inst = echarts.init(div)
    inst.setOption(chartOption(metric) as any, true)
    url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
    inst.dispose()
  } finally {
    div.remove()
  }
  return url
}

/** 生成完整的分析报告 Markdown：分析结论 + 内嵌图表 + 逐日数据 */
export function buildReport(metric: string): string {
  const label = METRIC_LABELS[metric] || metric
  const meta = METRIC_META[metric] || METRIC_META.sleep
  const vals = meta.values
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A'
  const max = vals.length ? Math.max(...vals) : 'N/A'
  const min = vals.length ? Math.min(...vals) : 'N/A'
  const insight = analysisSummary(metric)
  const png = renderChartPng(metric)
  const rows = vals.map((v, i) => `| ${meta.dates[i] || ''} | ${v} |`).join('\n')

  return [
    `# LifeLens · ${label}数据分析报告`,
    '',
    `- 统计窗口：${meta.window}`,
    `- 数据点数：${vals.length}`,
    `- 平均值：${avg} ${meta.unit} ｜ 最大值：${max} ${meta.unit} ｜ 最小值：${min} ${meta.unit}`,
    ...(meta.sampled ? [`- 抽样说明：${meta.sampled}`] : []),
    '',
    '## 📊 分析结论',
    '',
    insight || '（暂无分析结论）',
    '',
    '## 📈 趋势图',
    '',
    `![${label}趋势图](data:image/png;base64,${png.replace(/^data:image\/png;base64,/, '')})`,
    '',
    '## 📋 逐日数据',
    '',
    `| 日期 | 数值（${meta.unit}） |`,
    '| --- | --- |',
    rows,
    '',
    '> 本报告由 LifeLens 在你的浏览器本地生成，原始健康数据未上传至任何服务器。'
  ].join('\n')
}
