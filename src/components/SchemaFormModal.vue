<script setup lang="ts">
import { reactive, watch } from 'vue'
import { store, submitForm } from '../store'
import { t } from '../theme'
import type { ParamSchema } from '../runtime/types'

const form = reactive<Record<string, string>>({})

watch(
  () => store.formAgent,
  agent => {
    Object.keys(form).forEach(k => delete form[k])
    if (!agent) return
    const props = agent.function.parameters.properties || {}
    for (const k of Object.keys(props)) form[k] = ''
  }
)

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
        <span class="type">({{ p.type }})</span>
      </div>
      <a-input v-model:value="form[k]" :placeholder="p.description || ''" />
    </template>
  </a-modal>
</template>

<style scoped>
.field-label { font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
.req { color: #d97706; }
.type { opacity: .6; margin-left: 4px; }
</style>
