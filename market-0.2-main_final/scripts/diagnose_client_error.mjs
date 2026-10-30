import { spawn } from 'child_process';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = 'C:/Users/Pranav/AppData/Local/Temp/chrome_diag_' + Date.now();

async function main() {
  const loginRes = await fetch('http://127.0.0.1:8000/api/v1/auth/gat-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state_id: 1, district_id: 1, taluka_id: 6, village_id: 87, gat_no: '124' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9223/json/list');
      const list = await res.json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) {}
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

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

  await send('Console.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  ws.addEventListener('message', (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.exceptionThrown') {
      console.log('\n--- EXCEPTION THROWN ---');
      console.log(data.params.exceptionDetails);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const type = data.params.type;
      const text = data.params.args.map(a => a.value || a.description || '').join(' ');
      if (type === 'error') {
        console.log('\n--- CONSOLE ERROR ---');
        console.log(text);
      }
    }
  });

  await send('Network.setCookie', {
    name: 'soilpilot_session',
    value: token,
    domain: 'localhost',
    path: '/'
  });

  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.evaluate', {
    expression: `
      sessionStorage.setItem('soilpilot_token', '${token}');
      localStorage.setItem('soilpilot_selected_gat', '124');
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await new Promise(r => setTimeout(r, 4000));

  ws.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
}

main().catch(console.error);
