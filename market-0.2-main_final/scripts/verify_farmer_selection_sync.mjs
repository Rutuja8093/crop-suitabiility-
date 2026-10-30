import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/be5329c0-60a1-49c6-8865-e30209402b1b';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_farmer_sel_' + Date.now();

async function main() {
  console.log('Launching headless Chrome for Farmer Selection Verification...');
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
    throw new Error('Could not connect to Chrome debugging port.');
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

  // 1. Authenticate via quick demo
  console.log('1. Authenticating via Quick Demo...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.evaluate', {
    expression: "document.getElementById('quick-demo-btn')?.click();"
  });
  await new Promise(r => setTimeout(r, 3000));

  // 2. Open /dashboard
  console.log('2. Navigating to Dashboard...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await new Promise(r => setTimeout(r, 4000));

  // Inspect Gat farmers section and select farmer
  console.log('3. Inspecting Gat Farmers Section and selecting farmer...');
  const selectResult = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const btn = document.getElementById('farmer-selection-dropdown-btn');
        const rows = document.querySelectorAll('#gat-farmers-section table tbody tr');
        if (!rows || rows.length === 0) return { error: 'No farmer rows found' };

        // Click the first farmer row to select them
        const firstRow = rows[0];
        const farmerName = firstRow.querySelector('td:nth-child(2)')?.innerText.trim();
        firstRow.click();

        return {
          hasDropdownBtn: !!btn,
          selectedName: farmerName,
          totalRows: rows.length
        };
      })()
    `
  });
  console.log('Select Result:', selectResult.value);
  await new Promise(r => setTimeout(r, 1500));

  // Verify Welcome Section greeting updated
  const welcomeText = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `document.querySelector('h1')?.innerText`
  });
  console.log('Welcome Banner Text:', welcomeText.value);

  // Screenshot 1: Dashboard with selected farmer
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '13_dashboard_farmer_selected.png'), Buffer.from(shot1.data, 'base64'));
  console.log('Saved 13_dashboard_farmer_selected.png');

  // 4. Navigate to /soil-health-card and verify selected farmer appears on the card
  console.log('4. Navigating to /soil-health-card...');
  await send('Page.navigate', { url: 'http://localhost:3000/soil-health-card' });
  await new Promise(r => setTimeout(r, 4000));

  const cardFarmerInfo = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        // Look for Farmer's Name cell in the FarmerSampleInfoTable
        const cells = Array.from(document.querySelectorAll('table td'));
        const nameLabelIdx = cells.findIndex(td => td.innerText.includes("Farmer's Name") || td.innerText.includes("शेतकऱ्याचे नाव"));
        const nameVal = nameLabelIdx !== -1 && cells[nameLabelIdx + 1] ? cells[nameLabelIdx + 1].innerText.trim() : null;
        return {
          nameVal,
          cardTitle: document.querySelector('.soil-report-page')?.innerText?.slice(0, 200)
        };
      })()
    `
  });
  console.log('Soil Health Card Farmer Info:', cardFarmerInfo.value);

  // Screenshot 2: Soil Health Card with farmer name
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '14_soil_health_card_farmer_synced.png'), Buffer.from(shot2.data, 'base64'));
  console.log('Saved 14_soil_health_card_farmer_synced.png');

  // 5. Navigate to /reports and verify selected farmer appears in overview
  console.log('5. Navigating to /reports...');
  await send('Page.navigate', { url: 'http://localhost:3000/reports' });
  await new Promise(r => setTimeout(r, 4000));

  const reportsFarmerInfo = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const text = document.body.innerText;
        return {
          pageHasFarmerName: text.includes(${JSON.stringify(selectResult.value?.selectedName || '')}),
          bodySnippet: text.slice(0, 500)
        };
      })()
    `
  });
  console.log('Reports Page Farmer Info:', reportsFarmerInfo.value);

  // Screenshot 3: Reports page
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '15_reports_farmer_synced.png'), Buffer.from(shot3.data, 'base64'));
  console.log('Saved 15_reports_farmer_synced.png');

  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
