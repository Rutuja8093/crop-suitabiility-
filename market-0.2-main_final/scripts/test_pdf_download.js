const puppeteer = require('../frontend/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('response', res => {
    if (res.url().includes('/api/') || res.url().includes('report') || res.url().includes('pdf')) {
      console.log('HTTP RESPONSE:', res.status(), res.url());
    }
  });

  console.log('Navigating to home page for session setup...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 2000));

  console.log('Selecting Gat 22 in #access-gat...');
  await page.waitForSelector('#access-gat', { timeout: 10000 });
  await page.select('#access-gat', '22');
  await new Promise((r) => setTimeout(r, 800));

  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  }
  await new Promise((r) => setTimeout(r, 3000));

  console.log('Navigating to /soil-health-card?gat=22...');
  await page.goto('http://localhost:3000/soil-health-card?gat=22', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Find the download buttons
  const buttons = await page.$$('button');
  let downloadCardBtn = null;
  let downloadDetailedBtn = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text && text.includes('Download Soil Health Card')) {
      downloadCardBtn = btn;
    }
    if (text && text.includes('Download Detailed Report')) {
      downloadDetailedBtn = btn;
    }
  }

  if (downloadCardBtn) {
    console.log('Clicking Download Soil Health Card button...');
    await downloadCardBtn.click();
    await new Promise((r) => setTimeout(r, 4000));
  }

  if (downloadDetailedBtn) {
    console.log('Clicking Download Detailed Report button...');
    await downloadDetailedBtn.click();
    await new Promise((r) => setTimeout(r, 4000));
  }

  await browser.close();
  console.log('Finished test.');
})();
