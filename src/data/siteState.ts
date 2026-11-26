/**
 * 站点数据：data_analyst / chart_designer 只准引用这里，防止编造。
 *
 * 数据来源（构建时由 vite.config 的 @health-data 别名解析）：
 * - 本机存在 src/data/healthData.local.json（gitignored，Apple Health 真实导出转换）→ 用真实数据
 * - 否则回落 src/data/healthData.sample.json（仓库自带合成样例，统计特征对齐、无个人隐私）
 *
 * 想接入自己的数据：把 Apple Health 导出转换成 { sleep, steps, energy, walkingSpeed, headphoneDb }
 * 五个数组（元素形如 { date, hours|steps|kcal|mps|db }），存为 healthData.local.json 即可。
 *
 * 注入策略：数据有多少注入多少（全量历史，不固定 30 天）；仅当单维度点数超过
 * MAX_POINTS 时在站点层面均匀抽样并如实标注 sampled 说明——LLM 禁止再增删数据点。
 */
import health from '@health-data'

type Pt = { date: string; hours?: number; steps?: number; kcal?: number; mps?: number; db?: number }
type DataKey = 'sleep' | 'steps' | 'energy' | 'walkingSpeed' | 'headphoneDb'
const arr = (key: DataKey) => (health as unknown as Record<DataKey, Pt[]>)[key]

const MAX_POINTS = 400

interface Fit { values: number[]; dates: string[]; range: string; sampled: string; rawCount: number }

function fit(pts: Pt[], pick: (d: Pt) => number | undefined): Fit {
  const clean = pts.filter(d => Number.isFinite(pick(d)))
  if (!clean.length) return { values: [], dates: [], range: '无数据', sampled: '', rawCount: 0 }
  const range = `${clean[0].date} ~ ${clean[clean.length - 1].date}`
  if (clean.length <= MAX_POINTS)
    return { values: clean.map(pick), dates: clean.map(d => d.date), range, sampled: '', rawCount: clean.length }
  const stride = Math.ceil(clean.length / MAX_POINTS)
  const kept = clean.filter((_, i) => i % stride === 0)
  return {
    values: kept.map(pick),
    dates: kept.map(d => d.date),
    range,
    sampled: `原始共 ${clean.length} 天，为控制上下文体积按每 ${stride} 天取样展示`,
    rawCount: clean.length
  }
}

const sleepFit = fit(arr('sleep'), d => d.hours)
const stepsFit = fit(arr('steps'), d => d.steps)
const energyFit = fit(arr('energy'), d => d.kcal)
const walkFit = fit(arr('walkingSpeed'), d => d.mps)
const dbFit = fit(arr('headphoneDb'), d => d.db)

export const SITE_STATE = {
  // 各维度全量时间范围（传感器能力与记录起始时间不同，跨度不齐，须如实标注）
  windowSleep: sleepFit.range,
  windowSteps: stepsFit.range,
  windowEnergy: energyFit.range,
  windowWalkingSpeed: walkFit.range,
  windowHeadphoneDb: dbFit.range,
  // 超过 MAX_POINTS 时的抽样说明（未超则为空串）
  sleepSampled: sleepFit.sampled,
  stepsSampled: stepsFit.sampled,
  energySampled: energyFit.sampled,
  walkingSpeedSampled: walkFit.sampled,
  headphoneDbSampled: dbFit.sampled,

  sleep: sleepFit.values,
  sleepDates: sleepFit.dates,
  steps: stepsFit.values,
  stepsDates: stepsFit.dates,
  energy: energyFit.values,
  energyDates: energyFit.dates,
  walkingSpeed: walkFit.values,
  walkingSpeedDates: walkFit.dates,
  headphoneDb: dbFit.values,
  headphoneDbDates: dbFit.dates
}

/** 完整历史（未抽样）：睡眠 / 步数 / 热量 / 步速 / 音量，供站点自身扩展使用 */
export const FULL_HISTORY = {
  sleep: arr('sleep'),
  steps: arr('steps'),
  energy: arr('energy'),
  walkingSpeed: arr('walkingSpeed'),
  headphoneDb: arr('headphoneDb')
}
