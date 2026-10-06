/**
 * Mermaid 图表主加载器
 * =====================
 * 职责：
 *   1. 从 CDN 加载 Mermaid（ESM 版，与项目原 UMD 版同版本 11.16.0）
 *   2. 读取思维导图专用配置（mindmap.mjs），按当前明暗模式合并配色
 *   3. 初始化 Mermaid（theme: "base"，使 themeVariables 深度定制生效）
 *   4. 暴露全局 window.mermaid，让 Material 直接使用本实例，
 *      避免其再次从 unpkg 加载默认脚本（见 Material mermaid/index.ts fetchScripts）
 *
 * 与 Material 的协作机制（关键）：
 *   Material 渲染前会调用 mermaid.initialize({startOnLoad:false, themeCSS, sequence:{...}})，
 *   而 mermaid 的 initialize() 内部执行 setSiteConfig()，会【从 defaultConfig 全量重置】
 *   并重新计算 themeVariables——即使不传 theme，也会走 theme.default 分支，
 *   把我们先前设置的 theme / themeVariables 全部冲掉。
 *
 *   因此本文件采用【劫持 initialize】策略：
 *   1. 保留原生 initialize（供 Material 正常注入其 themeCSS 等样式）
 *   2. 在每次 initialize 之后，用 updateSiteConfig()（增量合并，不动 themeCSS）
 *      把我们的 theme: "base" + themeVariables（含 mindmap 配色）覆盖回去。
 *   这样 Material 的样式机制不受影响，我们的主题配置也始终生效。
 *
 * 若需新增其他图表类型（flowchart / sequence / class 等）的全局配置，
 * 可仿照 mindmap.mjs 另建独立配置文件，并在下方合并。
 */

import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs"
import { mindmapTheme, mindmapThemeCSS } from "./mindmap.mjs"

/* ----------------------------------------------------------------------------
 * 明暗模式检测
 * ------------------------------------------------------------------------- */

/**
 * 获取当前明暗模式
 * Material 在 <html> 上设置 data-md-color-scheme 属性：
 *   - "default" → 浅色
 *   - "slate"   → 深色
 *   - 未设置（auto 模式）→ 回退到系统偏好
 */
function getColorScheme() {
  const scheme = document.documentElement.getAttribute("data-md-color-scheme")
  if (scheme === "slate") return "dark"
  if (scheme === "default") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/* ----------------------------------------------------------------------------
 * 主题变量组装
 * ------------------------------------------------------------------------- */

/**
 * 组装 themeVariables：基础变量 + 当前明暗模式下的 mindmap 配色
 * 后续如需扩展其他图表类型，在此追加即可。
 */
function buildThemeVariables() {
  const mode = getColorScheme()
  return {
    /* 基础变量 */
    darkMode: mode === "dark",
    fontFamily: "Roboto, 'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",

    /* 思维导图配色（按明暗模式选择） */
    ...mindmapTheme[mode]
  }
}

/* ----------------------------------------------------------------------------
 * Mindmap 节点形状覆盖规则
 * ------------------------------------------------------------------------- */
// 背景：Material 会注入通用节点规则
//   #__mermaid_0 .node rect/circle/ellipse/path/polygon { fill: var(--md-mermaid-node-bg-color); stroke: var(--md-mermaid-node-fg-color) }
// 特异性 (1,1,1)，且源顺序排在 mermaid 自动生成的 .section-N 形状规则（同为 (1,1,1)）之后 → 胜出，
// 把全部节点拍平成 --md-mermaid-node-bg-color 单色。
// mermaid 独立渲染时会生成 .mindmap-node.section-N 形状规则（特异性 (1,2,1)），
// 但在 Material 页面上缺失；这里动态补回同款规则：
//   (1,2,1) > (1,1,1)，无论源顺序如何都胜出，且仍落在 shadow DOM 内部随 SVG 注入。
// 颜色直接取自 themeVariables（单一数据源，与节点文字/连线同源，明暗模式自动切换）。
// 色值映射与 mermaid 渲染器一致：section-root→git0；section-N→cScale[(N+1)%12]（12 色循环）；
// section--1（未归属节点段）→cScale0。
function buildMindmapShapeOverrideCSS(vars) {
  /* 必须一条规则一个选择器，不能写逗号列表！
     实测 mermaid 处理注入的 themeCSS 时会把逗号列表里
     第一个选择器之后的共享类前缀剥离（例如
     ".mindmap-node.section-root path" 被改写为 "#__mermaid_0 path"，
     变成无差别命中所有 path/circle 的全局规则，既不生效又留隐患）。
     单选择器规则会原样加上容器前缀，与既有文本规则
     （.mindmap-node text:not([class]):last-child）同一安全机制。 */
  const ELEMENTS = ["rect", "path", "circle", "polygon"]
  const lines = []
  const push = (section, color) => {
    for (const el of ELEMENTS) {
      lines.push(`.mindmap-node.section-${section} ${el} { fill: ${color}; stroke: ${color}; stroke-width: 1px; }`)
    }
  }
  /* 顺序：先 0..11，再 -1，最后 root。
     根节点 <g> 同时带 section-root 与 section--1 两个类，
     两条规则特异性相同 (1,2,1)，源顺序在后者胜出，
     root 必须最后发射才能用 git0 深蓝而非 cScale0 浅蓝。 */
  for (let i = 0; i < 12; i++) {
    push(i, vars["cScale" + ((i + 1) % 12)])
  }
  push(-1, vars.cScale0)
  push("root", vars.git0)
  return lines.join("\n")
}

/* ----------------------------------------------------------------------------
 * 劫持 initialize：保证我们的主题配置始终生效
 * ------------------------------------------------------------------------- */
// mermaid.initialize() 内部执行 setSiteConfig()，会从 defaultConfig【全量重置】
// 配置——Material 渲染前调用 initialize({startOnLoad:false, themeCSS, sequence:{...}})
// 时，即使不传 theme 也会走 theme.default 分支重新计算 themeVariables，
// 从而冲掉本文件设置的 theme / themeVariables。
// 解法：包装 initialize，在其后立即用 updateSiteConfig()（增量合并）把
// theme + themeVariables 覆盖回去；其余键（Material 的 themeCSS / sequence 等）不动。

/* 幂等标记：mindmap 文字修正段由 "/*mm-theme-extra" 起头，
   剥离/拼接均以该标记定位，避免重复注入或破坏 Material 的 themeCSS */
const MM_THEME_EXTRA_MARK = "/*mm-theme-extra"

function applyMindmapTheme() {
  const mode = getColorScheme()
  /* themeVariables 计算一次，themeVariables 与形状覆盖规则共用同一数据源 */
  const themeVars = buildThemeVariables()
  /* 取出当前已生效的 themeCSS（含 Material 注入的部分），
     剥离上次追加的 mindmap 修正段，再拼上当前模式的修正段（幂等） */
  const current = mermaid.mermaidAPI.getConfig()
  const baseCss = (current.themeCSS || "")
    .split(MM_THEME_EXTRA_MARK)[0]
    .replace(/\s+$/, "")
  const themeCSS = baseCss + mindmapThemeCSS[mode] + "\n" + buildMindmapShapeOverrideCSS(themeVars)

  mermaid.mermaidAPI.updateSiteConfig({
    theme: "base",          // 仅 base 主题支持 themeVariables 深度定制
    look: "classic",        // DeepSeek 风格：classic 圆角分支
    themeCSS: themeCSS,
    themeVariables: themeVars
  })
}

const originalInitialize = mermaid.initialize.bind(mermaid)
mermaid.initialize = (config) => {
  originalInitialize(config)
  applyMindmapTheme()
}

/* 暴露全局实例：Material 检测到 window.mermaid 已存在即跳过 unpkg 加载 */
window.mermaid = mermaid

/* 初始初始化：基础配置 + 明暗配色（Material 稍后注入其 themeCSS 时，
   劫持逻辑会自动把 theme / themeVariables 重新覆盖回来） */
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose", // 允许 HTML 标签类内容，配合 Material 使用
  theme: "base",
  themeVariables: buildThemeVariables()
})

/* ----------------------------------------------------------------------------
 * 明暗模式切换监听
 * 切换 palette 后增量更新主题变量（updateSiteConfig），使后续渲染
 * （页面导航 / 新增图表）使用新配色；同时保留 Material 注入的 themeCSS。
 * 注意：Material 将已渲染图表置于 closed shadow DOM，切换时不会自动重绘
 * 已存在的图表（Material 官方支持范围外的 mindmap 同理），重新加载页面即可看到新配色。
 * ------------------------------------------------------------------------- */

new MutationObserver(() => {
  applyMindmapTheme()
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-md-color-scheme"] })
