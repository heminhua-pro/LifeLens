import { reactive } from 'vue'
import type { AgentDef, ChartResult, Manifest, Network, PeerInfo } from './runtime/types'
import { loadManifest, loadNetwork, loadPeer } from './runtime/manifest'
import { loadCfg, saveCfg } from './runtime/config'
import { runAgent, extractChart, type TraceFn } from './runtime/orchestrator'

export interface Msg {
  id: number
  kind: 'user' | 'bot' | 'trace'
  who?: string
  text?: string
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
  cfg: loadCfg()
})

let nextId = 1
const pushMsg = (m: Omit<Msg, 'id'>) => { store.messages.push({ id: nextId++, ...m }) }

/* ---------- 启动：加载 manifest / network ---------- */
export async function boot() {
  try {
    store.manifest = await loadManifest()
    const network = await loadNetwork(store.manifest)
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
    const manifest = await loadManifest()
    const network = await loadNetwork(manifest)
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
  store.showConfirm = true
  return new Promise(resolve => (confirmResolve = resolve))
}
export function resolveConfirm(v: boolean) {
  store.showConfirm = false
  confirmResolve?.(v)
  confirmResolve = null
}

/* ---------- 执行一个 agent 并渲染结果 ---------- */
async function execute(name: string, params: Record<string, unknown>, who: string) {
  store.loading = true
  const trace: TraceFn = html => pushMsg({ kind: 'trace', html })
  try {
    const peerAgents: Record<string, AgentDef> = {}
    store.peers.filter(p => p.approved && p.agents).forEach(p => Object.assign(peerAgents, p.agents))
    const run = await runAgent(store.agents, peerAgents, name, params, trace)
    const ans = run.content
    // 图表优先取委派链冒泡结果，最终文本兜底扫描
    const chart = run.chart ?? extractChart(ans)
    const text = chart
      ? ans.replace(/```[\s\S]*?```/g, '').trim()
      : ans
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
    peer.agents = await loadPeer(peer.url)
    peer.approved = true
    pushMsg({ kind: 'trace', html: `已批准跨站加载 <b>${label}</b>，可用 agent：${Object.keys(peer.agents).join('、')}` })
  } catch (e) {
    // 开发环境 peer 是示例域名，允许批准但不解析
    peer.approved = true
    peer.error = (e as Error).message
    pushMsg({ kind: 'trace', html: `已批准 <b>${label}</b>，但对方站点暂不可达：${peer.error}（正式部署后可加载）` })
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
/** 移除自定义对等站点（manifest 内置的不可移除） */
export function removePeer(label: string) {
  saveCustomPeers(loadCustomPeers().filter(p => p.label !== label))
  const i = store.peers.findIndex(p => p.label === label)
  if (i >= 0) store.peers.splice(i, 1)
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
