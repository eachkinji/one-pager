#!/usr/bin/env node
/**
 * 截取页面上任意元素，可先注入一段 CSS。
 * usage: node shot.mjs <css选择器> <输出.png> [--file index.html] [--scale 4]
 *        [--css "CSS文本"] [--css-file 额外.css] [--white]
 *
 * 典型用途：把页面里的图表/表格单独截图，嵌进 Word 版。
 * 嵌 Word 前一定要用 --css 把字号放大（见 references/docx-mirror.md 5.4），
 * 否则等比缩到 2~3in 宽时标注会糊到看不清。
 *
 * --white 会加一套"白底、去边框、隐藏背景层"的样式，产出可直接放进文档。
 *
 * stdout 出 JSON。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { openPage, takeOpt } from './_env.mjs';

const argv = process.argv.slice(2);
const selector = argv.shift();
const outArg = argv.shift();
const file = takeOpt(argv, 'file') || 'index.html';
const scale = Number(takeOpt(argv, 'scale') ?? 4);
const css = takeOpt(argv, 'css');
const cssFile = takeOpt(argv, 'css-file');
const white = argv.includes('--white');

if (!selector || !outArg) {
  console.error('usage: node shot.mjs <selector> <out.png> [--file index.html] [--scale 4] [--css "..."] [--css-file x.css] [--white]');
  process.exit(2);
}

const { browser, page } = await openPage(path.resolve(file), { scale });

if (!await page.locator(selector).count()) {
  await browser.close();
  console.error(`选择器没匹配到元素：${selector}`);
  process.exit(1);
}

let injected = '';
if (white) {
  injected += `
    .page{background:#ffffff !important;box-shadow:none !important}
    .mod{border-color:#ffffff !important;background:#ffffff !important}
    .bg{display:none !important}
  `;
}
if (cssFile) injected += await fs.readFile(cssFile, 'utf8');
if (css) injected += css;

if (injected.trim()) {
  await page.addStyleTag({ content: injected });
  await page.waitForTimeout(200); // 等重排落定
}

const out = path.resolve(outArg);
await fs.mkdir(path.dirname(out), { recursive: true });
await page.locator(selector).screenshot({ path: out });
const st = await fs.stat(out);
await browser.close();

console.log(JSON.stringify({
  path: out.replace(/\\/g, '/'),
  KB: +(st.size / 1024).toFixed(1),
  selector,
  white,
}, null, 2));
