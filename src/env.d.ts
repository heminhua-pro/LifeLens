/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LLM_BASE_URL?: string
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_LLM_MODEL?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/** 健康数据模块：构建时由 vite.config 解析为本地真实数据或合成样例 */
declare module '@health-data' {
  type Pt = { date: string; hours?: number; steps?: number; kcal?: number; mps?: number; db?: number }
  const data: Record<string, Pt[]>
  export default data
}
