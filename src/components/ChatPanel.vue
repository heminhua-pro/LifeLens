<script setup lang="ts">
import { ref } from 'vue'
import { store, send } from '../store'
import { t } from '../theme'
import ChartCard from './ChartCard.vue'

const input = ref('')

function onSend(e?: Event) {
  // Shift+Enter 换行，Enter 发送；点击按钮时 e 是 MouseEvent（无 shiftKey，直接发送）
  if (e && 'shiftKey' in e && (e as KeyboardEvent).shiftKey) return
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  send(text)
}
function sug(text: string) {
  send(text)
}
function suggestions() {
  return [t('sug1'), t('sug2'), t('sug3'), t('sug4')]
}
/* 跟进推荐问题：只挂在最新一条 bot 回复下方 */
const lastBotId = () => store.messages.filter(m => m.kind === 'bot').at(-1)?.id
function followUps() {
  return [t('follow1'), t('follow2'), t('follow3'), t('follow4')]
}
</script>

<template>
  <div class="chat">
    <template v-if="!store.messages.length">
      <div class="empty">
        <div class="hero"><span class="hero-icon">🔭</span></div>
        <div class="headline">{{ t('emptyTitle') }}</div>
        <div class="sub">{{ t('emptyLine1') }}</div>
        <div class="sub">{{ t('emptyLine2') }}</div>
        <div class="sugs">
          <button v-for="s in suggestions()" :key="s" class="sug-chip" @click="sug(s)">{{ s }}</button>
        </div>
      </div>
    </template>

    <template v-for="m in store.messages" :key="m.id">
      <div v-if="m.kind === 'trace'" class="trace" v-html="'⚙ ' + m.html"></div>
      <div v-else-if="m.kind === 'user'" class="msg user">
        <div v-if="m.who" class="who">{{ m.who }}</div>
        {{ m.text }}
      </div>
      <div v-else class="msg bot">
        <div v-if="m.who" class="who">{{ m.who }}</div>
        <div v-if="m.text" class="bot-text">{{ m.text }}</div>
        <ChartCard v-if="m.chart" :chart="m.chart" />
        <div v-if="m.id === lastBotId() && !store.loading" class="followups">
          <button v-for="s in followUps()" :key="s" class="follow-chip" @click="sug(s)">{{ s }}</button>
        </div>
      </div>
    </template>

    <div v-if="store.loading" class="trace loading-trace">
      <span class="spinner"></span>{{ t('loading') }}
    </div>
  </div>

  <div class="inputbar">
    <div class="input-shell">
      <a-textarea
        v-model:value="input"
        :placeholder="t('placeholder')"
        :auto-size="{ minRows: 1, maxRows: 6 }"
        @press-enter="onSend($event)"
        :disabled="store.loading"
        :bordered="false"
        class="chat-input"
      />
      <div class="input-foot">
        <a-button type="primary" shape="circle" class="send-btn" :loading="store.loading" @click="onSend">
          <svg v-if="!store.loading" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path d="M8 13.5V3M3.2 7.8 8 3l4.8 4.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a-button>
      </div>
    </div>
    <div class="disclaimer">{{ t('disclaimer') }}</div>
  </div>
</template>

<style scoped>
.chat { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; scrollbar-width: none; }
.chat::-webkit-scrollbar { display: none; }
.msg { max-width: 72%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; transition: background .25s ease; }
.msg.user { align-self: flex-end; background: var(--user-bubble); color: var(--user-text); border-bottom-right-radius: 4px; }
.msg.bot { align-self: flex-start; background: var(--bot-bubble); border: 1px solid var(--border); border-bottom-left-radius: 4px; color: var(--text); }
.msg .who { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.msg.user .who { color: rgba(255,255,255,.85); }
.followups { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.follow-chip {
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: transparent; border: 1px solid var(--border-strong);
  font-size: 12px; color: var(--accent-text); line-height: 1.4;
  transition: border-color .15s ease, background .15s ease, transform .15s ease;
}
.follow-chip:hover { border-color: var(--accent); background: var(--accent-soft); transform: translateY(-1px); }
.trace { align-self: flex-start; font-size: 12px; color: var(--muted); background: var(--card); border: 1px dashed var(--border); border-radius: 8px; padding: 5px 10px; max-width: 80%; }
.loading-trace { display: inline-flex; align-items: center; gap: 8px; }
.spinner {
  width: 12px; height: 12px; flex: none;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty { margin: auto; text-align: center; padding: 24px; }
.hero {
  width: 68px; height: 68px; margin: 0 auto;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-soft); border-radius: 20px;
}
.hero-icon { font-size: 32px; line-height: 1; }
.headline { font-size: 18px; font-weight: 600; color: var(--text); margin-top: 18px; }
.sub { font-size: 13px; color: var(--muted); line-height: 1.9; margin-top: 2px; }
.sugs {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
  max-width: 560px; margin: 26px auto 0;
}
.sug-chip {
  padding: 8px 16px; border-radius: 999px; cursor: pointer;
  background: var(--card); border: 1px solid var(--border);
  font-size: 14px; color: var(--text); line-height: 1.4;
  transition: border-color .15s ease, background .15s ease, color .15s ease, transform .15s ease;
}
.sug-chip:hover {
  border-color: var(--accent); background: var(--accent-soft);
  color: var(--accent-text); transform: translateY(-1px);
}
.inputbar { padding: 12px 24px 16px; display: flex; flex-direction: column; align-items: center; }
.input-shell {
  width: 100%; max-width: 720px;
  display: flex; flex-direction: column;
  padding: 14px 16px 10px;
  background: var(--card); border: 1px solid var(--border-strong); border-radius: 24px;
  box-shadow: var(--shadow);
  transition: border-color .15s ease, background .25s ease;
}
.input-shell:focus-within { border-color: var(--accent); }
.chat-input { width: 100%; }
.chat-input :deep(.ant-input) {
  background: transparent; border: none; box-shadow: none;
  padding: 2px 0; font-size: 14px; color: var(--text);
  resize: none; line-height: 1.6;
}
.chat-input :deep(.ant-input)::placeholder { color: var(--muted); }
.chat-input :deep(.ant-input:disabled) { color: var(--muted); background: transparent; }
.input-foot { display: flex; justify-content: flex-end; margin-top: 8px; }
.send-btn { width: 34px; height: 34px; flex: none; font-size: 16px; }
.disclaimer { font-size: 12px; color: var(--muted); margin-top: 8px; }
</style>
