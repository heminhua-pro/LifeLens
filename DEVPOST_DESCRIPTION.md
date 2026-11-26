# LifeLens — Features & Functionality

*(Ready-to-paste description for the DevPost "Features & Functionality" field.)*

LifeLens is an Open Agentic Web Challenge submission: a public, browser-native agent site that turns personal life data into understandable insights and charts — without ever sending raw data off the device.

## What it does

Users ask questions in natural language — "How is my sleep this month?", "Is my headphone volume within WHO limits?", "How is my step trend?" — and LifeLens analyzes five dimensions: sleep, steps, active energy, walking speed, and headphone audio exposure. Answers appear as readable explanations alongside interactive ECharts visualizations rendered directly in the conversation, with follow-up suggestions to keep the exploration going.

## How it works

- **Public agent discovery.** Agents are declared in static JSON (`/.well-known/agent-manifest.json` and `lifelens.network.json`) served with CORS, so any third-party runtime can discover and call them — nothing is hardcoded in the UI.
- **Browser runtime, no backend.** Manifest loading, schema-driven form generation, multi-agent delegation, LLM calls, and chart rendering all run as plain JavaScript modules in the page.
- **Multi-agent delegation.** A front coordinator interprets the question and delegates to a *data analyst* (computes statistics over the full local history) and a *chart designer* (emits an ECharts option built from real data points). Results bubble back and are summarized into one answer.
- **Cross-site delegation.** Peer sites declared via `peer-link` are fetched only after explicit user approval (target origin and purpose shown in a consent dialog). The coordinator can then delegate to a peer agent on a second origin — e.g. a WHO benchmark advisor that returns a verdict and advice. Approval is per-session; a reload resets it.
- **BYOK & privacy.** Users bring their own OpenAI-compatible key, stored only in `localStorage` and never shipped in the build. Raw day-level data stays in the browser; only computed statistics go to the LLM endpoint the user configures. Without a key, a fully local mock LLM drives the same delegation chain for demos. Users can delete their stored configuration at any time.
- **Grounded capability.** A registered site action (`export_analysis`) exports an analysis report as Markdown or PNG. Before it runs, the runtime shows the parameters in a confirmation dialog; the action only executes after explicit consent and writes the file locally.
- **Observability.** Delegation traces, cross-site markers, and tool calls are shown inline in the chat; network and peer loads fail closed.

## Tech stack

Vue 3 + TypeScript + Vite, Ant Design Vue, ECharts, markdown-it + DOMPurify. Deployed as a static site on GitHub Pages; a companion peer site (`health-hub-peer`) is also public and MIT-licensed as a minimal reusable example.

## Verified end-to-end

Both sites are live and tested: public cross-site delegation with consent dialog, real-model BYOK calls, and chart rendering over the full data history.
