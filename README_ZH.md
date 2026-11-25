# LifeLens — 个人生活数据可视化智能体

> 🌏 [English](README.md)

一个「开放智能体网络（Open Agentic Web）」参赛作品：把你的个人生活数据（睡眠、步数、活动热量、步行速度、耳机音量）变成洞察和图表——**全部分析在浏览器里完成**，使用你自己的 LLM Key（BYOK），并可通过信任的对等智能体站点扩展。

> **你的数据永远不出浏览器。** 所有分析在本地运行；只有匿名化、聚合后的统计数据会发送给你自己配置的 LLM。

## 项目亮点

- **公开的智能体发现** — 智能体通过 `/.well-known/` 下的静态 JSON 文件声明，而不是硬编码在 UI 里。任何第三方运行时都可以拉取并调用它们。
- **浏览器运行时** — 完整的委派链路（拉取 manifest → 解析 network → 渲染 Schema 表单 → 多智能体编排 → 调用 LLM）全部以 JS 模块形式跑在页面里，**无后端**。
- **多智能体委派（AAOSA）** — 前台协调员（front_coordinator）委派数据分析师（data_analyst）和图表设计师（chart_designer），后者直接输出 **ECharts option JSON**，在聊天里实时渲染。
- **真实的跨站委派** — 通过 `peer-link` 声明的对等智能体站点，需用户在浏览器里明确批准后才会加载，其智能体随后成为协调员可调用的工具。
- **BYOK** — 用户自带任意 OpenAI 兼容的 API Key（存于 `localStorage`，绝不打包进产物）。
- **双主题 + 双语界面** — 亮色（极光风）/ 暗色（暗夜玻璃）一键切换；界面文案中英文实时切换，智能体描述随语言加载对应清单。

## 界面功能

- **侧栏三层结构**：对话入口（front_coordinator）→ 内部协作者（data_analyst / chart_designer，默认收起）→ 对等站点（站点行 = 批准开关，批准后智能体平铺展示，带来源标签）
- **添加对等站点**：侧栏「对等站点」旁的 ➕ 按钮，弹窗填站点名 + Manifest URL 即可接入任意符合协议的站点（存 localStorage，切换语言不丢失）
- **对话式交互**：委派过程 trace 可见（含「跨站」标记）、图表气泡、跟进推荐问题 chips、图表一键下载 PNG（2 倍高清，背景随主题）
- **无 Key 演示**：内置完全本地的 Mock LLM，不需要任何 API Key 就能跑通完整委派链路

## OAWC MVP 规范符合性

| 要求 | 实现 |
|---|---|
| `agent-manifest.json`（静态、CORS） | [`public/.well-known/agent-manifest.json`](public/.well-known/agent-manifest.json) |
| 带 JSON Schema 参数的 `*.network.json` | [`public/.well-known/lifelens.network.json`](public/.well-known/lifelens.network.json) |
| 浏览器端运行时 | [`src/runtime/`](src/runtime/) — manifest 加载、编排器、LLM 客户端 |
| ≥ 1 个智能体 | 3 个：`front_coordinator`、`data_analyst`、`chart_designer` |
| 敏感操作确认 | 跨源对等批准确认卡；写入操作需浏览器明确同意 |
| 产物不含凭证 | `.env.production` 强制空 Key，产物经扫描验证 |
| 跨站委派 | `peer-link` + `peer-policy`；批准后才加载对端 manifest |

## 架构

```
┌────────────────────────── 浏览器（无后端）──────────────────────────┐
│                                                                      │
│  index.html（Vue 3 + Ant Design Vue）                                │
│  ├── AgentSidebar        ← 由 network.tools[] + peer-link 渲染       │
│  ├── ChatPanel           ← 用户输入、委派 trace、图表气泡、推荐问题   │
│  ├── SchemaFormModal     ← 由 function.parameters（JSON Schema）     │
│  │                          自动生成的表单弹窗                        │
│  └── ChartCard           ← 渲染智能体返回的 ECharts option           │
│                              （含函数型字段清洗，容错 LLM 输出）      │
│                                                                      │
│  src/runtime/                                                        │
│  ├── manifest.ts        ← 拉取并校验 manifest / network / 对等站点   │
│  ├── orchestrator.ts    ← 委派循环（tools → 递归 agent 调用，        │
│  │                        图表 JSON 沿委派链向上冒泡）                │
│  ├── llm.ts             ← OpenAI 兼容 /chat/completions（BYOK）      │
│  ├── mock.ts            ← 完全本地的 Mock LLM（无 Key 演示）         │
│  └── config.ts          ← localStorage 配置、开发用 CORS 代理        │
│                                                                      │
│  数据留在本地：src/data/* → 以 SITE_STATE 注入智能体提示词            │
└──────────────────────────────────────────────────────────────────────┘
```

### 委派流程

```
用户："帮我看看这个月的睡眠"
  → front_coordinator 委派 → data_analyst      （统计来自本地数据）
  → front_coordinator 委派 → chart_designer    （基于真实数据点生成 ECharts option）
  → 协调员总结要点；图表在聊天里渲染
  → （可选）front_coordinator 跨站委派 → 对等智能体（如 WHO 健康基准顾问）
```

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
```

应用开箱即运行在 **Mock 模式**——一个完全本地的模拟 LLM 驱动真实的委派链路，无需任何 API Key 即可体验全部流程。

使用真实模型：点右上角设置弹窗填入 Key，或创建 `.env` 文件（参考 [.env.example](.env.example)）：

```ini
VITE_LLM_BASE_URL=https://api.deepseek.com   # 任意 OpenAI 兼容端点
VITE_LLM_API_KEY=                            # 你的 Key —— 仅限开发，绝不提交
VITE_LLM_MODEL=deepseek-chat
```

在界面里填写的 Key 存于 `localStorage`（BYOK）。生产构建永远携带空 Key。

## 数据隐私模型

仓库自带**合成样本数据**（`src/data/healthData.sample.json`，180 天 × 5 项指标，统计代表性，无个人信息）。

要分析你自己的数据，转换成相同 schema 后保存为 `src/data/healthData.local.json`（已被 git 忽略，只留在你机器上）：

```json
{
  "sleep":        [{ "date": "2026-06-23", "hours": 7.21 }],
  "steps":        [{ "date": "2026-06-23", "steps": 12345 }],
  "energy":       [{ "date": "2026-06-23", "kcal": 288 }],
  "walkingSpeed": [{ "date": "2026-06-23", "mps": 3.5 }],
  "headphoneDb":  [{ "date": "2026-06-23", "db": 46.6 }]
}
```

构建时若存在本地文件会自动优先使用（见 `vite.config.ts` 里的 `@health-data` 别名）。

注意：天级原始数据始终留在浏览器里，只有计算出的统计数据会进入发给 LLM 的提示词。

## 对等智能体互操作

在 manifest 的 `peer-link` 里指向任意符合协议站点的 manifest URL，其智能体经用户批准后即可从本站调用（对等智能体会自动暴露为入口 agent 的 `delegate_<name>` 工具）。

- **内置演示**：当前 `peer-link` 指向 `http://localhost:5188`（Health Hub 对等演示站，提供 WHO 健康基准顾问）。该站点为独立目录，未随本仓库分发；启动方式为在其目录下运行 `node server.js`（零依赖静态服务器，带 CORS 头）
- **动态接入**：不改动 manifest 也能接——点侧栏「对等站点」旁的 ➕，在弹窗里填站点名 + Manifest URL 即可，走同样的浏览器跨域批准流程

权限模型：对等站点只提供智能体**定义**（instructions + 参数 schema），推理仍走你自己配置的 LLM；数据不出浏览器这条红线不会被对等站点打破。

## 部署

作为静态站点部署（Vercel / Cloudflare Pages / GitHub Pages 均可）。给 `/.well-known/*` 开启 CORS，让其他站点的运行时能发现你的智能体，例如 `vercel.json`：

```json
{
  "headers": [{
    "source": "/.well-known/(.*)",
    "headers": [{ "key": "Access-Control-Allow-Origin", "value": "*" }]
  }]
}
```

## License

[MIT](LICENSE)
