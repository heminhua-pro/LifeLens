# LifeLens · 90 秒讲解视频逐字稿（中英对照）

> 用法：中文照着念（稍慢，留字幕时间），英文栏直接复制进剪映当字幕。
> 术语保留英文原词（BYOK / grounded capability / peer agent / ECharts），不意译。
> 全程约 90 秒；画面里录浏览器运行，声音是真人中文讲解即可，符合 DevPost 要求。

---

## 第 1 幕 · 开场（0:00–0:10）
**画面**：首页 + 地址栏可见 `heminhua-pro.github.io/LifeLens/`

**中文口播**：
> 大家好，我是 LifeLens 的作者。LifeLens 把你的个人生活数据——睡眠、步数、活动热量、步行速度和耳机音量——变成可读的洞察和图表，而且全部在浏览器里分析，数据不出本机。

**English subtitle**：
> Hi, I'm the creator of LifeLens. It turns personal life data — sleep, steps, active energy, walking speed, headphone exposure — into insights and charts. All analysis runs in your browser; data never leaves your device.

---

## 第 2 幕 · 核心演示（0:10–0:30）
**画面**：输入「帮我看看这个月的睡眠情况」→ 展开执行轨迹卡片 → 图表出现

**中文口播**：
> 我先问一句"这个月睡眠怎么样"。看这条执行轨迹：前台协调员先委派数据分析师统计全量历史，再委派图表设计师生成 ECharts 图。你可以展开看到每一步的参数和返回——这就是多智能体委派，全部在浏览器里跑，没有后端。

**English subtitle**:
> I ask: "How is my sleep this month?" Watch the trace: the front coordinator delegates to a data analyst, then a chart designer that produces an ECharts option. Expand it to see every step — multi-agent delegation, running entirely in the browser, no backend.

---

## 第 3 幕 · BYOK（0:30–0:50）
**画面**：打开 BYOK 设置弹窗 → 填入 Key → 真模型回复（Key 打码）

**中文口播**：
> 默认是本地模拟模式。要点开这个 BYOK 设置，填入你自己的模型地址和 Key，就能接真模型——比如通义千问。Key 只存在浏览器本地，不进代码、不进构建产物，只发给你自己的模型端点。不填 Key 也能完整体验流程。

**English subtitle**:
> By default it runs in local mock mode. Open BYOK Settings and add your own endpoint and key to use a real model, like Qwen. The key stays in your browser — never in the code or build — and goes only to your own endpoint. No key needed to try the full flow.

---

## 第 4 幕 · 跨站委派（0:50–1:10）
**画面**：侧栏批准 peer → 跨域确认弹窗 → WHO 评估结果

**中文口播**：
> 再问一句"我的睡眠符合 WHO 标准吗"。系统会先弹出跨域请求确认，标明目标站点和用途；只有我点同意，它才加载另一个站的 peer agent，由 WHO 基准顾问给出达标判断和建议。拒绝就什么都不发生。

**English subtitle**:
> Now I ask: "Does my sleep meet WHO guidelines?" The site first asks for consent, showing the target origin and purpose. Only after I approve does it load a peer agent from another site — a WHO benchmark advisor — returning a verdict and advice. Decline, and nothing happens.

---

## 第 5 幕 · grounded capability（1:10–1:25）
**画面**：点「导出 Markdown」→ 落地 md + png 两个文件

**中文口播**：
> 最后是 grounded capability。当我要求导出分析报告，agent 调用注册的站点动作，写文件前先把参数摊开让我确认。只有我同意，它才在本地生成报告文件——这就是浏览器作为权限守门员。

**English subtitle**:
> Finally, grounded capability. When I ask to export a report, the agent calls a registered site action and shows me its parameters before writing. Only after I confirm does it save a file locally — the browser acts as the permission gatekeeper.

---

## 第 6 幕 · 收尾（1:25–1:35）
**画面**：仓库 README / 结尾静态画面

**中文口播**：
> 两个仓库都在 GitHub 上开源，MIT 许可。LifeLens——让个人数据留在你手里。谢谢观看。

**English subtitle**:
> Both repositories are open source on GitHub under MIT. LifeLens — keep your personal data in your hands. Thanks for watching.

---

## 录制提示
- 语速放慢约 10%，给英文字幕留阅读时间；每幕之间停顿 1 秒方便剪辑。
- 剪映流程：导入视频 → 音频识别字幕（选中文）→ 用上面英文逐句替换 → 烧录导出。
- 字幕白字 + 半透明黑底、底部居中；术语保留英文原词。
- 全程约 95 秒，别超过 2 分钟。
