import { reactive } from 'vue'
import { message } from 'ant-design-vue'
import type { AgentDef, ChartResult, Manifest, Network, PeerInfo } from './runtime/types'
import { loadManifest, loadNetwork, loadPeer } from './runtime/manifest'
import { loadCfg, saveCfg } from './runtime/config'
import { runAgent, extractChart, type TraceFn } from './runtime/orchestrator'
import { METRIC_LABELS } from './runtime/actions'
import { buildReport } from './runtime/report'

export interface Msg {
  id: number
  kind: 'user' | 'bot' | 'trace'
  ts: number
  who?: string
  text?: string
  html?: string
  chart?: ChartResult
}

export const store = reactive({
  booted: false,
  manifest: null as Manifest | null,
  agents: {} as Record<string, AgentDef>,
  peers: [] as PeerInfo[],
  messages: [] as Msg[],
  loading: false,
  currentAgent: '' as string,
  formAgent: null as AgentDef | null,
  showSettings: false,
  showConfirm: false,
  confirmTitle: '',
  confirmDetail: '',
  confirmLoading: false,
  cfg: loadCfg()
})

let nextId = 1
const pushMsg = (m: Omit<Msg, 'id' | 'ts'>) => { store.messages.push({ id: nextId++, ts: Date.now(), ...m }) }

/* ---------- 启动：加载 manifest / network ---------- */
export async function boot() {
  try {
    const { manifest, url } = await loadManifest()
    store.manifest = manifest
    const network = await loadNetwork(manifest, url)
    network.tools.forEach(t => (store.agents[t.name] = t))
    store.peers = Object.entries(store.manifest['peer-link'] || {}).map(([label, url]) => ({
      label, url, approved: false
    }))
    store.currentAgent = store.manifest.front_man
    mergeCustomPeers()
    store.booted = true
  } catch (e) {
    pushMsg({ kind: 'bot', who: 'runtime', text: '❌ 启动失败：' + (e as Error).message })
  }
}

/** 语言切换后按新语言目录重载 manifest / network（保留已批准的对等站点与聊天记录） */
export async function reloadForLang() {
  try {
    const { manifest, url } = await loadManifest()
    const network = await loadNetwork(manifest, url)
    store.manifest = manifest
    store.agents = {}
    network.tools.forEach(t => (store.agents[t.name] = t))
    store.peers = Object.entries(manifest['peer-link'] || {}).map(([label, url]) => {
      const old = store.peers.find(p => p.label === label && p.url === url)
      return old ? { ...old } : { label, url, approved: false }
    })
    if (!store.agents[store.currentAgent]) store.currentAgent = manifest.front_man
    mergeCustomPeers()
  } catch (e) {
    pushMsg({ kind: 'bot', who: 'runtime', text: '❌ 语言切换重载失败：' + (e as Error).message })
  }
}

/* ---------- 敏感操作确认（浏览器是权限守门员） ---------- */
let confirmResolve: ((v: boolean) => void) | null = null
export function requestConfirm(title: string, detail: string): Promise<boolean> {
  store.confirmTitle = title
  store.confirmDetail = detail
  store.confirmLoading = false
  store.showConfirm = true
  return new Promise(resolve => (confirmResolve = resolve))
}
/** 点击「确认执行」：弹窗不关闭，按钮进入 loading，等调用方执行完动作后调 finishConfirm */
export function resolveConfirm(v: boolean) {
  if (!v) {
    store.showConfirm = false
    confirmResolve?.(false)
    confirmResolve = null
    return
  }
  store.confirmLoading = true
  confirmResolve?.(true)
}
/** 确认后的动作执行完毕：关闭弹窗并 toast 结果（success=true 绿 / false 红） */
export function finishConfirm(success: boolean, msg: string) {
  store.confirmLoading = false
  store.showConfirm = false
  confirmResolve = null
  if (success) message.success(msg)
  else message.error(msg)
}

/* ---------- 站点动作实际执行（仅浏览器本地，无服务器） ---------- */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 执行已获用户确认的站点动作：结束后关闭确认弹窗并 toast，结果文本返回给 LLM */
async function executeSiteAction(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    const result = await doExecuteSiteAction(name, args)
    finishConfirm(true, result)
    return result
  } catch (e) {
    finishConfirm(false, `站点动作执行失败：${(e as Error).message}`)
    throw e
  }
}

async function doExecuteSiteAction(name: string, args: Record<string, unknown>): Promise<string> {
  if (name !== 'export_analysis') throw new Error(`未注册的站点动作：${name}`)
  const metric = String(args.metric || 'sleep')
  const format = String(args.format || 'md')
  const label = METRIC_LABELS[metric] || metric
  const stamp = new Date().toISOString().slice(0, 10)

  // PNG：导出当前已渲染的图表（不重新渲染、不重算数据）
  if (format === 'png') {
    const canvases = document.querySelectorAll('.chart-box canvas')
    const canvas = canvases[canvases.length - 1] as HTMLCanvasElement | undefined
    if (!canvas) return '未找到已生成的图表，无法导出 PNG；请先用可视化问题生成图表后再试。'
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `LifeLens_${label}_${stamp}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return `已将「${label}」图表的 PNG 保存到你的设备（本地生成，未上传）。`
  }

  // Markdown：分析结论 + 内嵌图表 + 逐日数据，全部来自站点已加载的 SITE_STATE
  const md = buildReport(metric)
  saveBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `LifeLens_${label}_${stamp}.md`)
  return `已将「${label}」的完整分析报告（分析结论 + 趋势图 + 逐日数据）保存到你的设备（本地生成，未上传）。`
}

/* ---------- 执行一个 agent 并渲染结果 ---------- */
async function execute(name: string, params: Record<string, unknown>, who: string) {
  store.loading = true
  const trace: TraceFn = html => pushMsg({ kind: 'trace', html })
  try {
    const peerAgents: Record<string, AgentDef> = {}
    store.peers.filter(p => p.approved && p.agents).forEach(p => Object.assign(peerAgents, p.agents))
    const run = await runAgent(store.agents, peerAgents, name, params, trace, 0, {
      confirm: requestConfirm,
      execute: executeSiteAction
    })
    const ans = run.content
    // 图表优先取委派链冒泡结果，最终文本兜底扫描
    const chart = run.chart ?? extractChart(ans)
    let text = ans.replace(/```[\s\S]*?```/g, '').trim()
    if (chart) {
      // 模型可能把图表 JSON 不带围栏地回显在正文里：删掉含 echartsOption 的 JSON 块；
      // 剩余若仍是纯 JSON 残渣（无中文/正常句子），整体不显示（图表卡片自带 summary）
      text = text.replace(/\{[\s\S]*?"echartsOption"[\s\S]*\}/g, '').trim()
      if (!text || !/[^\s{}[\]":,0-9a-zA-Z_'".-]/.test(text)) text = ''
    }
    pushMsg({ kind: 'bot', who, text: text || undefined, chart: chart || undefined })
  } catch (e) {
    pushMsg({ kind: 'bot', who: 'runtime', text: '❌ 出错：' + (e as Error).message + '（可在右上角检查 API 设置）' })
  }
  store.loading = false
}

export async function send(text: string) {
  if (!text.trim() || store.loading) return
  pushMsg({ kind: 'user', text })
  await execute(store.manifest?.front_man || '', { inquiry: text }, store.manifest?.front_man || '')
}

/** 侧栏点击非入口 agent → Schema 表单直调 */
export function selectAgent(name: string) {
  store.currentAgent = name
  if (name !== store.manifest?.front_man) store.formAgent = store.agents[name] || findPeerAgent(name)
}
function findPeerAgent(name: string): AgentDef | null {
  for (const p of store.peers) if (p.agents?.[name]) return p.agents[name]
  return null
}
export async function submitForm(params: Record<string, unknown>) {
  const agent = store.formAgent
  if (!agent) return
  store.formAgent = null
  pushMsg({ kind: 'user', who: '(Schema 表单直调) ' + agent.name, text: JSON.stringify(params, null, 2) })
  await execute(agent.name, params, agent.name)
}

/* ---------- 对等站点批准 + 加载 ---------- */
export async function approvePeer(label: string) {
  const peer = store.peers.find(p => p.label === label)
  if (!peer || peer.approved) return
  const ok = await requestConfirm(
    '跨域请求确认',
    `目标：${label}\n域名：${safeHost(peer.url)}\n请求内容：fetch ${peer.url}\n\n允许本次跨站加载吗？`
  )
  if (!ok) return
  try {
    const peerTrace: TraceFn = html => pushMsg({ kind: 'trace', html })
    peer.agents = await loadPeer(peer.url, peerTrace)
    peer.approved = true
    finishConfirm(true, `已批准跨站加载「${label}」`)
    pushMsg({ kind: 'trace', html: `已批准跨站加载 <b>${label}</b>，可用 agent：${Object.keys(peer.agents).join('、')}` })
  } catch (e) {
    // fail closed：加载失败保持未批准，能力不可用要明确上报（MVP 规范要求）
    peer.error = (e as Error).message
    finishConfirm(false, `「${label}」加载失败，已保持未批准：${peer.error}`)
    pushMsg({ kind: 'trace', html: `❌ <b>${label}</b> 加载失败，已保持未批准：${peer.error}（对方站点需部署到公网后重试）` })
  }
}
function safeHost(url: string): string {
  try { return new URL(url).host } catch { return url }
}

/* ---------- 自定义对等站点（用户在设置里添加，localStorage 持久化） ---------- */
const CUSTOM_PEERS_KEY = 'lifelens_custom_peers'
interface CustomPeer { label: string; url: string }
function loadCustomPeers(): CustomPeer[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PEERS_KEY) || '[]') } catch { return [] }
}
function saveCustomPeers(list: CustomPeer[]) {
  try { localStorage.setItem(CUSTOM_PEERS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
/** 把用户自定义的对等站点合并进当前列表（boot / 语言重载后调用） */
function mergeCustomPeers() {
  for (const cp of loadCustomPeers()) {
    if (!store.peers.some(p => p.label === cp.label && p.url === cp.url))
      store.peers.push({ label: cp.label, url: cp.url, approved: false })
  }
}
/** 添加对等站点；返回错误信息，成功返回 null */
export function addPeer(label: string, url: string): string | null {
  const name = label.trim()
  const target = url.trim()
  if (!name) return '站点名称不能为空'
  let parsed: URL
  try { parsed = new URL(target) } catch { return 'URL 格式不正确' }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '仅支持 http/https 地址'
  if (store.peers.some(p => p.url === target)) return '该站点已存在'
  const list = loadCustomPeers()
  list.push({ label: name, url: target })
  saveCustomPeers(list)
  store.peers.push({ label: name, url: target, approved: false })
  pushMsg({ kind: 'trace', html: `已添加对等站点 <b>${name}</b>（待批准），可在侧栏点击批准接入` })
  return null
}
/** 移除自定义对等站点（manifest 内置的不可移除——重载后仍会回来） */
export function removePeer(label: string) {
  if (!customPeerLabels().includes(label)) return
  saveCustomPeers(loadCustomPeers().filter(p => p.label !== label))
  const i = store.peers.findIndex(p => p.label === label)
  if (i >= 0) store.peers.splice(i, 1)
  // 若当前选中/表单直调的 agent 属于被删站点，回退到对话入口
  const stillAlive =
    store.agents[store.currentAgent] ||
    store.peers.some(p => p.agents?.[store.currentAgent])
  if (!stillAlive) store.currentAgent = store.manifest?.front_man || ''
  if (store.formAgent && !store.agents[store.formAgent.name] && !findPeerAgent(store.formAgent.name))
    store.formAgent = null
  message.success(`已移除对等站点「${label}」`)
  pushMsg({ kind: 'trace', html: `已移除对等站点 <b>${label}</b>` })
}
export function customPeerLabels(): string[] {
  return loadCustomPeers().map(p => p.label)
}

/* ---------- 设置 ---------- */
export function openSettings() { store.showSettings = true }
export function applySettings(cfg: { base: string; key: string; model: string }) {
  store.cfg = { ...cfg }
  saveCfg(store.cfg)
  store.showSettings = false
  pushMsg({ kind: 'trace', html: '配置已保存到 localStorage（Key 不进代码、不进产物 ✅）' })
}
/** 清除已存的 BYOK 配置（规范 MUST：user must be able to delete stored profiles） */
export function clearCfg() {
  try { localStorage.removeItem('oawc_cfg') } catch { /* ignore */ }
  store.cfg = { base: '', key: '', model: '' }
  pushMsg({ kind: 'trace', html: '已清除本地 LLM 配置（回到 Mock 模式；Key 已从本机删除）' })
}
