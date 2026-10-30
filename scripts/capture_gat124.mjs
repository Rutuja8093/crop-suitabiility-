import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4cea915f-99a0-4098-86a4-754898523d7a';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_gat124_' + Date.now();

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9229/json/list');
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

  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: "document.getElementById('quick-demo-btn')?.click();"
  });
  await new Promise(r => setTimeout(r, 2500));

  // Directly set localStorage to Gat 124 and reload
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        localStorage.setItem('soilpilot_selected_gat', '124');
        window.location.href = 'http://localhost:3000/dashboard';
      })()
    `
  });
  await new Promise(r => setTimeout(r, 3000));

  // Scroll to Gat Farmers section
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('gat-farmers-section');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '07_dashboard_live_gat124_full.png'), Buffer.from(shot.data, 'base64'));

  // Now search for "देवकाते" in the search box
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
  await new Promise(r => setTimeout(r, 1000));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '08_dashboard_live_gat124_search_devkate.png'), Buffer.from(shot.data, 'base64'));

  ws.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
}

main().catch(console.error);
