# Mermaid Mindmap 括号节点文本被截断问题分析

> 对象：`docs/课程笔记/大二上/离散数学（下）/关系/关系.md` 第 6–54 行 mindmap
> 日期：2026-08-03
> 状态：分析完成，根因已通过源码 + 实测双重证实，修复方案已实测
> 复现环境：mermaid@11.16.0（与项目 CDN 加载版本一致）+ jsdom / Node v22

---

## 1. 问题描述

关系.md 第 9.4 节 mindmap 中，三个节点**只渲染出 "R"**：

```markdown
    9.4 关系的闭包
      自反闭包 r(R)     ← 渲染成一个小圆角节点 "R"
      对称闭包 s(R)     ← 渲染成一个小圆角节点 "R"
      传递闭包 t(R)     ← 渲染成一个小圆角节点 "R"
      Warshall算法       ← 正常
```

同一 mindmap 中其他节点（`关系的定义`、`Warshall算法`、`商集 A/R` 等）全部正常，唯独这三个含**半角圆括号**的节点出问题。

---

## 2. 排查结论（一句话）

**源码内容完好；问题出在 Mermaid mindmap 语法本身**：半角 `(` `)` 在 mindmap 中是**节点形状语法**的标记（而非普通文本字符），`r(R)` 被解析为"id = `r`，括号内为标签 = `R`，形状 = 圆角"的形状节点。渲染端只显示标签 `R`，于是 `自反闭包` 与 `r` 全部消失。

> 更新（补充验证）：**存在保留英文括号的写法**——用 HTML 命名实体 `&lpar;` / `&rpar;` 代替半角括号，详见 [4.1 节](#41-html-命名实体方案保留英文括号)。

---

## 3. 证据链

### 3.1 语法层：jison 词法/文法定义（根因）

Mermaid mindmap 由 jison 语法 [mindmap.jison](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/mindmap/parser/mindmap.jison) 定义。已核对 v11.0.0 与 develop 分支，关键规则**完全一致**（11.x 全系列行为相同）：

**词法规则**（第 39、43 行）：

```jison
"("                { this.begin('NODE');return 'NODE_DSTART'; }   // 半角 ( 是"节点形状起始"标记
[^\(\[\n\)\{\}]+         return 'NODE_ID';                          // 节点 ID 禁止出现半角括号
```

**语法规则**（第 122–126 行）：

```jison
nodeWithId
  :  NODE_ID             { $$ = { id: $1, descr: $1, type: yy.nodeType.DEFAULT }; }
  |  NODE_ID NODE_DSTART NODE_DESCR NODE_DEND
                         { $$ = { id: $1, descr: $3, type: yy.getType($2, $4) }; }
```

即：`id(...)` 形式是**合法的"带 ID 的形状节点"**——`(...)` 内是描述文本（descr），`yy.getType()` 决定节点形状（`()`→圆角、`[]`→方形、`(( ))`→圆形等）。**这正是 flowchart 语法 `A(text)` 在 mindmap 中的残留**，也是"括号被吞"的语法根因。

### 3.2 AST 层：mermaid@11.16.0 实测解析结果

用与项目相同的 mermaid@11.16.0 解析 `自反闭包 r(R)`，AST 输出：

```json
{ "nodeId": "自反闭包 r", "descr": "R", "type": 1, ... }
```

- `nodeId` 与 `descr` **被拆分为两个字段**（`自反闭包 r` / `R`）；
- `type: 1` = **圆角形状**（`yy.getType('(', ')')` 的结果）。

### 3.3 渲染层：与用户观察吻合

mindmap 渲染器以 `descr` 为节点标签 → 页面上显示为一个小圆角节点 **"R"**，与用户观察到的现象完全一致。

### 3.4 为什么只有这三个节点出问题

| 行内容 | 是否含半角括号 | 解析结果 |
|---|---|---|
| `自反闭包 r(R)` | 是 | id=`自反闭包 r`，descr=`R`，type=1 ✗ |
| `对称闭包 s(R)` | 是 | 同上 ✗ |
| `传递闭包 t(R)` | 是 | 同上 ✗ |
| `Warshall算法`、`商集 A/R`、`LUB/GLB` 等 | 否 | id=descr，type=0 ✓ |
| `root((关系<br/>第9章))` | 是（但 `((` 是合法的圆形形状语法，作者意图与语法一致） | id=`root`，descr=`关系<br>第9章`，type=3（圆形）✓ |

> 附带验证：`<br/>` 标签在节点内**正常工作**（descr 完整保留，仅规范化为 `<br>`），根节点无内容丢失。

---

## 4. 修复方案实测对比

在 mermaid@11.16.0 下对 6 种候选写法逐一解析验证：

| 方案 | 写法示例 | AST 结果 | 结论 |
|---|---|---|---|
| **全角括号** ✅ | `自反闭包 r（R）` | id=descr=`自反闭包 r（R）`，type=0（默认形状） | **可用**，文本完整 |
| **HTML 命名实体** ✅ | `自反闭包 r&lpar;R&rpar;` | id=descr=`自反闭包 r&lpar;R&rpar;`，type=0；真实浏览器渲染为 `r(R)` | **可用**，保留英文括号（见 4.1 节） |
| 十进制实体 | `自反闭包 r&#40;R&#41;` | descr 被内部文本预处理破坏为 `r&ﬂ°°40¶ßR&ﬂ°°41¶ß`（`#` 被替换为特殊 Unicode 序列），真实渲染为 `r&(R&)` 乱码 | **不可用** |
| URL 编码 | `自反闭包 r%28R%29` | AST 保留，但渲染层**不解码**，显示字面量 `%28` | **不可用** |
| 整行引号 | `"自反闭包 r(R)"` | 词法层面：引号只在 NODE 状态（`(` 之后）才作为字符串定界符，默认状态下 `"` 属于 NODE_ID → 状态不平衡，**解析报语法错误** | **不可用** |
| 加空格 | `自反闭包 r (R)` | id=`自反闭包 r `，descr=`R`，type=1 | **不可用**，同样被拆分 |
| 双括号 | `自反闭包 r((R))` | id=`自反闭包 r`，descr=`R`，type=3（圆形） | **不可用**，只是形状变了 |
| 反斜杠 | `自反闭包 r\(R\)` | `\` 进入节点文本且括号仍被拆分（id=`自反闭包 r\`，descr=`R\`，type=1） | **不可用** |
| 无括号对照 | `Warshall算法` | id=descr，type=0 | 正常（对照组） |

**结论：两种可行方案——全角括号 `r（R）`（最简单）或 HTML 命名实体 `r&lpar;R&rpar;`（保留英文括号）**。前者中文排版自然；后者在不改变笔记视觉风格的前提下保留数学记号原貌。

### 4.1 HTML 命名实体方案（保留英文括号）

**为什么 `&lpar;` 能行而 `&#40;` 不行**——mermaid 的文本预处理 [utils.ts](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/utils.ts) 只会破坏 `#` 开头的实体：

```ts
txt = txt.replace(/#\w+;/g, s => { ... return 'ﬂ°°' + innerTxt + '¶ß'; });  // 把 &#40; 占位化
export const decodeEntities = text => text.replace(/ﬂ°°/g, '&#').replace(/ﬂ°/g, '&').replace(/¶ß/g, ';');
```

- `&#40;`（十进制）含 `#` → 被占位为 `ﬂ°°40¶ß` → 渲染时还原为 `&#40;` 后 `&` 又被安全转义 → 最终显示 `&(R&)` 乱码；
- `&lpar;`（命名实体）不含 `#` → **不触发占位预处理**，原样进入渲染 → 经 innerHTML 注入由浏览器自然解码为 `(`。

**真实浏览器验证**（Chrome headless + 项目同版本 mermaid@11.16.0 CDN，securityLevel=loose）：

| 实体写法 | 渲染显示 |
|---|---|
| `r&lpar;R&rpar;` | `r(R)` ✅ |
| `a&lbrack;b&rbrack;`（方括号形状符） | `a[b]` ✅ |
| `s&lbrace;1,2&rbrace;`（花括号形状符） | `s{1,2}` ✅ |
| `w&lpar;R&rpar;（含）`（实体+中文混合） | `w(R)（含）` ✅ |

**MkDocs 管道兼容性**（用项目 mkdocs.yml 相同的扩展列表模拟）：Python-Markdown 把代码块中的 `&lpar;` 转义为 `&amp;lpar;`，浏览器解析 HTML 后 Mermaid 拿到的仍是 `&lpar;` → 双层转义链路安全成立。

> 注意：`&lpar;` 方案要求 securityLevel = loose（项目 mermaid.mjs 已配置），strict 下 HTML 会被清理。

### 修复后的完整验证

将 9.4 三个节点替换为全角括号后，对整份 mindmap（第 6–54 行）重新解析：

- ✅ 语法通过，**全部 46 个节点 id=descr**，无任何拆分类节点；
- ✅ 三个修复节点均为 `自反闭包 r（R）` / `对称闭包 s（R）` / `传递闭包 t（R）`，type=0（默认形状）；
- ✅ 全库其余 mindmap 无同类问题（`grep` 全库扫描确认）。

---

## 5. 全库排查

扫描 `docs/` 全部 markdown 的 mindmap 代码块中含半角括号的行：

- `关系.md`：3 处（`r(R)`、`s(R)`、`t(R)`）——本次问题；
- `关系.md` 的 `root((关系<br/>第9章))`：合法的圆形根节点语法，正常；
- **其余所有文件：无同类问题**。

---

## 6. 附带发现（写笔记时的防坑清单）

1. **形状语法枚举**（实测 type 值）：`x(y)`→圆角(1)、`x[y]`→方形(2)、`x((y))`→圆形(3)、`x{{y}}`→六边形(6)。**mindmap 节点文本中只要出现半角 `(` `)` `[` `]` `{` `}`，就会被当作形状语法**——这不是 bug，是语法设计。
2. mindmap **没有** flowchart 的 `A["text with (parens)"]` 式字符串转义机制——引号在 mindmap 里无法保护括号（见上表）。
3. 预防规则：**mindmap 节点文本默认使用全角括号**（`（）`）表示数学记号，如 `r（R）`、`A（B）`；**若必须保留英文括号，用 HTML 命名实体**：`&lpar;`（`(`）、`&rpar;`（`)`）、`&lbrack;`（`[`）、`&rbrack;`（`]`）、`&lbrace;`（`{`）、`&rbrace;`（`}`）。切勿使用十进制/十六进制实体（`&#40;`、`&#x28;`）——含 `#` 会被 mermaid 预处理破坏。

---

## 7. 建议修复补丁

`关系.md` 第 35–37 行，二选一：

**方案 A：全角括号**（最简单，中文排版自然）

```diff
-      自反闭包 r(R)
-      对称闭包 s(R)
-      传递闭包 t(R)
+      自反闭包 r（R）
+      对称闭包 s（R）
+      传递闭包 t（R）
```

**方案 B：HTML 命名实体**（保留英文括号原貌，与正文 LaTeX `$r(R)$` 视觉一致）

```diff
-      自反闭包 r(R)
-      对称闭包 s(R)
-      传递闭包 t(R)
+      自反闭包 r&lpar;R&rpar;
+      对称闭包 s&lpar;R&rpar;
+      传递闭包 t&lpar;R&rpar;
```

> 注：正文 9.4 节的 LaTeX（`$r(R)$` 等）不受影响——LaTeX 公式由 MathJax 渲染，与 Mermaid 语法无关。两种方案均已通过真实浏览器（mermaid@11.16.0）与 MkDocs 管道双重验证。
