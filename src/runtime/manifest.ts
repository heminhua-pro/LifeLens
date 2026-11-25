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

export async function loadManifest(): Promise<Manifest> {
  const res = await fetch(`${wellKnownBase()}agent-manifest.json`)
  if (!res.ok) throw new Error(`agent-manifest.json 加载失败 (${res.status})`)
  return res.json()
}

export async function loadNetwork(manifest: Manifest): Promise<Network> {
  const res = await fetch(manifest.hocon)
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
