# LifeLens — Personal Life Data Visualization Agents

An **Open Agentic Web Challenge** submission: an open, publicly discoverable agent site that turns your personal life data (sleep, steps, activity energy, walking speed, headphone audio exposure) into insights and charts — analyzed entirely **in your browser**, with your own LLM key, and extensible through trusted peer agent sites.

> **Your data never leaves your browser.** All analysis runs locally; only anonymized, aggregated statistics are sent to the LLM you configure (BYOK).

> 🌏 [中文文档](README_ZH.md)

## What it demonstrates

- **Public agent discovery** — agents are declared in static JSON files under `/.well-known/`, not hardcoded in the UI. Any third-party runtime can fetch and call them.
- **Browser runtime** — the full delegation loop (fetch manifest → parse network → render schema-driven forms → orchestrate multi-agent delegation → call LLM) runs as plain JS modules in the page. No backend.
- **Multi-agent delegation (AAOSA)** — a front coordinator delegates to a data analyst and a chart designer, whose output is a raw **ECharts option JSON** rendered directly in the chat.
- **Real cross-site delegation** — peer agent sites declared via `peer-link` are loaded after explicit user approval, and their agents become callable tools for the coordinator.
- **BYOK** — users bring any OpenAI-compatible API key (stored in `localStorage`, never shipped in the bundle).

## OAWC MVP Profile compliance

| Requirement | Implementation |
|---|---|
| `agent-manifest.json` (static, CORS) | [`public/.well-known/agent-manifest.json`](public/.well-known/agent-manifest.json) |
| `*.network.json` with JSON Schema params | [`public/.well-known/lifelens.network.json`](public/.well-known/lifelens.network.json) |
| Browser-provided runtime | [`src/runtime/`](src/runtime/) — manifest loader, orchestrator, LLM client |
| ≥ 1 agent | 3 agents: `front_coordinator`, `data_analyst`, `chart_designer` |
| Manifest loading validation | `manifest.ts` `validateNetwork()`: non-empty tools, missing `name`, duplicate agent names, `front_man` existence — shared by `loadNetwork` / `loadPeer`, failures reject the load |
| Sensitive-action confirmation | Cross-origin peer approval card and site-action card (confirm button shows loading, success/failure toasts); writes require explicit browser consent |
| Site action (grounded capability) | `export_analysis`: exports the analysis as a Markdown report or PNG chart locally; runs only after consent |
| Observable execution | In-chat trace card: delegation chain, argument summaries, per-request latency and total duration; traces never contain keys or credentials |
| No credentials in shipped artifact | `.env.production` forces an empty key; verified by bundle scan |
| Cross-site delegation | `peer-link` + `peer-policy`; approval-gated loading of peer manifests |

## Architecture

```
┌─────────────────────────── Browser (no backend) ───────────────────────────┐
│                                                                             │
│  index.html (Vue 3 + Ant Design Vue)                                        │
│  ├── AgentSidebar        ← rendered from network.tools[] + peer-link        │
│  ├── ChatPanel           ← user input, delegation traces, chart bubbles     │
│  ├── SchemaFormModal     ← auto-generated from function.parameters (JSON    │
│  │                          Schema → form UI)                               │
│  └── ChartCard           ← renders ECharts options returned by agents       │
│                                                                             │
│  src/runtime/                                                               │
│  ├── manifest.ts        ← fetch & validate manifest / network / peers       │
│  ├── orchestrator.ts    ← delegation loop (tools → recursive agent runs)    │
│  ├── llm.ts             ← OpenAI-compatible /chat/completions (BYOK)        │
│  ├── mock.ts            ← fully local mock LLM (demo without any key)       │
│  └── config.ts          ← localStorage config, dev-only CORS proxy          │
│                                                                             │
│  Data stays local: src/data/* → injected into agent prompts as SITE_STATE   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Delegation flow

```
User: "How is my sleep this month?"
  → front_coordinator delegates → data_analyst     (stats from local data)
  → front_coordinator delegates → chart_designer   (ECharts option from real data points)
  → coordinator summarizes; chart rendered in chat
  → (optional) front_coordinator delegates cross-site → peer agent (e.g. WHO benchmark advisor)
```

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

The app runs in **Mock mode** out of the box — a fully local simulated LLM drives the real delegation chain, so you can try everything without an API key.

To use a real model, either fill the settings dialog in the top-right corner, or create a `.env` (see [.env.example](.env.example)):

```ini
VITE_LLM_BASE_URL=https://api.deepseek.com   # any OpenAI-compatible endpoint
VITE_LLM_API_KEY=                            # your key — dev only, never committed
VITE_LLM_MODEL=deepseek-chat
```

Keys entered in the UI are stored in `localStorage` (BYOK). Production builds always ship with an empty key.

## Data privacy model

The repository ships with **synthetic sample data** (`src/data/healthData.sample.json`, 180 days × 5 metrics, statistically representative, no personal information).

To analyze your own data, convert it to the same schema and save it as `src/data/healthData.local.json` (git-ignored, stays on your machine):

```json
{
  "sleep":        [{ "date": "2026-06-23", "hours": 7.21 }],
  "steps":        [{ "date": "2026-06-23", "steps": 12345 }],
  "energy":       [{ "date": "2026-06-23", "kcal": 288 }],
  "walkingSpeed": [{ "date": "2026-06-23", "mps": 3.5 }],
  "headphoneDb":  [{ "date": "2026-06-23", "db": 46.6 }]
}
```

The build picks your local file automatically when present (see the `@health-data` alias in `vite.config.ts`).

Note: raw day-level data stays in the browser; only computed statistics are included in LLM prompts sent to the endpoint you configure.

## Deployment

Deploy as a static site (Vercel / Cloudflare Pages / GitHub Pages all work). Serve `/.well-known/*` with CORS enabled so other sites' runtimes can discover your agents, e.g. `vercel.json`:

```json
{
  "headers": [{
    "source": "/.well-known/(.*)",
    "headers": [{ "key": "Access-Control-Allow-Origin", "value": "*" }]
  }]
}
```

## Peer interop

Point `peer-link` in your manifest at any other OAWC-compliant site's manifest to make its agents callable from here (after user approval). Peer agents are exposed to the entry agent as `delegate_<name>` tools automatically.

- **Built-in demo**: the current `peer-link` points at `https://heminhua-pro.github.io/health-hub-peer/` — a publicly deployed Health Hub peer site (WHO benchmark advisor; standalone MIT-licensed source, deployable anywhere with the included zero-dependency `node server.js`).

## License

[MIT](LICENSE)
