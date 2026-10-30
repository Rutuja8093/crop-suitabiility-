import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/be5329c0-60a1-49c6-8865-e30209402b1b';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_verify_en_' + Date.now();

async function main() {
  console.log('Launching headless Chrome on port 9230...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9230',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9230/json/list');
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

  // Authenticate via quick demo
  console.log('Authenticating...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));
  await send('Runtime.evaluate', {
    expression: "document.getElementById('quick-demo-btn')?.click();"
  });
  await new Promise(r => setTimeout(r, 2500));

  // Navigate to /dashboard
  console.log('Opening /dashboard...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await new Promise(r => setTimeout(r, 3000));

  // 1. Ensure English locale is active (default is EN)
  // Switch to Gat 17 (the exact Gat from the user's screenshot)
  console.log('Switching to Gat 17...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
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
          input.value = '17';
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
        const target = btns.find(b => b.textContent && b.textContent.includes('17'));
        if (target) target.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Scroll to section
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('gat-farmers-section');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Capture Gat 17 in English
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '09_gat17_english_fixed.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 09_gat17_english_fixed.png');

  // Log visible names in table to verify
  const englishNames = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const rows = Array.from(document.querySelectorAll('#gat-farmers-section tbody tr')).map(tr => tr.textContent.trim().replace(/\\s+/g, ' '));
        return rows.slice(0, 8);
      })()
    `,
    returnByValue: true
  });
  console.log('English Names on Screen:', JSON.stringify(englishNames.result.value, null, 2));

  // 2. Switch to Marathi to show that Marathi toggle still displays authentic Marathi
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
  fs.writeFileSync(path.join(ARTIFACT_DIR, '10_gat17_marathi_verified.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 10_gat17_marathi_verified.png');

  const marathiNames = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const rows = Array.from(document.querySelectorAll('#gat-farmers-section tbody tr')).map(tr => tr.textContent.trim().replace(/\\s+/g, ' '));
        return rows.slice(0, 8);
      })()
    `,
    returnByValue: true
  });
  console.log('Marathi Names on Screen:', JSON.stringify(marathiNames.result.value, null, 2));

  ws.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
}

main().catch(console.error);
