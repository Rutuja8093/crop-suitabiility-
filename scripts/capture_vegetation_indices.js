const puppeteer = require('../frontend/node_modules/puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/230edb2f-9e2f-48ec-b0c7-e69000a02546';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

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

  console.log('Navigating directly to /soil-map...');
  await page.goto('http://localhost:3000/soil-map', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 5000));

  const clickMapCentroid = async () => {
    const mapElement = await page.$('.leaflet-container');
    if (mapElement) {
      const box = await mapElement.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2 + 10, box.y + box.height / 2 - 15);
      }
    }
  };

  // 1. NDVI
  console.log('Selecting NDVI...');
  await page.waitForSelector('#select-land_use', { timeout: 10000 });
  await page.select('#select-land_use', 'ndvi');
  await new Promise((r) => setTimeout(r, 2500));
  await clickMapCentroid();
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'ndvi_fixed_classification_output.png'), fullPage: false });
  console.log('Saved NDVI screenshot.');

  // 2. BSI (Bare Soil Index)
  console.log('Selecting BSI...');
  await page.select('#select-land_use', 'bsi');
  await new Promise((r) => setTimeout(r, 2500));
  await clickMapCentroid();
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'bsi_fixed_classification_output.png'), fullPage: false });
  console.log('Saved BSI screenshot.');

  // 3. NDMI (Normalized Difference Moisture Index)
  console.log('Selecting NDMI...');
  await page.select('#select-land_use', 'ndmi');
  await new Promise((r) => setTimeout(r, 2500));
  await clickMapCentroid();
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'ndmi_fixed_classification_output.png'), fullPage: false });
  console.log('Saved NDMI screenshot.');

  // 4. Kharif RGB Composite
  console.log('Selecting Kharif RGB...');
  await page.select('#select-land_use', 'kharif_rgb');
  await new Promise((r) => setTimeout(r, 2500));
  await clickMapCentroid();
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'kharif_rgb_output.png'), fullPage: false });
  console.log('Saved Kharif RGB screenshot.');

  await browser.close();
  console.log('All vegetation index layer screenshots captured successfully!');
})();
