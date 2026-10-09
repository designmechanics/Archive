import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT_DIR = path.resolve('docs', 'assets');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Launch headless Chrome with clean user profile so no extensions interfere
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--window-size=1920,1080',
  '--user-data-dir=' + path.join(os.tmpdir(), 'archive_snap_profile'),
  '--no-first-run',
  '--no-default-browser-check',
  'http://127.0.0.1:6080/'
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let nextId = 1;
function sendCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(ws, expression) {
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  return res.result?.value;
}

async function saveScreenshot(ws, filename) {
  const res = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
}

async function run() {
  try {
    await sleep(2500);

    const pages = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
    const target = pages.find((p) => p.type === 'page' && p.url.includes('6080'));
    if (!target) throw new Error('Target page not found');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener('open', resolve));

    await sendCdp(ws, 'Page.enable');
    await sendCdp(ws, 'Runtime.enable');

    console.log('Connected to Chrome DevTools Protocol!');

    // Wait for app to initialize
    await sleep(2000);

    // Check if demo assets button exists or if assets need to be loaded
    const hasDemoButton = await evalJs(ws, `
      (() => {
        const links = Array.from(document.querySelectorAll('button, div, span'));
        const demo = links.find(el => el.innerText && el.innerText.includes('LOAD 54 REFERENCE DEMO ASSETS'));
        if (demo) {
          demo.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Clicked demo load button:', hasDemoButton);

    // Wait for demo assets to load and animate in
    await sleep(3500);

    // 1. Grid View (Dark Mode)
    await saveScreenshot(ws, '01_grid_view_dark.png');

    // 2. Coverflow View
    console.log('Switching to Coverflow...');
    await evalJs(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const coverflowBtn = btns.find(b => b.innerText && b.innerText.trim().toUpperCase() === 'COVERFLOW');
        if (coverflowBtn) coverflowBtn.click();
      })()
    `);
    await sleep(2000);
    await saveScreenshot(ws, '02_coverflow_view.png');

    // 3. Filmstrip View
    console.log('Switching to Filmstrip...');
    await evalJs(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const filmBtn = btns.find(b => b.innerText && b.innerText.trim().toUpperCase() === 'FILM');
        if (filmBtn) filmBtn.click();
      })()
    `);
    await sleep(2000);
    await saveScreenshot(ws, '03_filmstrip_view.png');

    // 4. List View (Table with sticky header & badges)
    console.log('Switching to List View...');
    await evalJs(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const listBtn = btns.find(b => b.innerText && b.innerText.trim().toUpperCase() === 'LIST');
        if (listBtn) listBtn.click();
      })()
    `);
    await sleep(2000);
    await saveScreenshot(ws, '04_list_view.png');

    // 5. Open Universal Preview (Docked 56vw)
    console.log('Opening Preview Drawer (Docked 56vw)...');
    await evalJs(ws, `
      (() => {
        const rows = document.querySelectorAll('[data-row]');
        if (rows.length > 2) {
          rows[2].click();
        } else if (rows.length > 0) {
          rows[0].click();
        }
      })()
    `);
    await sleep(2000);
    await saveScreenshot(ws, '05_preview_docked.png');

    // 6. Expand to Studio Mode (88vw)
    console.log('Expanding to Studio Mode (88vw)...');
    await evalJs(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const studioBtn = btns.find(b => b.innerText && b.innerText.includes('88vw'));
        if (studioBtn) studioBtn.click();
      })()
    `);
    await sleep(2000);
    await saveScreenshot(ws, '06_studio_mode_88vw.png');

    // Close preview drawer with Escape key
    console.log('Closing preview drawer...');
    await evalJs(ws, `
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      })()
    `);
    await sleep(1500);

    // 7. Grid View in Light Theme
    console.log('Switching to Light Theme & Grid...');
    await evalJs(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const lightBtn = btns.find(b => b.innerText && b.innerText.trim().toUpperCase() === 'LIGHT');
        if (lightBtn) lightBtn.click();
        const gridBtn = btns.find(b => b.innerText && b.innerText.trim().toUpperCase() === 'GRID');
        if (gridBtn) gridBtn.click();
      })()
    `);
    await sleep(2500);
    await saveScreenshot(ws, '07_grid_view_light.png');

    // 8. Settings Modal
    console.log('Opening Settings & Database Modal...');
    await evalJs(ws, `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const settingsBtn = btns.find(b => b.innerText && b.innerText.includes('SETTINGS'));
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await sleep(2000);
    await saveScreenshot(ws, '08_settings_modal.png');

    // Reset back to Dark mode and close modal
    await evalJs(ws, `
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        const btns = Array.from(document.querySelectorAll('button'));
        const darkBtn = btns.find(b => b.innerText && b.innerText.trim().toUpperCase() === 'DARK');
        if (darkBtn) darkBtn.click();
      })()
    `);
    await sleep(1500);

    console.log('All screenshots captured successfully!');
    ws.close();
    chrome.kill();
  } catch (err) {
    console.error('Error during capture:', err);
    chrome.kill();
  }
}

run();
