<script setup lang="ts">
import { reactive, watch } from 'vue'
import { store, applySettings } from '../store'
import { t } from '../theme'

const form = reactive({ base: '', key: '', model: '' })

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
</script>

<template>
  <a-modal
    :open="store.showSettings"
    :title="t('settingsTitle')"
    @cancel="store.showSettings = false"
    @ok="applySettings(form)"
    :ok-text="t('btnSave')"
    :cancel-text="t('btnCancel')"
  >
    <div class="field-label">{{ t('fieldBase') }}</div>
    <a-input v-model:value="form.base" placeholder="https://api.deepseek.com" />
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
</style>
