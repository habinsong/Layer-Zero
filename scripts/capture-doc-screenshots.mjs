import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';

const baseUrl = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:5173';
const outDir = path.resolve('photo', 'docs');
fs.mkdirSync(outDir, { recursive: true });

async function captureDesktop(page, route, file, options = {}) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body', { timeout: 30000 });
  if (options.preAction) await options.preAction(page);
  await page.waitForTimeout(options.waitMs ?? 1800);
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
}

async function captureMobile(browser, route, file, options = {}) {
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body', { timeout: 30000 });
  if (options.preAction) await options.preAction(page);
  await page.waitForTimeout(options.waitMs ?? 1800);
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1720, height: 1080 } });
const page = await context.newPage();

const desktopShots = [
  { route: '/', file: 'home-desktop.png' },
  { route: '/printer', file: 'printer-desktop.png' },
  { route: '/webcam', file: 'webcam-desktop.png' },
  { route: '/chatbot', file: 'chatbot-desktop.png' },
  { route: '/maintenance', file: 'maintenance-desktop.png' },
  { route: '/tools', file: 'tools-desktop.png' },
  { route: '/reports', file: 'reports-desktop.png' },
  { route: '/settings', file: 'settings-desktop.png' },
  { route: '/models', file: 'models-models-desktop.png' },
  {
    route: '/models',
    file: 'models-slicers-desktop.png',
    preAction: async (p) => { await p.getByRole('button', { name: '웹 슬라이서' }).click(); }
  },
  {
    route: '/models',
    file: 'models-generators-desktop.png',
    preAction: async (p) => { await p.getByRole('button', { name: '생성기' }).click(); }
  },
  {
    route: '/models',
    file: 'models-calibration-desktop.png',
    preAction: async (p) => { await p.getByRole('button', { name: '칼리브레이션' }).click(); }
  },
  {
    route: '/models',
    file: 'models-resources-desktop.png',
    preAction: async (p) => { await p.getByRole('button', { name: '검색 & 리소스' }).click(); }
  }
];

for (const shot of desktopShots) {
  // eslint-disable-next-line no-console
  console.log(`[capture] desktop ${shot.file}`);
  await captureDesktop(page, shot.route, shot.file, shot);
}

const mobileShots = [
  { route: '/', file: 'home-mobile.png' },
  { route: '/webcam', file: 'webcam-mobile.png' },
  { route: '/chatbot', file: 'chatbot-mobile.png' },
  { route: '/maintenance', file: 'maintenance-mobile.png' },
  { route: '/settings', file: 'settings-mobile.png' }
];

for (const shot of mobileShots) {
  // eslint-disable-next-line no-console
  console.log(`[capture] mobile ${shot.file}`);
  await captureMobile(browser, shot.route, shot.file, shot);
}

await context.close();
await browser.close();

// eslint-disable-next-line no-console
console.log(`done: ${outDir}`);
