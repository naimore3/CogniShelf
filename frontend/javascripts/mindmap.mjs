/**
 * 思维导图（mindmap）专用主题配置
 * ==================================
 * 本文件独立管理 mindmap 图表的全部配色，与主加载器 mermaid.mjs 解耦。
 * 之后想调整思维导图样式，只需修改本文件，无需触碰其他图表配置。
 *
 * 配色键位说明（均由 Mermaid 渲染器从 themeVariables 读取）：
 *   git0 / gitBranchLabel0  —— 根节点背景色 / 根节点文字色
 *   cScale0..N              —— 第 1..N 层节点背景色（12 色循环）
 *   cScaleLabel0..N         —— 对应层节点文字色
 *   cScaleInv0..N           —— 对应层节点间分支连线色
 *
 * 注意：仅 "base" 主题支持 themeVariables 深度定制，
 * 因此 mermaid.mjs 中必须使用 theme: "base"。
 *
 * 配色来源：复刻 DeepSeek 思维导图（classic 圆角风格）导出 SVG 的色值。
 *   light 模式 = DeepSeek 原始色值；dark 模式 = 同色相更高亮度变体，
 *   保证在暗色背景（scheme: slate）下同样清晰。
 */

export const mindmapTheme = {

  /* 浅色模式（站点 scheme: default，白底）—— DeepSeek 原始色值 */
  light: {
    /* 根节点 */
    git0:            "hsl(240, 100%, 46.2745098039%)", // 深蓝
    gitBranchLabel0: "#ffffff",

    /* 分支填充色（12 色循环，与 DeepSeek 导出一致） */
    cScale0:  "hsl(240, 100%, 76.2745098039%)", // 蓝
    cScale1:  "hsl(60, 100%, 73.5294117647%)",  // 黄
    cScale2:  "hsl(80, 100%, 76.2745098039%)",  // 黄绿
    cScale3:  "hsl(270, 100%, 76.2745098039%)", // 紫
    cScale4:  "hsl(300, 100%, 76.2745098039%)", // 紫红
    cScale5:  "hsl(330, 100%, 76.2745098039%)", // 粉
    cScale6:  "hsl(0, 100%, 76.2745098039%)",   // 红
    cScale7:  "hsl(30, 100%, 76.2745098039%)",  // 橙
    cScale8:  "hsl(90, 100%, 76.2745098039%)",  // 绿
    cScale9:  "hsl(150, 100%, 76.2745098039%)", // 青绿
    cScale10: "hsl(180, 100%, 76.2745098039%)", // 青
    cScale11: "hsl(210, 100%, 76.2745098039%)", // 天蓝

    /* 分支文字色（蓝、紫分支白色，其余黑色） */
    cScaleLabel0:  "#ffffff",
    cScaleLabel1:  "#000000",
    cScaleLabel2:  "#000000",
    cScaleLabel3:  "#ffffff",
    cScaleLabel4:  "#000000",
    cScaleLabel5:  "#000000",
    cScaleLabel6:  "#000000",
    cScaleLabel7:  "#000000",
    cScaleLabel8:  "#000000",
    cScaleLabel9:  "#000000",
    cScaleLabel10: "#000000",
    cScaleLabel11: "#000000",

    /* 分支连线色（填充色色相 +180° 的浅色） */
    cScaleInv0:  "hsl(60, 100%, 86.2745098039%)",
    cScaleInv1:  "hsl(150, 100%, 83.5294117647%)",
    cScaleInv2:  "hsl(260, 100%, 86.2745098039%)",
    cScaleInv3:  "hsl(90, 100%, 86.2745098039%)",
    cScaleInv4:  "hsl(120, 100%, 86.2745098039%)",
    cScaleInv5:  "hsl(150, 100%, 86.2745098039%)",
    cScaleInv6:  "hsl(180, 100%, 86.2745098039%)",
    cScaleInv7:  "hsl(210, 100%, 86.2745098039%)",
    cScaleInv8:  "hsl(270, 100%, 86.2745098039%)",
    cScaleInv9:  "hsl(330, 100%, 86.2745098039%)",
    cScaleInv10: "hsl(0, 100%, 86.2745098039%)",
    cScaleInv11: "hsl(30, 100%, 86.2745098039%)"
  },

  /* 深色模式（站点 scheme: slate，黑底）—— 同色相高亮度变体 */
  dark: {
    /* 根节点（提亮，暗背景下清晰） */
    git0:            "hsl(240, 100%, 60%)",
    gitBranchLabel0: "#ffffff",

    /* 分支填充色（同色相，亮度提升至 86% 左右） */
    cScale0:  "hsl(240, 100%, 86%)", // 蓝
    cScale1:  "hsl(60, 100%, 84%)",  // 黄
    cScale2:  "hsl(80, 100%, 86%)",  // 黄绿
    cScale3:  "hsl(270, 100%, 86%)", // 紫
    cScale4:  "hsl(300, 100%, 86%)", // 紫红
    cScale5:  "hsl(330, 100%, 86%)", // 粉
    cScale6:  "hsl(0, 100%, 86%)",   // 红
    cScale7:  "hsl(30, 100%, 86%)",  // 橙
    cScale8:  "hsl(90, 100%, 86%)",  // 绿
    cScale9:  "hsl(150, 100%, 86%)", // 青绿
    cScale10: "hsl(180, 100%, 86%)", // 青
    cScale11: "hsl(210, 100%, 86%)", // 天蓝

    /* 分支文字色（高亮浅底全部用黑色，保证对比度） */
    cScaleLabel0:  "#000000",
    cScaleLabel1:  "#000000",
    cScaleLabel2:  "#000000",
    cScaleLabel3:  "#000000",
    cScaleLabel4:  "#000000",
    cScaleLabel5:  "#000000",
    cScaleLabel6:  "#000000",
    cScaleLabel7:  "#000000",
    cScaleLabel8:  "#000000",
    cScaleLabel9:  "#000000",
    cScaleLabel10: "#000000",
    cScaleLabel11: "#000000",

    /* 分支连线色（同色相 +180°，亮度提升） */
    cScaleInv0:  "hsl(60, 100%, 92%)",
    cScaleInv1:  "hsl(150, 100%, 90%)",
    cScaleInv2:  "hsl(260, 100%, 92%)",
    cScaleInv3:  "hsl(90, 100%, 92%)",
    cScaleInv4:  "hsl(120, 100%, 92%)",
    cScaleInv5:  "hsl(150, 100%, 92%)",
    cScaleInv6:  "hsl(180, 100%, 92%)",
    cScaleInv7:  "hsl(210, 100%, 92%)",
    cScaleInv8:  "hsl(270, 100%, 92%)",
    cScaleInv9:  "hsl(330, 100%, 92%)",
    cScaleInv10: "hsl(0, 100%, 92%)",
    cScaleInv11: "hsl(30, 100%, 92%)"
  }
}

/**
 * 节点文字颜色修正（注入 themeCSS，随 SVG 进入 closed Shadow DOM）：
 *   Material 把渲染出的 SVG 放进 closed Shadow DOM，页面级 CSS 无法穿透；
 *   因此必须通过 themeCSS 随 SVG 一并注入。
 * 目标元素：.nodeLabel p（classic look 下可见文字的真实宿主）。
 *   Material 的规则 #__mermaid_0 .nodeLabel p{color:var(--md-mermaid-label-fg-color)}
 *   特异性 (1,1,1)，把文字拍成统一灰/浅灰；这里用更高特异性 (1,2,1)/(1,3,1)
 *   的 .mindmap-node.section-N .nodeLabel p 覆盖回配色方案指定的文字色。
 * 不要写 .mindmap-node text:not([class])：classic look 下不存在该 <text> 元素，
 *   文字在 foreignObject 内的 <p> 里，旧规则不生效（实测确认）。
 *   - light：分支文字默认黑色；紫色分支（section-2）白色；根节点（深蓝底）白色
 *   - dark ：分支文字全部黑色（高亮浅底）；根节点白色
 * 以 "/*mm-theme-extra" 标记起始，mermaid.mjs 会幂等地剥离/拼接该段。
 */
export const mindmapThemeCSS = {
  light: "/*mm-theme-extra*/\n" +
    ".mindmap-node .nodeLabel p{color:#000000;}" +
    ".mindmap-node.section-2 .nodeLabel p{color:#ffffff;}" +
    ".mindmap-node.section-root .nodeLabel p{color:#ffffff;}",
  dark: "/*mm-theme-extra*/\n" +
    ".mindmap-node .nodeLabel p{color:#000000;}" +
    ".mindmap-node.section-root .nodeLabel p{color:#ffffff;}"
}
