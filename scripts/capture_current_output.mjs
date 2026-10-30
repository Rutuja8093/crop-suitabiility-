import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/1f3dcc65-0422-4297-83fe-b5ed548c4936';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_out_' + Date.now();

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function main() {
  console.log('Logging into backend API for Gat 124...');
  let token = 'mock_token_124';
  try {
    const res = await fetch('http://127.0.0.1:8000/api/v1/auth/gat-login', {
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
    const data = await res.json();
    if (data.token) {
      token = data.token;
      console.log('Obtained real token:', token.substring(0, 25) + '...');
    }
  } catch (err) {
    console.warn('Backend login warning:', err.message);
  }

  console.log('Launching headless Chrome on port 9245...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9245',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9245/json/list');
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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 980,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Network.enable');
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Network.setCookie', {
    name: 'soilpilot_session',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: false
  });

  // Navigate to root to set localStorage / sessionStorage
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1200));

  await send('Runtime.evaluate', {
    expression: `
      sessionStorage.setItem('soilpilot_token', '${token}');
      localStorage.setItem('soilpilot_selected_gat', '124');
    `
  });

  // 1. Dashboard
  console.log('Capturing Dashboard (Gat 124)...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard?gat=124' });
  await new Promise(r => setTimeout(r, 4500));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '01_dashboard.png'), Buffer.from(shot.data, 'base64'));

  // 2. Soil Map Viewer
  console.log('Capturing Soil Map Viewer...');
  await send('Page.navigate', { url: 'http://localhost:3000/soil-map?gat=124' });
  await new Promise(r => setTimeout(r, 5500));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '02_soil_map.png'), Buffer.from(shot.data, 'base64'));

  // 3. Soil Health Card Web Page
  console.log('Capturing Soil Health Card...');
  await send('Page.navigate', { url: 'http://localhost:3000/soil-health-card?gat=124' });
  await new Promise(r => setTimeout(r, 4500));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '03_soil_health_card.png'), Buffer.from(shot.data, 'base64'));

  // 4. Soil Texture Calculator
  console.log('Capturing Soil Texture Calculator...');
  await send('Page.navigate', { url: 'http://localhost:3000/soil-texture-calculator?gat=124' });
  await new Promise(r => setTimeout(r, 4000));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '04_soil_texture_calculator.png'), Buffer.from(shot.data, 'base64'));

  // 5. Reports & Downloads
  console.log('Capturing Reports...');
  await send('Page.navigate', { url: 'http://localhost:3000/reports?gat=124' });
  await new Promise(r => setTimeout(r, 4000));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '05_reports.png'), Buffer.from(shot.data, 'base64'));

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('All screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
