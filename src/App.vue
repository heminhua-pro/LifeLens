<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { theme as antdThemeApi } from 'ant-design-vue'
import { store, boot, reloadForLang, resolveConfirm } from './store'
import { ui, toggleMode, toggleLang, t } from './theme'
import AgentSidebar from './components/AgentSidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import SchemaFormModal from './components/SchemaFormModal.vue'
import SettingsModal from './components/SettingsModal.vue'

onMounted(boot)
// 切换语言后按新语言目录重载 manifest / network（侧栏描述跟随语言）
watch(() => ui.lang, () => { void reloadForLang() })

// antd 主题：暗色用 darkAlgorithm，主色统一紫罗兰；暗色下文字/边框提亮，基础字号 14px
const antdTheme = computed(() => ({
  algorithm: ui.mode === 'dark' ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
  token: {
    colorPrimary: '#7c6cff',
    colorLink: '#7c6cff',
    borderRadius: 10,
    fontSize: 14,
    ...(ui.mode === 'dark'
      ? {
          colorText: '#ffffff',
          colorTextSecondary: '#e5e7eb',
          colorTextTertiary: '#a8b3c4',
          colorBgContainer: '#1a1d29',
          colorBgElevated: '#1f2230',
          colorBorder: '#5c658a',
          colorBorderSecondary: '#47506e'
        }
      : {})
  }
}))
</script>

<template>
  <a-config-provider :theme="antdTheme">
    <a-layout class="root">
      <a-layout-header class="header">
        <div class="logo">透</div>
        <span class="title">{{ t('title') }}</span>
        <div class="spacer"></div>
        <a-button class="icon-btn"  @click="toggleLang" :title="ui.lang === 'zh' ? 'Switch to English' : '切换为中文'">
          {{ ui.lang === 'zh' ? 'EN' : '中文' }}
        </a-button>
        <a-button class="icon-btn" @click="toggleMode" :title="ui.mode === 'dark' ? '切换亮色' : 'Switch to dark'">
          {{ ui.mode === 'dark' ? '☀️' : '🌙' }}
        </a-button>
        <a-button @click="store.showSettings = true">{{ t('settingsTitle') }}</a-button>
      </a-layout-header>

      <a-layout>
        <a-layout-sider width="248" class="sider">
          <AgentSidebar />
        </a-layout-sider>
        <a-layout-content class="content">
          <ChatPanel />
        </a-layout-content>
      </a-layout>
    </a-layout>

    <SchemaFormModal />
    <SettingsModal />

    <!-- 敏感操作 / 跨域请求确认（浏览器是权限守门员） -->
    <a-modal
      :open="store.showConfirm"
      :title="'⚠️ ' + store.confirmTitle"
      :closable="false"
      @cancel="resolveConfirm(false)"
    >
      <div class="confirm-detail">{{ store.confirmDetail }}</div>
      <template #footer>
        <a-button @click="resolveConfirm(false)">{{ t('reject') }}</a-button>
        <a-button danger type="primary" @click="resolveConfirm(true)">{{ t('confirm') }}</a-button>
      </template>
    </a-modal>
  </a-config-provider>
</template>

<style scoped>
.root { height: 100vh; background: var(--bg); position: relative; overflow: hidden; }
/* 极光光斑：两主题共用，浓度由变量控制 */
.root::before,
.root::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.root::before {
  width: 520px; height: 520px; top: -200px; right: -120px;
  background: radial-gradient(circle, var(--glow-1) 0%, transparent 70%);
}
.root::after {
  width: 480px; height: 480px; bottom: -220px; left: -100px;
  background: radial-gradient(circle, var(--glow-2) 0%, transparent 70%);
}
.header {
  background: var(--panel); border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 52px; line-height: 52px;
  position: relative; z-index: 2;
}
.logo {
  width: 28px; height: 28px; border-radius: 8px; background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;
}
.title { font-size: 15px; font-weight: 600; color: var(--text); }
.manifest-tag { margin-inline-end: 0; }
.spacer { flex: 1; }
.icon-btn { border-radius: 16px; }
.sider {
  background: transparent !important;
  border-right: 1px solid var(--border);
  padding: 0; position: relative; z-index: 2;
}
.content { background: transparent; display: flex; flex-direction: column; position: relative; z-index: 2; }
.confirm-detail { font-size: 13px; line-height: 1.7; white-space: pre-wrap; color: var(--text); }
</style>
