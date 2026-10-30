import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/e5e03027-9fa1-4dd7-ae17-0a1f61b03455';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_temp';

async function main() {
  console.log('Launching headless Chrome with debugging port 9222...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  // Wait for port 9222 to be available
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
    console.error('Failed to connect to Chrome debugging target');
    try { chrome.kill(); } catch (e) {}
    process.exit(1);
  }

  console.log('Connected to target:', target.webSocketDebuggerUrl);
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
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Helper to capture a page
  const capture = async (url, filename, waitMs = 2500, setupFn = null) => {
    console.log(`Navigating to ${url}...`);
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, waitMs));
    if (setupFn) {
      await setupFn(send);
      await new Promise(r => setTimeout(r, 1000));
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  };

  // 1. Landing Page
  await capture('http://localhost:3000/', '01_landing_page.png', 2000);

  // Authenticate demo farmer by clicking Quick Demo
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const demoBtn = btns.find(b => b.textContent && b.textContent.includes('Quick Demo'));
        if (demoBtn) demoBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // 2. Farmer Dashboard
  await capture('http://localhost:3000/dashboard', '02_dashboard.png', 2500);

  // 3. Soil Texture Calculator (Default & Interactive)
  await capture('http://localhost:3000/soil-texture', '03_soil_texture_triangle.png', 3000);

  // 4. Soil Texture with Gat #22 query
  await capture('http://localhost:3000/soil-texture?gat=22', '04_soil_texture_gat22.png', 3000);

  // 5. Soil Health Card
  await capture('http://localhost:3000/soil-health-card?gat=22', '05_soil_health_card.png', 3000);

  // 6. Soil Map / DSM
  await capture('http://localhost:3000/soil-map', '06_soil_map.png', 4000);

  // 7. My Farm
  await capture('http://localhost:3000/my-farm', '07_my_farm.png', 3500);

  // 8. Recommendations
  await capture('http://localhost:3000/recommendations', '08_recommendations.png', 2500);

  // 9. Reports
  await capture('http://localhost:3000/reports', '09_reports.png', 3000);

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('Gallery generation complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error during gallery generation:', err);
  process.exit(1);
});
