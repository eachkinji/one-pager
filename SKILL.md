---
name: one-pager
description: 做 A4 单页（一页纸）时使用——把汇报内容、数据、方案压进 210×297mm 的单页 HTML，并导出网页版 PNG + 矢量 PDF + Word 三件套，全部卡在一页内。也用于已有单页改内容、加模块、换背景或放 logo，且不能变成两页。
---

# A4 一页纸

把一个主题压进 **A4 单页**（210×297mm），产出三件套：**网页版 PNG + 矢量 PDF + Word（.docx）**，并且**每一版都是一页**。

下文 `<S>` 指本 skill 目录下的 `scripts/`，`<R>` 指本 skill 的根目录（`SKILL.md` 所在目录）。

## 什么时候用

- 一页纸、单页、A4 单页、宣传单页、项目简介、汇报一页纸
- 要把 PPT / 长文档 / 一堆数据压缩成一页
- 已经有一页纸要改内容、加模块、调背景，且**不能变成两页**

**不用**：多页 PPT（用 `guizang-ppt-skill` / `frontend-slides`）；需要配图素材（用 `image-asset`）。

## 核心心法：先量后改

A4 去掉上下边距后，内容区高 **276mm**，这是硬预算。一页纸做到最后通常是**刚好填满**的（`clearanceMm ≈ 0`），所以**加任何内容都必然要从别处挤**，不存在"还有空地儿"。

**永远不要靠眼睛猜。** 每次改完版面跑一次：

```bash
node <S>/audit.mjs [--file index.html]
```

看四个值：

| 字段 | 含义 | 判据 |
|---|---|---|
| `clearanceMm` | 内容底边到页底还剩多少 | **必须 ≥ 0**；0–1.5 = 刚好填满（正常）；> 12 = 底部太空；< 0 = 溢出到第二页 |
| `scrollOverflow` | 页面是否出滚动条 | 必须 `false` |
| `boxes` | 每个模块的实际高度 + flex 值 | **加内容前先看谁有富余** |
| `clipped` | 被 `overflow:hidden` 裁掉内容的元素 | 必须为空 |

`boxes` 是这里最有用的东西——它告诉你哪一行占了多少毫米，而不是让你对着截图目测。

## 工作流

### Step 0 · 起项目

```bash
mkdir -p 项目/assets
cp "<R>/assets/template.html" 项目/index.html
```

模板是**可运行**的：页面骨架、页眉（logo + 品牌 + 口号）、背景层、模块系统、KPI/阶梯/数据条/时间线/对比卡都定义好了，直接改文案和图片路径。

**改之前先读一遍模板的 `<style>`**——类名只有那一处定义，别自己发明新类名（要自定义就写 inline `style`）。

必改：`<title>`、页眉品牌名、口号。换色只改 `:root` 里的 `--accent` / `--paper` / `--ink`。

### Step 1 · 定版面骨架

先把模块列出来，标上每个是**整宽**还是**成对**，再决定谁拿大头高度。经验值：

| 模块类型 | 写法 | 高度 |
|---|---|---|
| 页眉 + 分隔线 | `header` + `.rule-accent` | 约 7mm，固定 |
| 主数字/结论（整宽） | `<section class="mod" style="flex:0 0 auto">` | 40–50mm |
| 带图的左右两栏 | 放在 `<div class="row" style="flex:1.35">` | 拿剩余高度的 2/3 |
| 数据条列表（左右两栏） | 放在 `<div class="row" style="flex:0 0 auto">` | 内容多高就多高，约 50mm |

**关键**：`.row` 的 `flex` 是权重，不是百分比。想让 A 行高、B 行矮，就 A 写 `flex:1.35`、B 写 `flex:0 0 auto`——B 让出来的高度会全给 A。

### Step 2 · 填内容

- 图片放 `assets/`，路径写相对路径
- 每段文案先想好**最坏情况**（最长一行会不会折行、数字会不会挤）
- 图片按角色选 `object-fit`：地图/照片用 `cover`，3D 场景/图表/UI 用 `contain`（见 pitfalls 4）

### Step 3 · 量版面，腾空间

如果 `audit.mjs` 报了溢出，**按这个顺序**找空间（从最不伤内容的开始，不要一上来就砍内容或缩字号）：

1. **`justify-content:space-evenly/center` 的列表** → 改 `flex-start` + 小 `gap`。富余最大的地方，通常一步就够
2. **把内容驱动的行压到最矮** → `style="flex:0 0 auto"`，让出高度给需要图的那些行
3. **调行的 flex 权重**（`flex:1.35` → `flex:1.6`）
4. **`.page` 的 `gap` 和 `.mod` 的 `padding`**（3mm→2.5mm、3.5mm→3mm）
5. **图片高度**（横图降高最省地方；降完记得回头检查这一行的图有没有被裁坏）
6. **最后才动字号和内容**

**每改一轮量一次**，不要一次改五处——那样出了问题不知道是哪一处。

### Step 4 · 导出网页版

```bash
node <S>/export-page.mjs [--file index.html] [--out 输出] [--name 一页纸]
```

出 `<name>.png`（2× 预览）+ `<name>.pdf`（矢量，A4，`printBackground`）。

### Step 5 · 做 Word 版（需要时）

Word 版是**另写一套代码**（`docx` 库搭表格），不是自动转换。完整做法、单位换算、卡一页的闭环都在 `references/docx-mirror.md`。

验收：

```bash
python <S>/docx-check.py 输出/一页纸.docx --budget 805
```

`pages` 必须是 **1**，`content_bottom_pt` 落在 800 附近（留 20pt 以上余量，Word 和 LibreOffice 的断行有细微差异）。

**导出顺序固定**：截图/图表 → 生成 docx → Word 预览 PDF → **最后**跑 `export-page.mjs`。网页版和 Word 版预览可能同名，顺序错了矢量 PDF 会被顶掉。

## 硬规则

1. **`clearanceMm` 为负就是没做完**，不要交"差一点点"的版本——它到用户机器上会变成两页
2. **模板的类名是唯一来源**，不要发明新类名；自定义一律 inline `style`
3. **背景层必须用 `.page > .bg{position:absolute}` + `.page > *:not(.bg){position:relative}`**。写成 `.page > *{position:relative}` 会把背景层的 absolute 覆盖掉，整页布局塌掉（pitfalls 1）
4. **横向素材放到竖版 A4 上，必须调 `object-position`**，`cover` 只会露出原图中间一条竖切片。透明度 0.3–0.4，同时把 `.mod` 底板提到 0.9 以上（pitfalls 2）
5. **logo 用裁剪版 + `mix-blend-mode:multiply`**，不要直接放带白边的原图（pitfalls 5）
6. **导出前等字体**：`document.fonts.ready`；PDF 要 `printBackground: true` + `preferCSSPageSize: true`
7. **改完版面必须跑 `audit.mjs`**，尤其是压过行高之后——塌成 0 的行和裁坏的图，缩略图上看不出来
8. 交付时**同时给 PNG 和 PDF**：PNG 用来在聊天里看，PDF 用来打印/转发

## 资源文件

| 文件 | 用途 |
|---|---|
| `assets/template.html` | A4 单页种子模板，可运行，直接拷走改 |
| `references/pitfalls.md` | 踩坑字典：症状 → 原因 → 改法。**改版面之前先扫一遍** |
| `references/docx-mirror.md` | 让 Word 版和网页版对齐：docx 库构件、单位换算、卡一页闭环、Word 特有的坑 |
| `scripts/_env.mjs` | 共享：找 Playwright 和 Chrome |
| `scripts/audit.mjs` | 量版面（余量 / 溢出 / 各模块高度 / 被裁元素） |
| `scripts/export-page.mjs` | 导出 PNG + 矢量 PDF |
| `scripts/shot.mjs` | 截单个元素，可先注入 CSS（做 Word 版图表截图用） |
| `scripts/docx-check.py` | 量 docx 的页数和内容底边 |

## 环境

| 需要 | 用在哪 | 装法 |
|---|---|---|
| Node + Playwright | `audit` / `export-page` / `shot` | `npm i playwright && npx playwright install chromium` |
| Chrome 或 Edge | 同上（有系统浏览器就不用下载 chromium） | 脚本会自己找；也可 `CHROME_PATH=` 指定 |
| `docx`（npm） | Word 版 | `npm i docx` |
| LibreOffice | `docx-check` 转 PDF | 官网装 |
| PyMuPDF | `docx-check` 读 PDF | `pip install pymupdf` |

脚本找 Playwright 的顺序是：`PLAYWRIGHT_PATH` 环境变量 → 从当前目录逐级向上找 `.playwright/node_modules` 和 `node_modules` → 全局 `require`。全找不到会打印怎么装，**不会假装成功**。
