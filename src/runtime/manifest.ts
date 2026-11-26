import type { Manifest, Network, AgentDef } from './types'
import { ui } from '../theme'

/**
 * 发布层加载：fetch 静态 JSON（部署时开 CORS，这里同源）
 * 约定路径：/.well-known/agent-manifest.json（canonical，第三方按此发现本站），
 * manifest 的 hocon 字段指向本站 network 定义。
 */
function wellKnownBase(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}.well-known/`
}

export async function loadManifest(): Promise<{ manifest: Manifest; url: string }> {
  // 锚定到页面实际 URL 解析（GitHub Pages 等子路径部署时 BASE_URL 带 /LifeLens/ 前缀）
  const url = new URL(`${wellKnownBase()}agent-manifest.json`, location.href).href
  const res = await fetch(url)
  if (!res.ok) throw new Error(`agent-manifest.json 加载失败 (${res.status})`)
  return { manifest: await res.json(), url }
}

/**
 * hocon 按 MVP 规范锚定到 manifest 所在目录（site base）解析：
 * 相对文件名（如 lifelens.network.json）与绝对 URL 都支持。
 * 不允许直接用页面路径解析——子路径部署（/LifeLens/）下会 404。
 */
export async function loadNetwork(manifest: Manifest, manifestUrl?: string): Promise<Network> {
  const base = manifestUrl ?? new URL(`${wellKnownBase()}agent-manifest.json`, location.href).href
  const res = await fetch(new URL(manifest.hocon, base).href)
  if (!res.ok) throw new Error(`network 定义加载失败 (${res.status})`)
  const network: Network = await res.json()
  if (!network.tools?.length) throw new Error('network.tools 为空')
  return network
}

/** 对等站点：批准后 fetch 对方 manifest + network，解析出对方 agents */
export async function loadPeer(peerUrl: string): Promise<Record<string, AgentDef>> {
  const res = await fetch(peerUrl)
  if (!res.ok) throw new Error(`peer manifest 加载失败 (${res.status})`)
  const peerManifest: Manifest = await res.json()
  // hocon 可能是相对路径，必须锚定到对方站点 origin（相对当前页面会错误解析成本站路径）
  const netRes = await fetch(new URL(peerManifest.hocon, peerUrl).href)
  if (!netRes.ok) throw new Error(`peer network 加载失败 (${netRes.status})`)
  const peerNetwork: Network = await netRes.json()
  const agents: Record<string, AgentDef> = {}
  peerNetwork.tools.forEach(t => (agents[t.name] = t))
  return agents
}
