import type { LlmConfig } from './types'

const KEY = 'oawc_cfg'

/** .env 注入的开发默认值（构建时 Vite 内联） */
const envDefaults = {
  base: import.meta.env.VITE_LLM_BASE_URL || '',
  key: import.meta.env.VITE_LLM_API_KEY || '',
  model: import.meta.env.VITE_LLM_MODEL || ''
}

/**
 * 开发模式下，跨域的 LLM base URL 改走 Vite 同源代理（/llm-gateway），
 * 绕过网关不开 CORS 导致的浏览器 "Failed to fetch"。
 * 生产构建（DEV=false）不受影响，线上用户直连自己填的 API。
 */
function withDevProxy(base: string): string {
  if (!import.meta.env.DEV || !base.startsWith('http')) return base
  try {
    const u = new URL(base)
    if (u.origin === window.location.origin) return base
    // 只返回代理前缀：rewrite 时由 vite.config 把 /llm-gateway 替换为网关完整路径
    return '/llm-gateway'
  } catch {
    return base
  }
}

/**
 * 配置优先级：用户在界面填的（localStorage）> .env 开发默认值。
 * 生产构建时 .env.production 强制 Key 为空（产物不含凭证），
 * 线上用户只能走 BYOK 自己填。
 */
export function loadCfg(): LlmConfig {
  let saved: Partial<LlmConfig> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch { /* ignore */ }
  return {
    base: withDevProxy(saved.base || envDefaults.base),
    key: saved.key || envDefaults.key,
    model: saved.model || envDefaults.model
  }
}

export function saveCfg(cfg: LlmConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

/** 是否为 Mock 模式（未配置 Key） */
export function isMock(cfg: LlmConfig): boolean {
  return !cfg.key
}
