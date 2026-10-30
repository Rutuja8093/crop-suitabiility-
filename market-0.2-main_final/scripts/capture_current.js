const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1080 });

  console.log('Navigating to home page...');
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

  await new Promise((r) => setTimeout(r, 3000));

  console.log('Navigating to /my-farm...');
  await page.goto('http://localhost:3000/my-farm', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 4000));

  await page.screenshot({ 
    path: 'C:/Users/Pranav/.gemini/antigravity-ide/brain/230edb2f-9e2f-48ec-b0c7-e69000a02546/my_farm_live.png', 
    fullPage: false 
  });
  console.log('my_farm_live.png captured.');

  console.log('Navigating to /soil-health-card...');
  await page.goto('http://localhost:3000/soil-health-card', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  await page.screenshot({ 
    path: 'C:/Users/Pranav/.gemini/antigravity-ide/brain/230edb2f-9e2f-48ec-b0c7-e69000a02546/soil_health_card_live.png', 
    fullPage: true 
  });
  console.log('soil_health_card_live.png captured.');

  await browser.close();
})();
