import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4cea915f-99a0-4098-86a4-754898523d7a';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_auth_' + Date.now();

async function main() {
  console.log('Launching headless Chrome on port 9228...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9228/json/list');
      const list = await res.json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) {}
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('1. Navigating to http://localhost:3000/ ...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Clicking quick-demo-btn ...');
  await send('Runtime.evaluate', {
    expression: "document.getElementById('quick-demo-btn')?.click();"
  });

  console.log('Waiting for login & routing to /dashboard...');
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const urlEval = await send('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true
    });
    console.log(`[${i+1}s] URL:`, urlEval.result.value);
    if (urlEval.result.value.includes('/dashboard')) break;
  }

  // Allow extra time for map & API queries to settle
  await new Promise(r => setTimeout(r, 3500));

  // 1. Capture Dashboard Overview
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '01_dashboard_live_overview.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 01_dashboard_live_overview.png');

  // 2. Scroll to Gat Farmers section
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('gat-farmers-section');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '02_dashboard_live_gat22.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 02_dashboard_live_gat22.png');

  // 3. Switch to Gat 124 (140 Marathi farmers) by opening switcher dropdown and selecting 124
  console.log('Switching to Gat 124...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Open Gat switcher dropdown button
        const switcherBtn = document.querySelector('#gat-farmers-section button[title="Switch Gat Number"]');
        if (switcherBtn) switcherBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Type 124 in the search input inside dropdown
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('#gat-farmers-section input[placeholder*="Gat"]');
        if (input) {
          input.value = '124';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Click Gat 124 button
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('#gat-farmers-section div[class*="overflow-y-auto"] button'));
        const target = btns.find(b => b.textContent && b.textContent.includes('124'));
        if (target) target.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '03_dashboard_live_gat124.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 03_dashboard_live_gat124.png');

  // 4. Test live search filter on Gat 124 (filter by "देवकाते")
  console.log('Filtering Gat 124 by "देवकाते"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const searchInput = document.getElementById('farmer-search-input');
        if (searchInput) {
          searchInput.value = 'देवकाते';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '04_dashboard_live_search_devkate.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 04_dashboard_live_search_devkate.png');

  // 5. Clear search and switch to Gat 1 (24 farmers)
  console.log('Switching to Gat 1...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const searchInput = document.getElementById('farmer-search-input');
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const switcherBtn = document.querySelector('#gat-farmers-section button[title="Switch Gat Number"]');
        if (switcherBtn) switcherBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('#gat-farmers-section input[placeholder*="Gat"]');
        if (input) {
          input.value = '1';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('#gat-farmers-section div[class*="overflow-y-auto"] button'));
        const target = btns.find(b => {
          const text = b.textContent ? b.textContent.trim() : '';
          return text.includes('Gat 1') || text.includes('गट 1') || text.startsWith('1');
        });
        if (target) target.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '05_dashboard_live_gat1.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 05_dashboard_live_gat1.png');

  // 6. Switch to Marathi language
  console.log('Switching to Marathi locale...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('header button, header a, button'));
        const mrBtn = btns.find(b => b.textContent && b.textContent.includes('मराठी'));
        if (mrBtn) mrBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '06_dashboard_live_marathi.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 06_dashboard_live_marathi.png');

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('All gallery screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
