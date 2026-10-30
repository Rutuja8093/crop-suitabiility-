import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/1f3dcc65-0422-4297-83fe-b5ed548c4936';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_leg_zoom_' + Date.now();

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9258',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9258/json/list');
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
    height: 980,
    deviceScaleFactor: 2,
    mobile: false
  });

  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1200));
  await send('Runtime.evaluate', {
    expression: "document.getElementById('quick-demo-btn')?.click();"
  });
  await new Promise(r => setTimeout(r, 2000));

  await send('Page.navigate', { url: 'http://localhost:3000/soil-map?gat=124' });
  await new Promise(r => setTimeout(r, 4500));

  // Get bounding rect of #map-legend-box
  const rectRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('map-legend-box');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()
    `,
    returnByValue: true
  });

  const rect = rectRes.result.value;
  console.log('Legend rect:', rect);

  if (rect) {
    const clipShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: rect.x - 10,
        y: rect.y - 10,
        width: rect.width + 20,
        height: rect.height + 20,
        scale: 1
      }
    });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'legend_box_updated.png'), Buffer.from(clipShot.data, 'base64'));
  }

  // Also capture full view
  const fullShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '02_soil_map_updated.png'), Buffer.from(fullShot.data, 'base64'));

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('Captured cleanly!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
