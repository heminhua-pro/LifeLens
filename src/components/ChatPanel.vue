<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons-vue'
import { store, send, type Msg } from '../store'
import { t } from '../theme'
import ChartCard from './ChartCard.vue'
import { renderMd } from '../runtime/md'

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
/* trace 按类型分色分 icon，避免所有条目长一个样 */
type TraceKind = 'router' | 'net' | 'delegate' | 'ok' | 'act' | 'err' | 'info'
const TRACE_ICON: Record<TraceKind, string> = {
  router: '⚙', net: '↗', delegate: '⇢', ok: '✓', act: '⚠', err: '✕', info: '·'
}
/** 网络请求/委派两类不显示 icon（箭头信息量低），其余保留 */
function traceIcon(kind: TraceKind): string {
  return kind === 'net' || kind === 'delegate' ? '' : TRACE_ICON[kind]
}
function traceKind(html: string): TraceKind {
  if (/站点动作|用户取消|用户已确认|写操作/.test(html)) return 'act'
  if (/❌|失败/.test(html)) return 'err'
  if (/router:/.test(html)) return 'router'
  if (/↗|POST|GET/.test(html)) return 'net'
  if (/委派/.test(html)) return 'delegate'
  if (/✓|返回（/.test(html)) return 'ok'
  return 'info'
}
/** 去掉原文里自带的 emoji 前缀，交给统一 icon 显示，避免重复 */
function stripLeadIcon(html: string): string {
  return html.replace(/^[\s⚙↗✓❌✕⚠·⇢]+/, '')
}

/* 把连续 trace 聚合成一张可折叠卡片；每个 bot 回复前的 trace 归为一组 */
type RenderItem =
  | { type: 'single'; msg: Msg }
  | { type: 'traceGroup'; id: string; traces: Msg[] }
const renderItems = computed<RenderItem[]>(() => {
  const out: RenderItem[] = []
  let buf: Msg[] = []
  const flush = () => {
    if (!buf.length) return
    out.push({ type: 'traceGroup', id: String(buf[0].id), traces: buf })
    buf = []
  }
  for (const m of store.messages) {
    if (m.kind === 'trace') buf.push(m)
    else { flush(); out.push({ type: 'single', msg: m }) }
  }
  flush()
  return out
})
/* 展开状态：执行中自动展开，执行完毕自动折叠（头部保留「✓ 执行完毕 · 耗时」）；手动切换后以手动为准 */
const traceOpen = reactive<Record<string, boolean>>({})
/** 该组是否是正在执行的活动组（列表末尾且 store.loading） */
function isGroupActive(g: Extract<RenderItem, { type: 'traceGroup' }>): boolean {
  const last = renderItems.value.at(-1)
  return store.loading && last?.type === 'traceGroup' && last?.id === g.id
}
function isTraceOpen(g: Extract<RenderItem, { type: 'traceGroup' }>): boolean {
  if (g.id in traceOpen) return traceOpen[g.id]
  return isGroupActive(g)
}
function toggleTrace(g: Extract<RenderItem, { type: 'traceGroup' }>) {
  traceOpen[g.id] = !isTraceOpen(g)
}
/** 卡片摘要：取最后一条 trace 的纯文本，截短显示 */
function traceSummary(traces: Msg[]): string {
  const last = traces[traces.length - 1]?.html || ''
  const plain = stripLeadIcon(last).replace(/<[^>]+>/g, '').trim()
  return plain.length > 46 ? plain.slice(0, 46) + '…' : plain
}
/** 执行耗时：组内首末 trace 时间差（跑完后显示「执行完毕 · X」） */
function traceDuration(traces: Msg[]): string | null {
  if (traces.length < 2) return null
  const ms = Math.max(0, traces[traces.length - 1].ts - traces[0].ts)
  return ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms'
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

    <template v-for="item in renderItems" :key="item.type === 'traceGroup' ? 'g' + item.id : 'm' + item.msg.id">
      <!-- 连续 trace 聚合为一张可折叠卡片 -->
      <div v-if="item.type === 'traceGroup'" class="trace-card" :class="{ 'is-open': isTraceOpen(item) }">
        <button class="trace-card-head" @click="toggleTrace(item)">
          <component :is="isTraceOpen(item) ? CaretDownOutlined : CaretUpOutlined" class="trace-card-chevron" />
          <span class="trace-card-title">执行轨迹</span>
          <span class="trace-card-count">{{ item.traces.length }} 步</span>
          <span v-if="!isGroupActive(item) && traceDuration(item.traces)" class="trace-card-done">
            ✓ 执行完毕 · {{ traceDuration(item.traces) }}
          </span>
        </button>
        <div v-show="isTraceOpen(item)" class="trace-card-body">
          <div v-for="tr in item.traces" :key="tr.id" class="trace" :class="'trace-' + traceKind(tr.html || '')">
            <span v-if="traceIcon(traceKind(tr.html || ''))" class="trace-icon">{{ traceIcon(traceKind(tr.html || '')) }}</span>
            <span class="trace-body" v-html="stripLeadIcon(tr.html || '')"></span>
          </div>
        </div>
      </div>
      <!-- 普通 user / bot 消息 -->
      <div v-else-if="item.msg.kind === 'user'" class="msg user">
        <div v-if="item.msg.who" class="who">{{ item.msg.who }}</div>
        {{ item.msg.text }}
      </div>
      <div v-else class="msg bot">
        <div v-if="item.msg.who" class="who">{{ item.msg.who }}</div>
        <div v-if="item.msg.text" class="bot-text md-body" v-html="renderMd(item.msg.text)"></div>
        <ChartCard v-if="item.msg.chart" :chart="item.msg.chart" :md-text="item.msg.text" />
        <div v-if="item.msg.id === lastBotId() && !store.loading" class="followups">
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
.msg { max-width: 72%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; transition: background .25s ease; }
.msg.bot .md-body { white-space: normal; }
/* markdown 基础排版（LLM 回复） */
.md-body :deep(p) { margin: 0 0 8px; }
.md-body :deep(p:last-child) { margin-bottom: 0; }
.md-body :deep(ul), .md-body :deep(ol) { margin: 4px 0 8px; padding-left: 20px; }
.md-body :deep(li) { margin: 2px 0; }
.md-body :deep(strong) { font-weight: 600; }
.md-body :deep(code) { background: rgba(124,108,255,.1); border-radius: 4px; padding: 1px 5px; font-size: 13px; }
.md-body :deep(pre) { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; overflow-x: auto; margin: 8px 0; }
.md-body :deep(pre code) { background: none; padding: 0; }
.md-body :deep(a) { color: var(--accent-text); }
.md-body :deep(h1), .md-body :deep(h2), .md-body :deep(h3) { font-size: 15px; margin: 10px 0 6px; }
.md-body :deep(table) { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.md-body :deep(th), .md-body :deep(td) { border: 1px solid var(--border-strong); padding: 4px 8px; }
.msg.user { align-self: flex-end; background: var(--user-bubble); color: var(--user-text); border-bottom-right-radius: 4px; }
.msg.bot { align-self: flex-start; background: var(--bot-bubble-grad); border: 1px solid var(--border); border-bottom-left-radius: 4px; color: var(--text); }
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
/* 可折叠的执行轨迹卡片 */
.trace-card {
  align-self: flex-start; max-width: 86%; width: fit-content;
  flex-shrink: 0; /* 关键：.chat 是定高滚动容器，overflow:hidden 会使 flex 最小高度归零，卡片被压成一条线 */
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--card); overflow: hidden; transition: border-color .15s ease;
}
.trace-card:hover { border-color: var(--border-strong); }
.trace-card-head {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 6px 10px; background: transparent; border: 0; cursor: pointer;
  font-size: 12px; color: var(--muted); text-align: left;
}
.trace-card-chevron { flex: none; color: var(--accent-text); font-size: 14px; line-height: 1; }.trace-card-title { flex: none; color: var(--text); font-weight: 600; }
.trace-card-count {
  flex: none; font-size: 11px; color: var(--accent-text);
  background: var(--accent-soft); border-radius: 999px; padding: 1px 7px;
}
.trace-card-summary {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  opacity: .8; font-size: 11px;
}
.trace-card-done { flex: none; font-size: 11px; color: #3aa472; }
.trace-card-body {
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
  padding: 2px 8px 8px; border-top: 1px solid var(--border);
}
.trace {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 12px; color: var(--muted); background: transparent;
  border: 0; border-radius: 0; padding: 3px 4px 3px 0;
}
.trace-icon { flex: none; font-weight: 700; font-size: 12px; }
.trace-body { min-width: 0; }
.trace code { font-size: 11px; color: var(--text); opacity: .75; word-break: break-all; }
/* 分类型配色：router 紫 / 网络青 / 委派橙 / 成功绿 / 动作红 / 失败深红 / 其他灰（纯文本行，只用 icon 分色） */
.trace-router .trace-icon { color: #7c6cff; }
.trace-net .trace-icon { color: #2f9e8f; }
.trace-delegate .trace-icon { color: #d98a2b; }
.trace-ok .trace-icon { color: #3aa472; }
.trace-act .trace-icon { color: #d9534f; }
.trace-err .trace-icon { color: #c0392b; }
.trace-info .trace-icon { color: var(--muted); }
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
