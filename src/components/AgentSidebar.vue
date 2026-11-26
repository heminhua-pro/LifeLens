<script setup lang="ts">
import { reactive, ref } from 'vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { store, selectAgent, approvePeer, addPeer, removePeer, customPeerLabels } from '../store'
import { t } from '../theme'
import type { AgentDef } from '../runtime/types'

/* 对话入口 = manifest.front_man；其余本机 agent 都是内部协作者 */
const entry = () => store.manifest?.front_man || ''
const entryAgent = () => (entry() ? store.agents[entry()] : null)
const internalAgents = () => Object.values(store.agents).filter(a => a.name !== entry())

/* 分区展开/收起：内部协作者默认收起（是实现细节），对等站点默认展开 */
const open = reactive({ internal: false, peers: true })
function toggle(key: 'internal' | 'peers') {
  open[key] = !open[key]
}

/* URL 常量放 script：vue-tsc 3.3.14 的模板 codegen 对含 // 的字符串有转义 bug（vuejs/language-tools#6322） */
const urlHint = 'https://example.com/.well-known/agent-manifest.json'

/* 对等站点父子两级：站点行点击 = 未批准时批准 / 已批准时折叠其智能体 */
const openPeers = reactive<Record<string, boolean>>({})
function peerOpen(label: string) {
  return openPeers[label] !== false
}
function peerToggle(label: string) {
  openPeers[label] = !peerOpen(label)
}
function peerAgents(label: string): AgentDef[] {
  const p = store.peers.find(x => x.label === label)
  return p?.approved && p.agents ? Object.values(p.agents) : []
}
/* 站点圆点：有任一已批准的对等站点才点亮 */
const hasApprovedPeer = () => store.peers.some(p => p.approved)

/* 内联添加对等站点表单 */
const showAdd = ref(false)
const addForm = reactive({ label: '', url: '' })
const addErr = ref('')
function toggleAdd() {
  showAdd.value = !showAdd.value
  addErr.value = ''
  if (!showAdd.value) { addForm.label = ''; addForm.url = '' }
}
function submitAdd() {
  const err = addPeer(addForm.label, addForm.url)
  addErr.value = err || ''
  if (!err) toggleAdd()
}

/* 删除对等站点：仅自定义站点可删（manifest 内置的重载后会回来），popconfirm 二次确认 */
function isCustom(label: string) {
  return customPeerLabels().includes(label)
}
</script>

<template>
  <div class="sidebar">
    <!-- 对话入口 -->
    <div class="sec-head static">
      <span class="sec-dot entry"></span>
      <span class="sec-title">{{ t('groupEntry') }}</span>
    </div>
    <div
      v-if="entryAgent()"
      class="nav-item entry"
      :class="{ active: store.currentAgent === entry() }"
      @click="selectAgent(entry())"
    >
      <div class="name">{{ entry() }}</div>
      <div class="desc">{{ entryAgent()!.function.description }}</div>
    </div>

    <div class="sec-divider"></div>

    <!-- 内部协作者（实现细节，默认收起） -->
    <div class="sec-head" @click="toggle('internal')">
      <span class="sec-dot internal"></span>
      <span class="sec-title">{{ t('groupInternal') }}</span>
      <span class="chev" :class="{ closed: !open.internal }"></span>
    </div>
    <template v-if="open.internal">
      <div
        v-for="a in internalAgents()"
        :key="a.name"
        class="nav-item"
        :class="{ active: store.currentAgent === a.name }"
        @click="selectAgent(a.name)"
      >
        <div class="name">{{ a.name }}</div>
        <div class="desc">{{ a.function.description }}</div>
      </div>
    </template>

    <div class="sec-divider"></div>

    <!-- 对等站点：未批准=站点行；批准后单智能体直接平铺，多智能体才保留父子两级 -->
    <div class="sec-head" @click="toggle('peers')">
      <span class="sec-dot peer" :class="{ on: hasApprovedPeer() }"></span>
      <span class="sec-title">{{ t('groupPeers') }}</span>
      <PlusOutlined class="add-btn" title="添加对等站点" @click.stop="toggleAdd" />
      <span class="sec-spacer"></span>
      <span class="chev" :class="{ closed: !open.peers }"></span>
    </div>

    <!-- 添加对等站点弹窗 -->
    <a-modal
      :open="showAdd"
      :title="t('addPeerTitle')"
      @cancel="toggleAdd"
      @ok="submitAdd"
      :ok-text="t('peerAdd')"
      :cancel-text="t('btnCancel')"
      :width="420"
    >
      <div class="field-label">{{ t('fieldPeerName') }}</div>
      <a-input v-model:value="addForm.label" placeholder="health_hub" />
      <div class="field-label">Manifest URL</div>
      <a-input v-model:value="addForm.url" :placeholder="urlHint" />
      <div v-if="addErr" class="add-err">{{ addErr }}</div>
      <div class="add-tip">{{ t('peerAgentsHint') }}</div>
    </a-modal>
    <template v-if="open.peers">
      <template v-for="p in store.peers" :key="p.label">
        <!-- 未批准：显示站点行，点击批准 -->
        <div v-if="!p.approved" class="nav-item site" @click="approvePeer(p.label)">
          <div class="name">
            {{ p.label }}
            <span class="lock">{{ t('pending') }}</span>
          </div>
          <div class="desc">{{ t('peerAgentsHint') }}</div>
          <a-popconfirm
            v-if="isCustom(p.label)"
            :title="t('peerRemoveConfirm')"
            :ok-text="t('btnDelete')"
            :cancel-text="t('btnCancel')"
            @confirm="removePeer(p.label)"
          >
            <DeleteOutlined class="row-del" :title="t('btnDelete')" @click.stop />
          </a-popconfirm>
        </div>
        <!-- 已批准 + 仅一个智能体：站点名变小标签，agent 直接平铺（两级到底） -->
        <template v-else-if="peerAgents(p.label).length <= 1">
          <div
            v-for="a in peerAgents(p.label)"
            :key="a.name"
            class="nav-item"
            :class="{ active: store.currentAgent === a.name }"
            @click="selectAgent(a.name)"
          >
            <div class="name">{{ a.name }} <span class="peer-tag">{{ p.label }}</span></div>
            <div class="desc">{{ a.function.description }}</div>
            <a-popconfirm
              v-if="isCustom(p.label)"
              :title="t('peerRemoveConfirm')"
              :ok-text="t('btnDelete')"
              :cancel-text="t('btnCancel')"
              @confirm="removePeer(p.label)"
            >
              <DeleteOutlined class="row-del" :title="t('btnDelete')" @click.stop />
            </a-popconfirm>
          </div>
        </template>
        <!-- 已批准 + 多个智能体：保留站点父行 + 缩进子行 -->
        <template v-else>
          <div class="nav-item site" @click="peerToggle(p.label)">
            <div class="name">{{ p.label }}</div>
            <div class="desc">{{ p.url }}</div>
            <a-popconfirm
              v-if="isCustom(p.label)"
              :title="t('peerRemoveConfirm')"
              :ok-text="t('btnDelete')"
              :cancel-text="t('btnCancel')"
              @confirm="removePeer(p.label)"
            >
              <DeleteOutlined class="row-del shifted" :title="t('btnDelete')" @click.stop />
            </a-popconfirm>
            <span class="chev small" :class="{ closed: !peerOpen(p.label) }"></span>
          </div>
          <template v-if="peerOpen(p.label)">
            <div
              v-for="a in peerAgents(p.label)"
              :key="a.name"
              class="nav-item child"
              :class="{ active: store.currentAgent === a.name }"
              @click="selectAgent(a.name)"
            >
              <div class="name">{{ a.name }}</div>
              <div class="desc">{{ a.function.description }}</div>
            </div>
          </template>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.sidebar { height: 100%; overflow-y: auto; padding-bottom: 12px; scrollbar-width: none; }
.sidebar::-webkit-scrollbar { display: none; }

/* 分区标题 */
.sec-head {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 14px 8px;
  cursor: pointer; user-select: none;
}
.sec-head.static { cursor: default; }
.sec-title { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; min-width: 0; }
.sec-head .chev { margin-left: auto; }
.sec-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.sec-dot.entry { background: var(--accent); }
.sec-dot.internal { background: #f59e0b; }
.sec-dot.peer { background: #9ca3af; transition: background .25s ease; }
.sec-dot.peer.on { background: #22d3ee; }

/* 折叠箭头（纯边框画）：展开朝下，收起朝左 */
.chev {
  width: 8px; height: 8px; flex: none;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform .2s ease, border-color .15s ease;
}
.chev.closed { transform: rotate(135deg); }
.sec-head:hover .chev { border-color: var(--text); }
.chev.small { width: 6px; height: 6px; }

/* 分区之间的通栏分隔线（0.5px 细线） */
.sec-divider { height: 0.5px; background: var(--chart-grid); margin: 12px 0 0; }

/* 标题旁的「+」添加按钮（antd PlusOutlined，无边框，字号与标题一致） */
.add-btn {
  font-size: 14px; line-height: 1; color: var(--muted);
  cursor: pointer; transition: color .15s ease;
}
.add-btn:hover { color: var(--accent-text); }
.sec-spacer { flex: 1; }

/* 弹窗内表单 */
.field-label { font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
.field-label:first-child { margin-top: 0; }
.add-err { font-size: 12px; color: #ef4444; margin-top: 8px; }
.add-tip { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.6; }

/* 列表项：通栏满宽，选中/悬停背景铺满整行 */
.nav-item {
  padding: 9px 14px; cursor: pointer; position: relative;
  transition: background .15s ease;
}
.nav-item:hover { background: var(--hover); }
.nav-item.active { background: var(--accent-soft); }
.nav-item.active .name { color: var(--accent-text); }
.nav-item .name { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; padding-right: 16px; }
.nav-item .desc { font-size: 12px; color: var(--muted); line-height: 1.45; margin-top: 1px; }

/* 对等站点行：状态徽标 + 右侧折叠箭头 */
.nav-item.site .name { display: flex; align-items: center; gap: 6px; }
.nav-item.site .chev { position: absolute; right: 14px; top: 16px; }
.nav-item .lock { font-size: 12px; color: #d97706; font-weight: 400; }

/* 单智能体平铺时的站点归属小标签 */
.peer-tag {
  font-size: 12px; color: var(--accent-text); font-weight: 400;
  background: var(--accent-soft); border-radius: 6px; padding: 0 6px; margin-left: 2px;
}

/* 行内删除按钮：hover 行时浮现，红色提示危险操作 */
.row-del {
  position: absolute; right: 14px; top: 12px;
  font-size: 12px; color: var(--muted);
  opacity: 0; cursor: pointer;
  transition: opacity .15s ease, color .15s ease;
}
.row-del.shifted { right: 32px; } /* 多智能体父行：避开右侧折叠箭头 */
.nav-item:hover .row-del { opacity: 1; }
.row-del:hover { color: #ef4444; }

/* 对方的智能体：缩进子行 + 左侧引导线 */
.nav-item.child { padding-left: 32px; }
.nav-item.child::before {
  content: ''; position: absolute; left: 18px; top: 0; bottom: 0;
  width: 2px; background: var(--border);
}
.nav-item.child:first-of-type::before { top: 4px; }
</style>
