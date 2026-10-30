import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_temp_' + Date.now();
const OUT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4cea915f-99a0-4098-86a4-754898523d7a';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function main() {
  // 1. Obtain verified session token for Gat 124
  const loginRes = await fetch('http://127.0.0.1:8000/api/v1/auth/gat-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state_id: 1,
      district_id: 1,
      taluka_id: 6,
      village_id: 87,
      gat_no: '124'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Obtained token for Gat 124:', token ? token.substring(0, 30) + '...' : 'none');

  console.log('Launching headless Chrome...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const list = await res.json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) {}
  }

  if (!target) {
    console.error('No page target found on 9222');
    try { chrome.kill(); } catch (e) {}
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

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
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Network.enable');
  await send('Page.enable');
  await send('Runtime.enable');

  // Set auth cookie
  await send('Network.setCookie', {
    name: 'soilpilot_session',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: false
  });

  // Navigate to root to set session storage and local storage
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1000));

  await send('Runtime.evaluate', {
    expression: `
      sessionStorage.setItem('soilpilot_token', '${token}');
      localStorage.setItem('soilpilot_selected_gat', '124');
    `
  });

  // Navigate to Dashboard
  console.log('Navigating to http://localhost:3000/dashboard ...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await new Promise(r => setTimeout(r, 3500));

  // Capture full page screenshot of Gat 124 dashboard
  console.log('Capturing dashboard screenshot for Gat 124 (140 farmers)...');
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const out1 = path.join(OUT_DIR, 'dashboard_gat124.png');
  fs.writeFileSync(out1, Buffer.from(shot1.data, 'base64'));
  console.log('Saved:', out1);

  // Type in search box
  console.log('Testing live search filter for "देवकाते"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.getElementById('farmer-search-input');
        if (input) {
          input.focus();
          input.value = 'देवकाते';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const shotSearch = await send('Page.captureScreenshot', { format: 'png' });
  const outSearch = path.join(OUT_DIR, 'dashboard_search_filter.png');
  fs.writeFileSync(outSearch, Buffer.from(shotSearch.data, 'base64'));
  console.log('Saved:', outSearch);

  // Clear search and switch to Gat 1
  console.log('Testing Gat switcher: switching to Gat 1 (24 farmers)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.getElementById('farmer-search-input');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        localStorage.setItem('soilpilot_selected_gat', '1');
        window.dispatchEvent(new Event('soilpilot_gat_changed'));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const shotGat1 = await send('Page.captureScreenshot', { format: 'png' });
  const outGat1 = path.join(OUT_DIR, 'dashboard_gat1.png');
  fs.writeFileSync(outGat1, Buffer.from(shotGat1.data, 'base64'));
  console.log('Saved:', outGat1);

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('All screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
