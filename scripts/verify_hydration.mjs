import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_soil_temp';

async function main() {
  console.log('Launching Chrome on 9222...');
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
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Console.enable');
  await send('Runtime.enable');

  const errors = [];
  ws.addEventListener('message', (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      const type = data.params.type;
      const text = data.params.args.map(a => a.value || a.description || '').join(' ');
      if (type === 'error') {
        errors.push(text);
      }
    }
  });

  // Navigate to home and ensure localStorage has Gat 22
  console.log('Setting localStorage soilpilot_selected_gat = 22...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));
  await send('Runtime.evaluate', {
    expression: "localStorage.setItem('soilpilot_selected_gat', '22');"
  });

  // Navigate to soil-texture
  console.log('Navigating to http://localhost:3000/soil-texture...');
  await send('Page.navigate', { url: 'http://localhost:3000/soil-texture' });
  await new Promise(r => setTimeout(r, 3500));

  console.log('Checking for Next.js error overlay...');
  const overlayCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const nextError = document.querySelector('nextjs-portal');
        const errorNodes = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && el.textContent.includes('Unhandled Runtime Error')
        );
        return {
          hasPortal: !!nextError,
          errorNodesCount: errorNodes.length,
          errorsText: errorNodes.map(e => e.textContent.substring(0, 100))
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Overlay check result:', JSON.stringify(overlayCheck.result.value, null, 2));

  // Capture clean screenshot
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/e5e03027-9fa1-4dd7-ae17-0a1f61b03455/soil_texture_resolved.png';
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log('Saved clean screenshot to:', outPath);

  ws.close();
  try { chrome.kill(); } catch (e) {}

  const hydrationErrors = errors.filter(e => e.includes('hydration') || e.includes('Hydration') || e.includes('does not match server-rendered'));
  if (hydrationErrors.length > 0) {
    console.error('Hydration errors still found:', hydrationErrors);
    process.exit(1);
  } else {
    console.log('SUCCESS: Zero hydration errors detected!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
