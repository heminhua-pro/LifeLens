import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 数据隔离：本机若存在真实健康数据（gitignored）则使用之，
  // 否则回落到仓库自带的合成样例——保证任何人 clone 后可直接构建运行。
  const realData = resolve(__dirname, 'src/data/healthData.local.json')
  const sampleData = resolve(__dirname, 'src/data/healthData.sample.json')
  const healthDataAlias = existsSync(realData) ? realData : sampleData

  // 开发代理：内网/跨域 LLM 网关往往不开 CORS，浏览器直连会 "Failed to fetch"。
  // 统一走同源前缀 /llm-gateway 转发，绕过 CORS（仅开发环境生效，不影响生产 BYOK）。
  let proxy: Record<string, unknown> = {}
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
          manualChunks: {
            vue: ['vue'],
            echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
            antd: ['ant-design-vue']
          }
        }
      }
    }
  }
})
