
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.join(__dirname, '../photo/docs');
const APP_API_BASE = process.env.CAPTURE_APP_API_BASE || 'http://127.0.0.1:8787/lzapi';
const CAPTURE_PRINTER_NAME = process.env.CAPTURE_PRINTER_NAME || 'KP3S PRO';
const CAPTURE_MOONRAKER_URL = process.env.CAPTURE_MOONRAKER_URL || 'http://172.30.1.83:7125';
const CAPTURE_WEBCAM_URL = process.env.CAPTURE_WEBCAM_URL || 'http://172.30.1.72/capture_flash';
const CAPTURE_WEBCAM_URL2 = process.env.CAPTURE_WEBCAM_URL2 || 'http://172.30.1.93/capture_flash';

const SCENARIOS = [
    { name: 'home', path: '/', waitMs: 9000 },
    {
        name: 'printer',
        path: '/printer',
        preAction: async (page) => {
            const inlineOpen = page.getByRole('button', { name: '이 페이지 안에서 열기' });
            if (await inlineOpen.count()) {
                await inlineOpen.first().click();
                await page.waitForSelector('iframe', { timeout: 15000 });
            }
        },
        postActionWaitMs: 9000
    },
    { name: 'webcam', path: '/webcam' },
    { name: 'chatbot', path: '/chatbot' },
    { name: 'maintenance', path: '/maintenance' },
    { name: 'tools', path: '/tools' },
    { name: 'reports', path: '/reports' },
    { name: 'settings', path: '/settings' },
];

const MODEL_TABS = [
    { id: 'models', label: '도안 사이트', name: 'models-models' },
    { id: 'slicers', label: '웹 슬라이서', name: 'models-slicers' },
    { id: 'generators', label: '생성기', name: 'models-generators' },
    { id: 'calibration', label: '칼리브레이션', name: 'models-calibration' },
    { id: 'resources', label: '검색 & 리소스', name: 'models-resources' },
];

async function capture(page, name, mode) {
    const filename = `${name}-${mode}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Captured: ${filename}`);
}

async function seedServerSettings(theme) {
    const response = await fetch(`${APP_API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            printerName: CAPTURE_PRINTER_NAME,
            klipperIp: CAPTURE_MOONRAKER_URL,
            webcamUrl: CAPTURE_WEBCAM_URL,
            webcamUrl2: CAPTURE_WEBCAM_URL2,
            uiTheme: theme
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to seed settings: ${response.status}`);
    }
}

async function applyLocalSettings(page, theme) {
    await page.addInitScript(({ nextTheme, printerName, moonrakerUrl, webcamUrl, webcamUrl2 }) => {
        window.localStorage.setItem('layer-zero-theme', nextTheme);
        window.localStorage.setItem('printer-name', printerName);
        window.localStorage.setItem('klipper-ip', moonrakerUrl);
        window.localStorage.setItem('webcam-url', webcamUrl);
        window.localStorage.setItem('webcam-url-2', webcamUrl2);
    }, {
        nextTheme: theme,
        printerName: CAPTURE_PRINTER_NAME,
        moonrakerUrl: CAPTURE_MOONRAKER_URL,
        webcamUrl: CAPTURE_WEBCAM_URL,
        webcamUrl2: CAPTURE_WEBCAM_URL2
    });
}

async function run() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }, // Desktop
        deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    console.log('Starting capture...');

    // Capture Light Mode
    console.log('--- Capturing Light Mode ---');
    await seedServerSettings('light');
    await applyLocalSettings(page, 'light');
    for (const scenario of SCENARIOS) {
        await page.goto(`${BASE_URL}${scenario.path}`);
        await page.waitForTimeout(scenario.waitMs ?? 1500); // Wait for animations/loading
        if (scenario.preAction) await scenario.preAction(page);
        if (scenario.postActionWaitMs) await page.waitForTimeout(scenario.postActionWaitMs);
        await capture(page, scenario.name, 'light');
    }

    // Capture Models sub-tabs (Light)
    await page.goto(`${BASE_URL}/models`);
    await page.waitForTimeout(1000);
    for (const tab of MODEL_TABS) {
        // Find button by text
        await page.click(`button:has-text("${tab.label}")`);
        await page.waitForTimeout(500);
        await capture(page, tab.name, 'light');
    }

    // Capture Dark Mode
    console.log('--- Capturing Dark Mode ---');
    await seedServerSettings('dark');
    await applyLocalSettings(page, 'dark');
    for (const scenario of SCENARIOS) {
        await page.goto(`${BASE_URL}${scenario.path}`);
        await page.waitForTimeout(scenario.waitMs ?? 1500);
        if (scenario.preAction) await scenario.preAction(page);
        if (scenario.postActionWaitMs) await page.waitForTimeout(scenario.postActionWaitMs);
        await capture(page, scenario.name, 'dark');
    }

    // Capture Models sub-tabs (Dark)
    await page.goto(`${BASE_URL}/models`);
    await page.waitForTimeout(1000);
    for (const tab of MODEL_TABS) {
        await page.click(`button:has-text("${tab.label}")`);
        await page.waitForTimeout(500);
        await capture(page, tab.name, 'dark');
    }

    await browser.close();
    console.log('Done!');
}

run().catch(console.error);
