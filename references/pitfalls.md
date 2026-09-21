# 一页纸踩坑字典

按「症状 → 原因 → 改法」写。都是实际做的时候撞出来的，不是理论。

---

## 1. 背景层加了之后，第一行模块塌成 0 高

**症状**：加了 `.bg` 背景层，页面上某个 `.row` 突然变成 0 高度，后面的内容整体上移。

**原因**：写了

```css
.bg{position:absolute; inset:0}
.page > *{position:relative; z-index:1}
```

`.page > *` 和 `.bg` 的选择器权重**相同**（都是 0,1,0），而 `.page > *` 写在后面 → 后写的赢，`.bg` 的 `position:absolute` 被覆盖成 `relative`。于是背景层变成了普通流里的 flex item，占掉一整页的高度，把别的挤没了。

**改法**：背景层用后代选择器提权重，并且用 `:not()` 把它从通用规则里排除：

```css
.page > .bg{position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none}
.page > *:not(.bg){position:relative; z-index:1}
```

---

## 2. 横向背景图放到竖版 A4 上，只剩一片白

**症状**：素材明明是漂亮的蓝色光带，铺到 A4 上却几乎看不见，或者只有一条莫名其妙的色块。

**原因**：素材是 16:9 / 2:1 的横向图，A4 是 0.707 的竖版。`object-fit:cover` 会**按高度铺满**，然后横向裁掉两边 —— 只露出原图中间约 35–40% 宽的一条竖切片。光带在左上角的图，裁完就啥都不剩。

**改法**：
1. 用 `object-position` 把画面主体挪到你想要的位置（`:right top` / `:left center` / `:center bottom`），一个个试，别猜
2. 透明度假 **0.3–0.4**。0.6 就已经明显压住正文了
3. 同时把模块底板提到 **0.9 以上**：`.mod{background:rgba(250,250,248,.94)}`，否则背景会从卡片里透出来，密密麻麻的小字立刻不可读
4. 想更克制就把背景**只当成页边距里的纹理**——模块底板 0.94 + 背景 0.34，读起来就是"纸有底纹、内容干净"，这是信息密集页唯一安全的做法

---

## 3. 两张图并排，一张横一张竖

**症状**：左图（横）居中后两边空一大片，右图（竖）更惨，在一个大框里缩成一小条。

**原因**：横图 1.78、竖图 0.8，在同一个固定高度下宽度差 2.2 倍。用 `1fr:1fr` 平分列宽 + 图片居中，**几何上就不可能同时填满**。

**改法**（按推荐顺序）：
1. **图 + 文字并排**：每张卡内部再分左右两栏，`[图] [说明文字]`。这是唯一既能保图尺寸、又能把卡填满的排法。
2. 卡片列宽按内容分，不要 `1fr:1fr` —— 用 `1.3fr auto 1fr` 之类，让宽的那边多拿宽度放文字。
3. 实在要两图对等，就把竖图**裁成横的**（牺牲一部分画面）。裁之前先确认裁掉的是什么内容。

**反面教材**：给图片框铺一层灰底 `.imgbox{background:var(--grey-1)}` 再让图 `contain` 居中 —— 留白会变成显眼的灰块，比留白本身更难看。要么让图撑满，要么让文字占掉那块地方。

---

## 4. 行变矮之后，图被裁得看不出是什么

**症状**：为了让别处腾高度，把某一行压扁，结果那行里的 3D 场景图 / 图表被裁成一条，只剩中间一段。

**原因**：`.imgbox img{object-fit:cover}` 是**保边裁中**。框一矮，就只留中间那条。

**改法**：按图片角色选 `object-fit`：

| 图片角色 | 用 | 理由 |
|---|---|---|
| 地图、照片、纹理 | `cover` | 裁掉边缘不影响识别 |
| 3D 场景、轴侧图、流程图 | `contain` | 裁掉就散了，宁可小也要完整 |
| UI 截图、图表、文字密集图 | `contain` | 关键信息不能被裁 |

**每压一次行高，都要回头检查这一行的图**。这是最容易漏的一步。

---

## 5. 页眉 logo 又小又带白方块

**症状**：logo 明明挺大，放进页眉却很小；而且因为是白底 PNG，在米白纸色上能看到一块白矩形。

**原因**：素材 PNG 四周留白很多（例：4938×1655 的图，实际内容只占中间 63%）。设 `height:5mm` 时，真正看得见的 logo 只有 3mm。白底则是 PNG 本身的背景色。

**改法**：

```python
# 1) 先裁掉白边，做成派生文件
from PIL import Image
import numpy as np
im = Image.open('assets/logo.png').convert('RGB')
a = np.asarray(im).astype(int)
mask = (255 - a).max(axis=2) > 18          # 容差，避免把浅色边缘判成内容
ys, xs = np.where(mask)
pad = 12
im.crop((xs.min()-pad, ys.min()-pad, xs.max()+pad, ys.max()+pad)).save('assets/logo-trim.png')
```

```css
/* 2) 用裁剪版，并且 multiply 融掉白底 */
header .brand .logo{height:5.4mm;width:auto;display:block;mix-blend-mode:multiply}
```

`mix-blend-mode:multiply` 对**白底深色 logo** 有效；如果 logo 本身是深底反白，不要用，会变黑块。

**不要**用 `clip-path` 裁留白 —— 元素的布局盒子没变，白占的位置还在。

---

## 6. flex 高度分配不符合预期

**一页纸的高度分配规则**（`.page` 是 flex column）：

- 整宽模块写 `style="flex:0 0 auto"` → 按内容高度，不参与抢空间
- 成对的 `.row` 写 `style="flex:<权重>"` → 权重越大分到的富余高度越多
- 想让某一行**被压到最矮**、把高度全让给别的行 → `style="flex:0 0 auto"`（内容多高就多高）

**注意**：`flex:1` 等于 `flex:1 1 0%`。在**高度 auto 的容器**里，基数是 0 但有 `min-height:0` 时，子项理论上可能塌成 0。实际表现是：行本身有确定高度时没事；一旦把某个容器改成内容驱动，要重新量一遍。

**判据**：改完行高一定要跑 `audit.mjs` 看 `boxes`，别只看截图——塌成 0 的行在缩略图上不一定看得出来。

---

## 7. 页面"刚好填满"是常态，不是 bug

`clearanceMm ≈ 0` 是**正常**的。A4 高 297mm，去掉上下 padding（11+10），内容区正好 276mm。一页纸做到最后通常就是刚好占满。

所以：

- **加任何内容都必然要从别处挤**，不存在"还有空地儿"
- `clearanceMm` 明显大于 0（比如 > 10mm）说明底下空了一块，该把某一行放大或加内容
- `clearanceMm` 为负 = 溢出到第二页了，必须处理

---

## 8. 中文字体与导出

- 字体栈里**必须有中文兜底**：`"PingFang SC","Hiragino Sans GB","Source Han Sans SC","Noto Sans SC","Microsoft YaHei UI","Microsoft YaHei","微软雅黑"`。Windows 上没有苹方，漏了会掉到宋体
- 导出前等字体加载完：`await page.evaluate(() => document.fonts.ready)`
- 导出 PDF 用 `preferCSSPageSize: true` + `@page{size:A4;margin:0}`，否则边距会被打印默认值改掉
- 一定要 `printBackground: true`，不然色块和背景全丢

---

## 9. 导出脚本会互相覆盖

网页版导出（PNG + 矢量 PDF）和 Word 版导出**写的是同名文件**。跑的顺序错了，矢量 PDF 会被 Word 版转出来的 PDF 顶掉。

**固定顺序**：截图/图表 → 生成 docx → Word 预览 PDF → **最后**跑网页版导出。

命名上也可以直接避开：Word 版预览单独叫 `xxx-Word版预览.pdf`，不要和网页版 PDF 同名。
