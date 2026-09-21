# one-pager · A4 一页纸

一个 [Claude Code](https://claude.com/claude-code) skill：把一个主题压进 **A4 单页**（210×297mm），
产出**三件套**，并且**每一版都严格是一页**。

| 产物 | 用途 |
|---|---|
| `一页纸.png` | 2× 网页预览，用来在聊天里快速看 |
| `一页纸.pdf` | 矢量、A4、带背景，用来打印 / 转发 |
| `一页纸.docx` | 对方需要自己改内容时给 |

## 这个 skill 解决什么问题

一页纸做到最后通常是**刚好填满**的（`clearanceMm ≈ 0`）。这意味着**加任何内容都必然要从别处挤出来**，
不存在"还有空地儿"这回事。靠肉眼看截图判断余量，结果就是到用户机器上翻成两页。

所以核心心法是**先量后改**：每次改完版面都跑一次 `audit.mjs`，用 Playwright 量出

| 字段 | 含义 | 判据 |
|---|---|---|
| `clearanceMm` | 内容底边到页底还剩多少毫米 | **必须 ≥ 0**；0–1.5 = 刚好填满（正常）；> 12 = 底部太空；< 0 = 溢出到第二页 |
| `scrollOverflow` | 页面是否出滚动条 | 必须 `false` |
| `boxes` | 每个模块的实际高度 + flex 值 | 加内容前先看谁有富余 |
| `clipped` | 被 `overflow:hidden` 裁掉内容的元素 | 必须为空 |

腾空间有固定顺序（从最不伤内容的开始）：调列表的 `justify-content` → 把内容驱动的行压到最矮 →
调行 flex 权重 → 调 `gap` / `padding` → 降图片高度 → **最后**才动字号和内容。每改一轮量一次，
不要一次改五处——那样出了问题不知道是哪一处。

## 安装

克隆到 Claude Code 的个人 skill 目录即可：

```bash
git clone git@github.com:eachkinji/one-pager.git ~/.claude/skills/one-pager
```

（HTTPS 也行：`https://github.com/eachkinji/one-pager.git`）

## 环境依赖

| 需要 | 用在哪 | 装法 |
|---|---|---|
| Node + Playwright | `audit` / `export-page` / `shot` | `npm i playwright && npx playwright install chromium` |
| Chrome 或 Edge | 同上（有系统浏览器就不用下载 chromium） | 脚本会自己找；也可用 `CHROME_PATH=` 指定 |
| `docx`（npm） | Word 版 | `npm i docx` |
| LibreOffice | `docx-check` 转 PDF | 官网装 |
| PyMuPDF | `docx-check` 读 PDF | `pip install pymupdf` |

脚本找 Playwright 的顺序是：`PLAYWRIGHT_PATH` 环境变量 → 从当前目录逐级向上找
`.playwright/node_modules` 和 `node_modules` → 全局 `require`。**全找不到会打印怎么装，不会假装成功。**

## 用法

装好之后在 Claude Code 里直接说需求就行，skill 会自动加载：

- 「把这个方案做成一页纸」
- 「这页底部太空了，加点内容，还是保持一页」
- 「Word 版也来一份」
- 「已有的一页纸换个背景色，不能变成两页」

### 手动跑脚本

```bash
# 起项目：拷种子模板
cp "<skill根目录>/assets/template.html" 项目/index.html

# 量版面（改完每次都跑）
node "<skill根目录>/scripts/audit.mjs" --file index.html

# 导出 PNG + 矢量 PDF（最后一步再跑）
node "<skill根目录>/scripts/export-page.mjs" --file index.html --out 输出 --name 一页纸

# 验收 Word 版是不是还在一页
python "<skill根目录>/scripts/docx-check.py" 输出/一页纸.docx --budget 805
```

## 目录结构

```
one-pager/
├── SKILL.md                    # 主文档：工作流、硬规则、资源索引
├── assets/
│   └── template.html           # A4 单页种子模板，可运行，直接拷走改文案
├── references/
│   ├── pitfalls.md             # 踩坑字典：症状 → 原因 → 改法
│   └── docx-mirror.md          # 让 Word 版和网页版对齐：docx 构件、单位换算、卡一页闭环
└── scripts/
    ├── _env.mjs                # 共享：找 Playwright 和 Chrome
    ├── audit.mjs               # 量版面（余量 / 溢出 / 模块高度 / 被裁元素）
    ├── export-page.mjs         # 导出 PNG + 矢量 PDF
    ├── shot.mjs                # 截单个元素，可先注入 CSS（做 Word 版图表截图用）
    └── docx-check.py           # 量 docx 的页数和内容底边
```

## 几条硬规则

1. **`clearanceMm` 为负就是没做完。** 不要交"差一点点"的版本，它到用户机器上会变成两页。
2. **模板的类名是唯一来源**，不要发明新类名；自定义一律写 inline `style`。
3. **背景层必须用** `.page > .bg{position:absolute}` + `.page > *:not(.bg){position:relative}`。
   写成 `.page > *{position:relative}` 会把背景层的 absolute 覆盖掉，整页布局塌掉。
4. **横向素材放到竖版 A4 上必须调 `object-position`**，`cover` 只会露出原图中间一条竖切片。
5. **导出顺序固定**：截图/图表 → 生成 docx → Word 预览 PDF → **最后**跑 `export-page.mjs`。
   顺序错了矢量 PDF 会被同名预览顶掉。
6. **导出前等字体**：`document.fonts.ready`；PDF 要 `printBackground: true` + `preferCSSPageSize: true`。

完整的硬规则和踩坑见 `SKILL.md` 与 `references/pitfalls.md`。

## 相关 skill

- 多页 PPT → `guizang-ppt-skill` / `frontend-slides`
- 配图素材 → `image-asset`

---

个人私有仓库。Word 版是**另写一套代码**（`docx` 库搭表格）而不是自动转换，两套代码靠流程保证内容一致。
