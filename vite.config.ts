import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 数据隔离：本机若存在真实健康数据（gitignored）则使用之，
  // 否则回落到仓库自带的合成样例——保证任何人 clone 后可直接构建运行。
  const realData = resolve(import.meta.dirname, 'src/data/healthData.local.json')
  const sampleData = resolve(import.meta.dirname, 'src/data/healthData.sample.json')
  const healthDataAlias = existsSync(realData) ? realData : sampleData

  // 开发代理：内网/跨域 LLM 网关往往不开 CORS，浏览器直连会 "Failed to fetch"。
  // 统一走同源前缀 /llm-gateway 转发，绕过 CORS（仅开发环境生效，不影响生产 BYOK）。
  let proxy: Record<string, ProxyOptions> = {}
  const llmBase = env.VITE_LLM_BASE_URL || ''
  if (llmBase.startsWith('http')) {
    try {
      const u = new URL(llmBase)
      proxy = {
        '/llm-gateway': {
          target: u.origin,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/llm-gateway/, u.pathname.replace(/\/$/, ''))
        }
      }
    } catch { /* 非法 URL 则不配代理 */ }
  }

  return {
    // GitHub Pages 项目页路径：站点挂在 https://heminhua-pro.github.io/LifeLens/
    base: '/LifeLens/',
    plugins: [
      vue(),
      // antd 按需引入：模板里的 <a-xxx> 组件自动注册并按需打包
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: false })]
      })
    ],
    resolve: {
      alias: { '@health-data': healthDataAlias }
    },
    server: { port: 5173, proxy },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
      output: {
        // Vite 8 (Rolldown) 要求 manualChunks 为函数形式
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
          if (id.includes('ant-design')) return 'antd'
          if (id.includes('vue') || id.includes('@vue')) return 'vue'
          return undefined
        }
      }
      }
    }
  }
})
