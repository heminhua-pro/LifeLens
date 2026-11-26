<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ChartResult } from '../runtime/types'
import { ui, t } from '../theme'

// 按需注册：折线 / 柱状 / 饼图 + 网格 / 提示框 / 图例 / 参考线
echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer, TitleComponent])

const props = defineProps<{ chart: ChartResult }>()
const box = ref<HTMLDivElement>()
let inst: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

/**
 * 深度清洗 LLM 生成 option 里「只接受函数」的字段：
 * JSON 没法携带函数，LLM 若输出了 valueFormatter 等回调字段（常是字符串），
 * ECharts 运行时会抛 "xxx is not a function"。这里直接剔除非函数版本。
 * formatter / position 等同时接受字符串模板的字段不受影响，予以保留。
 */
function sanitizeFunctionOnlyFields(obj: unknown): void {
  if (Array.isArray(obj)) { obj.forEach(sanitizeFunctionOnlyFields); return }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj as Record<string, unknown>)) {
      if (k === 'valueFormatter' && typeof (obj as Record<string, unknown>)[k] !== 'function') {
        delete (obj as Record<string, unknown>)[k]
        continue
      }
      sanitizeFunctionOnlyFields((obj as Record<string, unknown>)[k])
    }
  }
}

/** 按当前明暗主题修补图表中性色（数据系列色来自 LLM，保持原样） */
function themed(option: unknown): Record<string, unknown> {
  const opt = JSON.parse(JSON.stringify(option)) as Record<string, any>
  sanitizeFunctionOnlyFields(opt)
  const dark = ui.mode === 'dark'
  const axisColor = dark ? '#a8b3c4' : '#8b90a0'
  const axisLine = dark ? '#47506e' : '#d9dcef'
  const splitLine = dark ? '#323a52' : '#e6e8f4'
  for (const key of ['xAxis', 'yAxis']) {
    if (opt[key]) {
      opt[key].axisLabel = { ...opt[key].axisLabel, color: axisColor, fontSize: 12, hideOverlap: true }
      opt[key].axisLine = { ...opt[key].axisLine, lineStyle: { ...(opt[key].axisLine?.lineStyle || {}), color: axisLine } }
      opt[key].splitLine = { ...opt[key].splitLine, lineStyle: { ...(opt[key].splitLine?.lineStyle || {}), color: splitLine } }
    }
  }
  if (opt.tooltip) {
    opt.tooltip.backgroundColor = dark ? '#1f2230' : '#ffffff'
    opt.tooltip.borderColor = dark ? '#5c658a' : '#c7cbf0'
    opt.tooltip.textStyle = { ...opt.tooltip.textStyle, color: dark ? '#e5e7eb' : '#1f2329' }
  }
  if (opt.legend) opt.legend.textStyle = { ...opt.legend.textStyle, color: dark ? '#e5e7eb' : '#1f2329' }
  for (const s of opt.series || []) {
    if (s.type === 'pie' && s.label) s.label.color = dark ? '#e5e7eb' : '#1f2329'
    if (s.markLine) {
      // 参考线标签默认画在网格外，宽度 100% 时会被画布右缘裁掉；未显式指定位置时改画到网格内部
      if (s.markLine.label && !s.markLine.label.position) s.markLine.label.position = 'insideEndTop'
      for (const d of Array.isArray(s.markLine.data) ? s.markLine.data : []) {
        if (d.label && !d.label.position) d.label.position = 'insideEndTop'
      }
    }
  }
  return opt
}

/** 渲染兜底：清洗之外的 option 异常只记录日志，不崩整个应用 */
function apply(c: ChartResult) {
  try { inst?.setOption(themed(c.echartsOption) as any, true) }
  catch (e) { console.error('[ChartCard] 图表 option 渲染失败:', e) }
}

onMounted(() => {
  if (box.value) {
    inst = echarts.init(box.value)
    apply(props.chart)
    // 宽度 100% 后随容器自适应
    ro = new ResizeObserver(() => inst?.resize())
    ro.observe(box.value)
  }
})

/** 把当前图表导出为 2x 高清 PNG 下载到本地 */
function downloadChart() {
  if (!inst) return
  const dark = ui.mode === 'dark'
  const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: dark ? '#1a1d29' : '#ffffff' })
  const a = document.createElement('a')
  a.href = url
  a.download = (props.chart.summary || 'chart').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) + '.png'
  a.click()
}
watch(() => props.chart, c => apply(c))
watch(() => ui.mode, () => apply(props.chart))
onBeforeUnmount(() => {
  ro?.disconnect()
  inst?.dispose()
})
</script>

<template>
  <div class="chart-card">
    <div class="chart-summary">📊 {{ chart.summary }}</div>
    <div ref="box" class="chart-box"></div>
    <div class="chart-actions">
      <a-button @click="downloadChart">{{ t('download') }}</a-button>
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 8px; margin-top: 8px; box-shadow: var(--shadow); transition: background .25s ease;
}
.chart-summary { font-size: 12px; color: var(--muted); padding: 4px 6px;margin-bottom: 16px; }
.chart-box { width: 100%; height: 280px; }
.chart-actions { padding: 4px 6px 2px; }
</style>
