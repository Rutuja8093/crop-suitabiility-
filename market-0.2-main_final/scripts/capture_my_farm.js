const puppeteer = require('../frontend/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1080 });

  console.log('1. Logging in with Quick Demo...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));

  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text && text.includes('Quick Demo')) {
      await b.click();
      break;
    }
  }

  await new Promise((r) => setTimeout(r, 2500));

  console.log('2. Navigating to /my-farm...');
  await page.goto('http://localhost:3000/my-farm', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 4000));

  const dest = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4bf0c8fd-38ae-4128-9be6-bb5e29aea068/my_farm_fixed.png';
  await page.screenshot({ 
    path: dest, 
    fullPage: false 
  });
  console.log('Saved screenshot to:', dest);

  await browser.close();
})();
