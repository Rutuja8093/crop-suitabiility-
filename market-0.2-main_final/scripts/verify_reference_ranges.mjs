import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/be5329c0-60a1-49c6-8865-e30209402b1b';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_ref_range_' + Date.now();

async function main() {
  console.log('Launching headless Chrome...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9232/json/list');
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
    height: 1200,
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

  // Navigate to /soil-health-card
  console.log('Opening /soil-health-card...');
  await send('Page.navigate', { url: 'http://localhost:3000/soil-health-card' });
  await new Promise(r => setTimeout(r, 3500));

  // Scroll to Soil Parameter Table
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const table = document.querySelector('table');
        if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  // Capture screenshot of table in English
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '11_reference_ranges_english_verified.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 11_reference_ranges_english_verified.png');

  // Verify visible reference ranges in English
  const visibleRanges = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
          return {
            sr: cells[0],
            name: cells[1],
            val: cells[2],
            unit: cells[3],
            interp: cells[4],
            refRange: cells[5]
          };
        });
        return rows.slice(0, 7);
      })()
    `,
    returnByValue: true
  });
  console.log('Visible Ranges in English:', JSON.stringify(visibleRanges.result.value, null, 2));

  // Switch to Marathi
  console.log('Switching to Marathi...');
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
  fs.writeFileSync(path.join(ARTIFACT_DIR, '12_reference_ranges_marathi_verified.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 12_reference_ranges_marathi_verified.png');

  const visibleRangesMr = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
          return {
            sr: cells[0],
            name: cells[1],
            val: cells[2],
            unit: cells[3],
            interp: cells[4],
            refRange: cells[5]
          };
        });
        return rows.slice(0, 7);
      })()
    `,
    returnByValue: true
  });
  console.log('Visible Ranges in Marathi:', JSON.stringify(visibleRangesMr.result.value, null, 2));

  ws.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
}

main().catch(console.error);
