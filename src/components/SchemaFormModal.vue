<script setup lang="ts">
import { reactive, watch } from 'vue'
import { store, submitForm } from '../store'
import { t } from '../theme'
import type { ParamSchema } from '../runtime/types'

const form = reactive<Record<string, string | undefined>>({})

watch(
  () => store.formAgent,
  agent => {
    Object.keys(form).forEach(k => delete form[k])
    if (!agent) return
    const props = agent.function.parameters.properties || {}
    for (const k of Object.keys(props)) form[k] = props[k].enum ? undefined : ''
  }
)

/* 枚举参数生成下拉选项：enumLabels 提供中文标签（如 睡眠（sleep）），缺省用键名 */
function enumOpts(p: { enum?: string[]; enumLabels?: Record<string, string> }) {
  return (p.enum || []).map(v => ({ value: v, label: p.enumLabels?.[v] ? `${p.enumLabels[v]}（${v}）` : v }))
}


function ok() {
  const agent = store.formAgent
  if (!agent) return
  const schema: ParamSchema = agent.function.parameters
  const params: Record<string, unknown> = {}
  for (const k of Object.keys(schema.properties || {})) {
    let v: unknown = form[k]
    if (schema.properties?.[k].type === 'integer') v = parseInt(form[k] || '0', 10)
    params[k] = v
  }
  submitForm(params)
}
</script>

<template>
  <a-modal
    :open="!!store.formAgent"
    :title="t('formCall') + (store.formAgent?.name || '')"
    @cancel="store.formAgent = null"
    @ok="ok"
    :ok-text="t('execute')"
    :cancel-text="t('btnCancel')"
  >
    <template v-for="(p, k) in store.formAgent?.function.parameters.properties || {}" :key="k">
      <div class="field-label">
        {{ k }}
        <span class="req">*</span>
        <span class="type">({{ p.enum ? 'enum' : p.type }})</span>
      </div>
      <a-select
        v-if="p.enum"
        v-model:value="form[k]"
        :options="enumOpts(p)"
        :placeholder="p.description || '请选择'"
        style="width:100%"
      />
      <a-textarea
        v-else-if="(p.description || '').length > 50"
        v-model:value="form[k]"
        :rows="2"
        :placeholder="p.description"
      />
      <a-input v-else v-model:value="form[k]" :placeholder="p.description || ''" />
    </template>
  </a-modal>
</template>

<style scoped>
.field-label { font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
.req { color: #d97706; }
.type { opacity: .6; margin-left: 4px; }
.tip { font-size: 11px; color: var(--muted); margin-top: 4px; line-height: 1.5; opacity: .85; }
</style>
