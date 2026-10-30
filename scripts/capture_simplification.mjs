import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/43aa7402-a162-40e0-8e83-08a0a8bbd690';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_simp_' + Date.now();

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function main() {
  console.log('Launching headless Chrome on port 9240...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9240',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9240/json/list');
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
    width: 1366,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const capture = async (filename, waitMs = 2500) => {
    await new Promise(r => setTimeout(r, waitMs));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  };

  const evalCode = async (expr) => {
    return await send('Runtime.evaluate', { expression: expr });
  };

  // 1. Navigate to market-intelligence
  console.log('Navigating to http://localhost:3000/market-intelligence...');
  await send('Page.navigate', { url: 'http://localhost:3000/market-intelligence' });
  await capture('simp_01_find_crops_section_a.png', 4000);

  // 2. Click Button 2: Today's Crop Prices
  console.log('Clicking "Today\'s Crop Prices"...');
  await evalCode(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes("Today's Crop Prices") || b.textContent.includes("आजचे बाजार भाव"));
      if (btn) btn.click();
    })()
  `);
  await capture('simp_02_todays_crop_prices_section_b.png', 3000);

  // 3. Click Button 3: Plan My Planting (Option 1: Next 15 Days)
  console.log('Clicking "Plan My Planting"...');
  await evalCode(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes("Plan My Planting") || b.textContent.includes("पेरणीचे नियोजन करा"));
      if (btn) btn.click();
    })()
  `);
  await capture('simp_03_plan_planting_next15.png', 3000);

  // 4. Click Option 2: Seasonal Planning inside Section C
  console.log('Clicking "Option 2: Seasonal Planning"...');
  await evalCode(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes("Seasonal Planning") || b.textContent.includes("हंगामी नियोजन"));
      if (btn) btn.click();
    })()
  `);
  await capture('simp_04_plan_planting_seasonal.png', 3000);

  // 5. Test Mobile Layout
  console.log('Setting Mobile Viewport...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  // Go back to Button 1: Find Crops for My Farm
  await evalCode(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes("Find Crops for My Farm") || b.textContent.includes("माझ्या शेतासाठी पिके शोधा"));
      if (btn) btn.click();
    })()
  `);
  await capture('simp_05_mobile_find_crops.png', 2500);

  ws.close();
  try { chrome.kill(); } catch (e) {}
  console.log('All verification screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
