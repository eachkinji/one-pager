# 让 Word 版和网页版对齐

一页纸通常要交两个版本：**网页版**（PNG + 矢量 PDF，好看、字准）和 **Word 版**（对方要能自己改）。两者内容必须一致，而且**都必须是一页**。

网页版用 HTML/CSS 排版，Word 版用 `docx` 库（npm）重新搭一遍表格。**不存在自动转换**，是两套代码，所以要靠流程保证一致。

---

## 1. 环境

```bash
npm i docx                      # Word 生成库
```

验证/预览还需要：

- **LibreOffice**（`soffice`）→ docx 转 PDF 看效果
- **PyMuPDF**（`pip install pymupdf`）→ 读 PDF 页数和内容底边做自检

Linux/macOS 把 `soffice.exe` 换成 `soffice` 即可。

---

## 2. 单位对照（最容易搞错的地方）

| 项目 | 单位 | 说明 |
|---|---|---|
| `TextRun.size` | **half-point** | `size:30` = 15pt。网页上 15px ≈ 11.25pt，不要直接抄像素值 |
| `TableCell.width` / `columnWidths` | **DXA**（1/1440 inch） | A4 去掉左右各 1020 DXA 边距后，内容宽 **9866 DXA** |
| `ImageRun.transformation.{width,height}` | **px**（96dpi） | 按图片原始宽高比换算，否则会拉伸 |
| `spacing.line` + `lineRule:'exact'` | DXA | 精确控行高，做细排版时用它 |
| Paragraph `spacing.before/after` | DXA | 140 DXA ≈ 7pt |

**A4 文档设置**（和网页版 11/13/10/13mm 的边距对应）：

```js
page: { size: { width: 11906, height: 16838 },
        margin: { top: 790, right: 1020, bottom: 300, left: 1020 } }
```

内容区高 ≈ 15748 DXA ≈ 787pt。**这就是 Word 版的高度预算。**

---

## 3. 基本构件

```js
const r = (text, o = {}) => new TextRun({
  text, font: FONT, size: o.size ?? 18, bold: o.bold ?? false, color: o.color ?? INK,
});
const p = (children, o = {}) => new Paragraph({
  children: [].concat(children), alignment: o.align,
  spacing: o.spacing ?? { before: 0, after: 0 }, border: o.border,
});
const cell = (w, children, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  borders: o.borders ?? NO_BORDERS, margins: o.margins ?? ZERO_MARGINS,
  verticalAlign: o.valign ?? VerticalAlign.TOP, children: [].concat(children),
});
const tbl = (cols, rows, o = {}) => new Table({
  columnWidths: cols, width: { size: cols.reduce((a,b)=>a+b,0), type: WidthType.DXA },
  layout: TableLayoutType.FIXED, borders: o.borders ?? NO_BORDERS, rows,
});
const spacer = (h) => new Paragraph({ children: [r('', {size:2})],
  spacing: { before: 0, after: 0, line: h, lineRule: 'exact' } });
```

- **模块** = 一个单列表格，`borders` 用 `MOD_BORDERS`（四周实线 + 内部横线）
- **成对模块** = 一个 `[4933, 4933]` 的两列表格，两个 cell 分别装
- **整宽模块** = `[9866]`
- **不要用 `flex` 那套思路**，docx 全靠显式宽度和 `spacer` 堆出来

---

## 4. 卡一页：先量后改

Word 版**没有弹性布局**。网页版加个模块，行会自动让位；Word 版加个模块，就是直接溢到第二页。

**闭环**：

```bash
# 1) 生成
node build_docx.js
# 2) 转 PDF
soffice --headless --convert-to pdf --outdir 输出/_check 输出/xxx.docx
# 3) 量页数 + 内容底边
python -c "
import fitz
d = fitz.open('输出/_check/xxx.pdf')
print('pages:', d.page_count)
p = d[0]
blocks = p.get_text('blocks')
imgs = [p.get_image_bbox(im) for im in p.get_images(full=True)]
print('bottom_y %.0f / 842pt' % max([b[3] for b in blocks] + [b.y1 for b in imgs]))
"
```

**判据**：
- `pages` 必须是 **1**
- `bottom_y` 建议落在 **800pt 上下**，也就是留 **20–25pt 余量**。不要贴着 827pt 的可用底线——Word 和 LibreOffice 的断行、字距有细微差异，贴边在 Word 里可能就翻了页

**腾空间的顺序**（和网页版同理，从最不伤内容的开始）：

1. `spacer(n)` 全局收 20–40 DXA
2. 模块 cell 的 `margins`（`150`→`110`）
3. `barRow` 的 `margins.bottom`
4. 图片 `transformation` 高度（图表降 10–15%，地图/场景降 10%）
5. `kpiMain` 的字号档（44→40）
6. `modHead` 的 `spacing.after`

**一次别降太多**：先按上面顺序砍一轮，量一次，再看还差多少。砍过头会让底部空出一大块，比溢出还难看。

---

## 5. Word 特有的坑

### 5.1 嵌套表格里，数据条和标签对不齐

**症状**：一整行数据条，标签和数值垂直居中，但彩色条浮在上面。

**原因**：外层 cell 设了 `valign: CENTER`，但装条的**内层表格 cell** 没设，默认 TOP。

**改法**：内层和外层都要居中。

```js
const barCell = (width, fill) => new TableCell({
  /* … */
  verticalAlign: VerticalAlign.CENTER,     // ← 内层也要
  children: [/* 一个 lineRule:'exact' 的空段落当高度 */],
});
// 外层
cell(bw, [barTbl], { valign: VerticalAlign.CENTER })
```

### 5.2 数据条列宽对不上，整行错位

`barRow(w, …)` 内部按 `lw + bw + vw = w` 切列，**外面那个 `tbl([...])` 的 `columnWidths` 必须和它一致**。改了 `barRow` 里的 `lw/vw` 忘了改外面，就会错位。

```js
const lw = 1820, vw = 1640, bw = w - lw - vw;      // 1820+1640+bw = 4553 ✓
tbl([1820, 1093, 1640], [ … ])                     // 外面也要是这三个数
```

### 5.3 数值列太窄，数字换行

`1,200–1,440 人` 这种长数值在 `vw = 1450` 时会折成两行。放宽到 `1640` 即可。**加数值后回来看一眼**，别只看有没有溢出——换行不会撑高页面，但很难看。

### 5.4 嵌进去的图表截图，字糊

**症状**：网页截图生成的柱状图，嵌进 Word 后标注小到看不清。

**原因**：截图时元素的 CSS 字号是给**网页**定的（比如 10px 标签放在 445px 宽的容器里 = 占宽度 2.25%）。塞进 Word 里只有 2.7in 宽时，字号等比缩到 4pt 上下。

**改法**：**截图前注入放大字号的 CSS**，让字号占图片宽度的比例变大。

```js
await page.addStyleTag({ content: `
  .bars{height:36mm !important}
  .bars .vlabel{font-size:17px !important}     /* 原来是 10px */
  .baxis div{font-size:14px !important}        /* 原来是 8px */
` });
await page.locator('.invest > div:nth-child(2)').screenshot({ path: '输出/w-chart.png' });
```

注意截图元素里如果有 `height:100%` 的柱体，改容器高度时要一并给柱体换成百分比高度，否则比例会崩。

### 5.5 页背景不要做

Word 没有真正的页背景。只能把整页图片作为**浮动图片挂在页眉里** —— 容易串页、打印会出问题、不同版本 Word 表现不一致。

**决定：Word 版不做背景，只做 logo。** 跟用户说清楚这个取舍，不要默默省略。

### 5.6 页眉里的 logo

直接把裁剪后的 logo 当 `ImageRun` 塞进页眉表格的左 cell 的段落里，和文字并列：

```js
p([
  new ImageRun({ type:'png', data: asset('logo-trim.png'),
                 transformation: { width: 96, height: 25 } }),
  r('  项目名', { size: 30, bold: true }),
])
```

inline 图片是**基线对齐**的，会显得比文字略高一点，属正常，不用管。

---

## 6. 验收清单

- [ ] `page_count == 1`
- [ ] `bottom_y` 在 800pt 附近（留 20pt 以上余量）
- [ ] 每个模块的编号和网页版**一一对应**
- [ ] 数值列没有折行
- [ ] 数据条的条和标签垂直居中
- [ ] 渲染成 PNG 肉眼过一遍（`soffice --convert-to png` 或从 PDF 里取图）
