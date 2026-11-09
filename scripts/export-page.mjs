#!/usr/bin/env node
/**
 * 导出网页版：高分辨率 PNG（预览）+ 矢量 PDF（打印）。
 * usage: node export-page.mjs [--file index.html] [--out 输出] [--name 一页纸] [--scale 2]
 *
 * 注意：本脚本会写 <name>.png / <name>.pdf。如果同时还有 Word 版导出的 PDF，
 * 一定要**最后**跑这个，否则矢量 PDF 会被 Word 版转出来的顶掉。
 *
 * stdout 出 JSON（含各产物路径，正斜杠）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { openPage, takeOpt } from './_env.mjs';

const argv = process.argv.slice(2);
const file = takeOpt(argv, 'file') || 'index.html';
const outDir = takeOpt(argv, 'out') || '输出';
const scale = Number(takeOpt(argv, 'scale') ?? 2);

const absFile = path.resolve(file);
if (!await fs.access(absFile).then(() => true, () => false)) {
  console.error(`找不到 ${absFile}`);
  process.exit(2);
}

const { browser, page } = await openPage(absFile, { scale });

let name = takeOpt(argv, 'name');
if (!name) {
  name = (await page.title()).replace(/[\\/:*?"<>|]/g, '_').trim() || '一页纸';
}

await fs.mkdir(path.resolve(outDir), { recursive: true });
const pngPath = path.resolve(outDir, `${name}.png`);
const pdfPath = path.resolve(outDir, `${name}.pdf`);

if (!await page.locator('.page').count()) {
  console.error('这页 HTML 里没有 .page 容器，导出仍会继续，但截图会退化成整页。');
}

await page.locator('.page').screenshot({ path: pngPath });

// 另开一个页面出 PDF，避免截图留下的滚动位置影响分页
const { page: pdfPage, browser: b2 } = await openPage(absFile, { scale: 1 });
await pdfPage.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,                                  // 不设这个色块和背景全丢
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  preferCSSPageSize: true,                                // 用 CSS 里的 @page{size:A4}
});
await b2.close();
await browser.close();

const size = async (p) => (await fs.stat(p)).size;
console.log(JSON.stringify({
  png: pngPath.replace(/\\/g, '/'),
  pngKB: +(await size(pngPath) / 1024).toFixed(1),
  pdf: pdfPath.replace(/\\/g, '/'),
  pdfKB: +(await size(pdfPath) / 1024).toFixed(1),
}, null, 2));
