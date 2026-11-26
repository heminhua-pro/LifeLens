<script setup lang="ts">
import { reactive, watch } from 'vue'
import { store, applySettings, clearCfg } from '../store'
import { t } from '../theme'

const form = reactive({ base: '', key: '', model: '' })
/* URL 常量放 script：vue-tsc 3.3.14 的模板 codegen 对含 // 的字符串有转义 bug（vuejs/language-tools#6322） */
const apiHint = 'https://api.deepseek.com'

watch(
  () => store.showSettings,
  open => {
    if (open) {
      form.base = store.cfg.base || 'https://api.deepseek.com'
      form.key = store.cfg.key || ''
      form.model = store.cfg.model || 'deepseek-chat'
    }
  }
)
/** 清除已存配置：删 localStorage 里的 BYOK 配置，关弹窗回到 Mock 模式 */
function onClear() {
  clearCfg()
  form.base = ''; form.key = ''; form.model = ''
  store.showSettings = false
}
</script>

<template>
  <a-modal
    :open="store.showSettings"
    @cancel="store.showSettings = false"
    @ok="applySettings(form)"
    :ok-text="t('btnSave')"
    :cancel-text="t('btnCancel')"
  >
    <template #title>
      <span class="title-row">
        {{ t('settingsTitle') }}
        <a-popconfirm :title="t('clearCfgTip')" @confirm="onClear">
          <a-button danger size="small">{{ t('btnClearCfg') }}</a-button>
        </a-popconfirm>
      </span>
    </template>
    <div class="field-label">{{ t('fieldBase') }}</div>
    <a-input v-model:value="form.base" :placeholder="apiHint" />
    <div class="field-label">{{ t('fieldKey') }}</div>
    <a-input-password v-model:value="form.key" placeholder="sk-..." />
    <div class="field-label">{{ t('fieldModel') }}</div>
    <a-input v-model:value="form.model" placeholder="deepseek-chat / gpt-4o-mini / ..." />
    <div class="tip">{{ t('settingsTip') }}</div>
  </a-modal>
</template>

<style scoped>
.field-label { font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
.tip { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.6; }
.title-row { display: flex; align-items: center; gap: 10px; }
</style>
