const puppeteer = require('../frontend/node_modules/puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4bf0c8fd-38ae-4128-9be6-bb5e29aea068';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

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

  console.log('Navigating to /soil-health-card...');
  await page.goto('http://localhost:3000/soil-health-card?gat=22', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 3000));

  const screenshotPath = path.join(ARTIFACT_DIR, 'soil_health_card_single_tab.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to', screenshotPath);

  await browser.close();
})();
