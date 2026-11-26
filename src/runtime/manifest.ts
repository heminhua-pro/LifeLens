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
/**
 * network 校验：tools 非空、agent 名称不重复、front_man 存在、下游 agent 引用存在。
 * 校验失败直接抛错，阻止带病清单进入运行时（静默覆盖会掩盖发布错误）。
 * 注意：跨站 peer agent 不写在 network.json 的 tools 字段里，而是运行时从已批准 peer 动态注入，
 * 因此这里的引用校验只针对本 network 声明的下游，不会误伤合法的跨站委派。
 */
export function validateNetwork(network: Network, frontMan?: string): void {
  if (!network.tools?.length) throw new Error('network.tools 为空')
  if (network.tools.some(t => !t.name)) throw new Error('network.tools 存在缺少 name 的 agent')
  const names = network.tools.map(t => t.name)
  const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
  if (dupes.length) throw new Error(`network.tools 存在重复的 agent 名称：${dupes.join('、')}`)
  if (frontMan !== undefined && !names.includes(frontMan))
    throw new Error(`front_man「${frontMan}」未在 network.tools 中定义`)
  // 校验每个 agent 声明的下游 tools 引用：必须在本 network 中定义（本地悬空引用 = 清单写错）
  const nameSet = new Set(names)
  for (const tool of network.tools) {
    for (const ref of tool.tools || []) {
      if (!nameSet.has(ref))
        throw new Error(`agent「${tool.name}」的 tools 引用了未定义的下游 agent「${ref}」`)
    }
  }
}

export async function loadNetwork(manifest: Manifest, manifestUrl?: string): Promise<Network> {
  const base = manifestUrl ?? new URL(`${wellKnownBase()}agent-manifest.json`, location.href).href
  const res = await fetch(new URL(manifest.hocon, base).href)
  if (!res.ok) throw new Error(`network 定义加载失败 (${res.status})`)
  const network: Network = await res.json()
  validateNetwork(network, manifest.front_man)
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
  validateNetwork(peerNetwork, peerManifest.front_man)
  const agents: Record<string, AgentDef> = {}
  peerNetwork.tools.forEach(t => (agents[t.name] = t))
  return agents
}
