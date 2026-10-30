import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4cea915f-99a0-4098-86a4-754898523d7a';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_live_' + Date.now();

async function main() {
  console.log('Launching headless Chrome with debugging on port 9226...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9226/json/list');
      const list = await res.json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) {}
  }

  if (!target) {
    console.error('Failed to connect to Chrome debugging target');
    try { chrome.kill(); } catch (e) {}
    process.exit(1);
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

  const consoleLogs = [];
  ws.addEventListener('message', (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Console.messageAdded') {
      consoleLogs.push(data.params.message.text);
      console.log('CONSOLE:', data.params.message.text);
    }
  });

  await send('Console.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 1. Navigate to root first to establish localStorage/sessionStorage
  console.log('Navigating to http://localhost:3000/ ...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Seeding authentication session for Gat 124 (Malegaon Khurd)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        localStorage.setItem('soilpilot_selected_gat', '124');
        sessionStorage.setItem('soilpilot_token', 'session_gat_124');
      })()
    `
  });

  // 2. Navigate to Dashboard
  console.log('Navigating to http://localhost:3000/dashboard ...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await new Promise(r => setTimeout(r, 3500));

  // Capture Dashboard Overview
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '01_dashboard_live_overview.png'), Buffer.from(shot.data, 'base64'));
  console.log('Captured 01_dashboard_live_overview.png');

  // 3. Scroll to Gat Farmers section
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('gat-farmers-section');
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '02_dashboard_live_gat124_section.png'), Buffer.from(shot.data, 'base64'));
  console.log('Captured 02_dashboard_live_gat124_section.png');

  // Check section content
  const sectionInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const title = document.querySelector('#gat-farmers-section h3')?.textContent;
        const countBadge = document.querySelector('#gat-farmers-section span.bg-soil-primaryLight')?.textContent;
        const rows = Array.from(document.querySelectorAll('#gat-farmers-section tbody tr')).map(tr => tr.textContent.trim());
        return { title, countBadge, sampleRows: rows.slice(0, 5), totalVisibleRows: rows.length };
      })()
    `,
    returnByValue: true
  });
  console.log('Section Info:', JSON.stringify(sectionInfo.result.value, null, 2));

  // 4. Test Search Filter
  console.log('Filtering by Marathi prefix "देवकाते"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.getElementById('farmer-search-input');
        if (input) {
          input.value = 'देवकाते';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '03_dashboard_live_search_filter.png'), Buffer.from(shot.data, 'base64'));
  console.log('Captured 03_dashboard_live_search_filter.png');

  // 5. Clear search and switch Gat dropdown to Gat 1
  console.log('Switching Gat dropdown to Gat 1...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.getElementById('farmer-search-input');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const select = document.getElementById('gat-switcher-select');
        if (select) {
          select.value = '1';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '04_dashboard_live_switched_gat1.png'), Buffer.from(shot.data, 'base64'));
  console.log('Captured 04_dashboard_live_switched_gat1.png');

  // 6. Switch Gat dropdown to Gat 69 (114 farmers)
  console.log('Switching Gat dropdown to Gat 69...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const select = document.getElementById('gat-switcher-select');
        if (select) {
          select.value = '69';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '05_dashboard_live_switched_gat69.png'), Buffer.from(shot.data, 'base64'));
  console.log('Captured 05_dashboard_live_switched_gat69.png');

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('All screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
