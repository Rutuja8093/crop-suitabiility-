const puppeteer = require('../frontend/node_modules/puppeteer');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4bf0c8fd-38ae-4128-9be6-bb5e29aea068';

(async () => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  console.log('1. Loading landing page & authenticating demo farmer...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 1000));

  // Find and click the 'Quick Demo' button
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text && text.includes('Quick Demo')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 2500));

  console.log('2. Capturing Dashboard...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, 'dashboard.png'), fullPage: false });

  console.log('3. Capturing My Farm...');
  await page.goto('http://localhost:3000/my-farm', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(OUT_DIR, 'my_farm.png'), fullPage: false });

  console.log('4. Capturing Soil Map...');
  await page.goto('http://localhost:3000/soil-map', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 4000));
  
  // Probe the parcel on map
  const mapElement = await page.$('.leaflet-container');
  if (mapElement) {
    const box = await mapElement.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2 + 20, box.y + box.height / 2 - 10);
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, 'soil_map.png'), fullPage: false });

  console.log('5. Capturing Soil Health Card...');
  await page.goto('http://localhost:3000/soil-health-card', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT_DIR, 'soil_health_card.png'), fullPage: true });

  console.log('All screenshots captured successfully.');
  await browser.close();
})();
