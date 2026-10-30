import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/e38c8e3d-90ab-41a2-afde-eb544a7855b4';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_full_' + Date.now();

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function main() {
  console.log('Launching headless Chrome on port 9235...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9235',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9235/json/list');
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
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Helper to capture a page
  const capture = async (url, filename, waitMs = 3000, evalBefore = null) => {
    console.log(`Navigating to ${url}...`);
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, waitMs));
    if (evalBefore) {
      await send('Runtime.evaluate', { expression: evalBefore });
      await new Promise(r => setTimeout(r, 800));
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  };

  // 1. Visit root and seed session
  console.log('Seeding authentication session for Gat 124...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        localStorage.setItem('soilpilot_selected_gat', '124');
        sessionStorage.setItem('soilpilot_token', 'session_gat_124');
        localStorage.setItem('soilpilot_language', 'en');
      })()
    `
  });

  // 2. Capture Home / Landing Page
  await capture('http://localhost:3000/', '01_soilpilot_home.png', 2000);

  // 3. Capture Dashboard for Gat 124
  await capture('http://localhost:3000/dashboard', '02_soilpilot_dashboard.png', 4000);

  // 4. Capture Gat Farmers Section on Dashboard
  await capture('http://localhost:3000/dashboard', '03_gat124_farmers_section.png', 2000, `
    (() => {
      const el = document.getElementById('gat-farmers-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()
  `);

  // 5. Capture Market Intelligence
  await capture('http://localhost:3000/market-intelligence', '04_market_intelligence.png', 4000);

  // 6. Capture Crop Planner / Decision Engine
  await capture('http://localhost:3000/crop-planner', '05_crop_planner.png', 4000);

  // 7. Capture Planting Calendar
  await capture('http://localhost:3000/planting-calendar', '06_planting_calendar.png', 4000);

  // 8. Capture Field Suitability
  await capture('http://localhost:3000/field-suitability', '07_field_suitability.png', 4000);

  // 9. Capture Soil Health Card
  await capture('http://localhost:3000/soil-health-card', '08_soil_health_card.png', 4000);

  // 10. Capture Soil Map
  await capture('http://localhost:3000/soil-map', '09_soil_map.png', 5000);

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('All SoilPilot application outputs captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
