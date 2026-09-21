#!/usr/bin/env node
/**
 * 量一页纸的版面：底部余量、是否溢出、每个模块实际多高、有没有元素被压扁。
 * usage: node audit.mjs [--file index.html] [--warn-slack 12]
 *
 * stdout 出 JSON，人看的诊断信息走 stderr。改动版面后每次都要跑。
 */
import { openPage, takeOpt, mm } from './_env.mjs';

const argv = process.argv.slice(2);
const file = takeOpt(argv, 'file') || 'index.html';
const warnSlack = Number(takeOpt(argv, 'warn-slack') ?? 12);

const { browser, page } = await openPage(file);

const result = await page.evaluate(() => {
  const pg = document.querySelector('.page') || document.body;
  const box = pg.getBoundingClientRect();
  const cs = getComputedStyle(pg);
  const padBottom = parseFloat(cs.paddingBottom) || 0;

  // 内容底边：只看正常流里的直接子元素，跳过绝对定位的背景层
  let bottom = box.top;
  const boxes = [];
  for (const el of pg.children) {
    const s = getComputedStyle(el);
    if (s.position === 'absolute' || s.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 && r.width === 0) continue;
    bottom = Math.max(bottom, r.bottom);
    boxes.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().trim() || el.tagName.toLowerCase(),
      label: (el.querySelector?.('.m-head b')?.textContent || '').trim(),
      h: +(r.height / 3.7795).toFixed(1),
      flex: s.flex,
    });
  }

  // 被压扁的元素：滚动高度大于可视高度 = 内容被 overflow:hidden 切掉了
  const clipped = [];
  for (const el of pg.querySelectorAll('*')) {
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
      if (getComputedStyle(el).overflow === 'visible') continue; // 没裁剪就不算
      clipped.push({
        cls: (el.className || '').toString().trim() || el.tagName.toLowerCase(),
        over: { y: el.scrollHeight - el.clientHeight, x: el.scrollWidth - el.clientWidth },
      });
    }
  }

  return {
    page: { w: +(box.width / 3.7795).toFixed(1), h: +(box.height / 3.7795).toFixed(1) },
    clearanceMm: +((box.height - padBottom - (bottom - box.top)) / 3.7795).toFixed(1),
    scrollOverflow: pg.scrollHeight > pg.clientHeight + 1,
    boxes,
    clipped,
  };
});

const { clearanceMm, scrollOverflow, boxes, clipped } = result;
const notes = [];

if (clearanceMm < 0) {
  notes.push(`溢出 ${Math.abs(clearanceMm)}mm —— 会流到第二页。按 references/pitfalls.md「挤空间的顺序」腾地方。`);
} else if (clearanceMm > warnSlack) {
  notes.push(`底部空了 ${clearanceMm}mm —— 偏空，把某一行的 flex 权重调大，或给某行补内容。`);
} else if (clearanceMm <= 1.5) {
  notes.push('刚好填满（正常）。加任何内容都要先从别处挤。');
}
if (scrollOverflow) notes.push('页面出现滚动条，说明有内容顶出了 .page。');
if (clipped.length) notes.push(`${clipped.length} 个元素被压扁裁掉了内容，见 clipped。`);

Object.assign(result, { notes });
console.log(JSON.stringify(result, null, 2));

for (const b of boxes) {
  console.error(`  ${String(b.h).padStart(6)}mm  flex:${b.flex.padEnd(18)} ${b.label || b.cls}`);
}
for (const n of notes) console.error('! ' + n);

await browser.close();
