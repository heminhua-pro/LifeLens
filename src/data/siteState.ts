/**
 * 站点数据：data_analyst / chart_designer 只准引用这里，防止编造。
 *
 * 数据来源（构建时由 vite.config 的 @health-data 别名解析）：
 * - 本机存在 src/data/healthData.local.json（gitignored，Apple Health 真实导出转换）→ 用真实数据
 * - 否则回落 src/data/healthData.sample.json（仓库自带合成样例，统计特征对齐、无个人隐私）
 *
 * 想接入自己的数据：把 Apple Health 导出转换成 { sleep, steps, energy, walkingSpeed, headphoneDb }
 * 五个数组（元素形如 { date, hours|steps|kcal|mps|db }），存为 healthData.local.json 即可。
 */
import health from '@health-data'

const N = 30
type Pt = { date: string; hours?: number; steps?: number; kcal?: number; mps?: number; db?: number }
const arr = (key: keyof Pt) => (health as unknown as Record<string, Pt[]>)[key] as Pt[]

const sleepAll = arr('sleep')
const stepsAll = arr('steps')
const energyAll = arr('energy')
const walkAll = arr('walkingSpeed')
const dbAll = arr('headphoneDb')

const win = (a: Pt[], n = N) => a.slice(-n)

export const SITE_STATE = {
  month: '最近30天',
  // 各维度真实时间范围（传感器能力与记录起始时间不同，跨度不齐，须如实标注）
  windowSleep: `${sleepAll.at(-N)?.date ?? '?'} ~ ${sleepAll.at(-1)?.date ?? '?'}`,
  windowSteps: `${stepsAll.at(-N)?.date ?? '?'} ~ ${stepsAll.at(-1)?.date ?? '?'}`,
  windowEnergy: `${energyAll.at(-N)?.date ?? '?'} ~ ${energyAll.at(-1)?.date ?? '?'}`,
  windowWalkingSpeed: `${walkAll.at(-N)?.date ?? '?'} ~ ${walkAll.at(-1)?.date ?? '?'}`,
  windowHeadphoneDb: `${dbAll.at(-N)?.date ?? '?'} ~ ${dbAll.at(-1)?.date ?? '?'}`,

  sleep: win(sleepAll).map(d => d.hours!),
  sleepDates: win(sleepAll).map(d => d.date),
  steps: win(stepsAll).map(d => d.steps!),
  stepsDates: win(stepsAll).map(d => d.date),
  energy: win(energyAll).map(d => d.kcal!),
  energyDates: win(energyAll).map(d => d.date),
  walkingSpeed: win(walkAll).map(d => d.mps!),
  walkingSpeedDates: win(walkAll).map(d => d.date),
  headphoneDb: win(dbAll).map(d => d.db!),
  headphoneDbDates: win(dbAll).map(d => d.date)
}

/** 完整历史：睡眠(2026-06起) / 步数(2019起) / 热量(2019起) / 步速(2021起) / 音量(2020起) */
export const FULL_HISTORY = {
  sleep: sleepAll,
  steps: stepsAll,
  energy: energyAll,
  walkingSpeed: walkAll,
  headphoneDb: dbAll
}
