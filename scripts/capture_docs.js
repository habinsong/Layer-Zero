
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5174';
const OUTPUT_DIR = path.join(__dirname, '../photo/docs');

const SCENARIOS = [
    { name: 'home', path: '/' },
    { name: 'printer', path: '/printer' },
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

    // Ensure Light Mode first
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    // Check theme
    let theme = await page.getAttribute('html', 'data-theme');
    console.log(`Initial theme: ${theme}`);

    if (theme === 'dark') {
        console.log('Switching to Light mode...');
        await page.goto(`${BASE_URL}/settings`);
        await page.waitForTimeout(500);
        await page.click('button:has-text("전환")');
        await page.waitForTimeout(500);
        theme = await page.getAttribute('html', 'data-theme');
        console.log(`Switched to: ${theme}`);
    }

    // Capture Light Mode
    console.log('--- Capturing Light Mode ---');
    for (const scenario of SCENARIOS) {
        await page.goto(`${BASE_URL}${scenario.path}`);
        await page.waitForTimeout(1500); // Wait for animations/loading
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

    // Switch to Dark Mode
    console.log('Switching to Dark mode...');
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForTimeout(500);
    await page.click('button:has-text("전환")');
    await page.waitForTimeout(500);
    theme = await page.getAttribute('html', 'data-theme');
    console.log(`Switched to: ${theme}`);

    // Capture Dark Mode
    console.log('--- Capturing Dark Mode ---');
    for (const scenario of SCENARIOS) {
        await page.goto(`${BASE_URL}${scenario.path}`);
        await page.waitForTimeout(1500);
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
