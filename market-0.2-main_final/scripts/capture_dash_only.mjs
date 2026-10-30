import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/1f3dcc65-0422-4297-83fe-b5ed548c4936';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_dash_' + Date.now();

async function main() {
  console.log('Launching Chrome on port 9249...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9249',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9249/json/list');
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

  console.log('Navigating to root...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clicking Quick Demo button...');
  await send('Runtime.evaluate', {
    expression: "document.getElementById('quick-demo-btn')?.click();"
  });
  await new Promise(r => setTimeout(r, 3500));

  console.log('Capturing Dashboard after demo login...');
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '01_dashboard.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 01_dashboard.png successfully!');

  ws.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
