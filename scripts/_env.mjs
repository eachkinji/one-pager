/**
 * 共享环境解析：Playwright 与 Chrome 的位置。
 * usage: import { loadChromium, launch } from './_env.mjs'
 *
 * 本机没有全局安装 Playwright，所以按下面的顺序找，全都找不到就报清楚怎么装。
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PROBE = [
  path.join('.playwright', 'node_modules', 'playwright', 'index.mjs'),
  path.join('node_modules', 'playwright', 'index.mjs'),
];

/** 同级目录里找共享安装。工作目录常是"父目录/多个项目"，Playwright 只装在其中一个项目里。
 *  只看 cwd 及其父目录的兄弟，且父目录条目太多就跳过——避免去扫用户目录。 */
function siblingCandidates(cwd) {
  const out = [];
  const home = os.homedir();
  let dir = cwd;
  for (let depth = 0; depth < 2; depth++) {
    const parent = path.dirname(dir);
    if (parent === dir || parent === home || path.dirname(parent) === parent) break;
    let entries = [];
    try { entries = readdirSync(parent, { withFileTypes: true }); } catch { break; }
    if (entries.length > 40) { dir = parent; continue; } // 条目太多，这层不值得扫
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const base = path.join(parent, e.name);
      if (base === dir || base === cwd) continue;
      for (const p of PROBE) out.push(path.join(base, p));
    }
    dir = parent;
  }
  return out;
}

/** 依次尝试：环境变量 → skill 自带 → 调用方项目 → 逐级向上 → 同级项目 → 全局 */
export async function loadChromium() {
  const cands = [];
  if (process.env.PLAYWRIGHT_PATH) cands.push(process.env.PLAYWRIGHT_PATH);

  cands.push(...PROBE.map((p) => path.join(SKILL_ROOT, p)));

  const cwd = process.cwd();
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    cands.push(...PROBE.map((p) => path.join(dir, p)));
    const up = path.dirname(dir);
    if (up === dir) break;
  }

  cands.push(...siblingCandidates(cwd));

  for (const c of cands) {
    if (existsSync(c)) {
      const mod = await import(pathToFileURL(c).href);
      if (mod.chromium) return mod.chromium;
    }
  }

  try {
    return require('playwright').chromium;
  } catch { /* 继续报错 */ }

  console.error([
    'Playwright not found. 试过这些位置：',
    ...cands.slice(0, 12).map((c) => '  - ' + c),
    cands.length > 12 ? `  …还有 ${cands.length - 12} 处` : '',
    '',
    '装一个（装到当前项目里最省事）：',
    '  npm i playwright && npx playwright install chromium',
    '或指定已有安装：',
    '  PLAYWRIGHT_PATH=/绝对路径/node_modules/playwright/index.mjs node audit.mjs',
  ].filter(Boolean).join('\n'));
  process.exit(2);
}

/** 环境变量 → Playwright 自带 → 系统安装的 Chrome/Edge。找不到就返回 undefined，交给 Playwright 决定 */
export function chromePath(chromium) {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch { /* 没有下载浏览器，继续 */ }

  const guesses = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[process.platform] || [];

  const local = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe');
  for (const g of [...guesses, local]) if (existsSync(g)) return g;

  return undefined;
}

/** 打开一个页面，等字体加载完。返回 { browser, page, close } */
export async function openPage(file, { width = 900, height = 1300, scale = 2 } = {}) {
  const chromium = await loadChromium();
  const exe = chromePath(chromium);
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForTimeout(400); // 等 WebGL/动效/图片解码落定
  return { browser, page };
}

/** 解析 `--flag value` 形式的可选参数 */
export function takeOpt(argv, name) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return undefined;
  return argv.splice(i, 2)[1];
}

export const mm = (px) => +(px / 3.7795).toFixed(1); // 96dpi 下 1mm ≈ 3.7795px
