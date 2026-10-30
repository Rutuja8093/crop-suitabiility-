const puppeteer = require('../frontend/node_modules/puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4bf0c8fd-38ae-4128-9be6-bb5e29aea068';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });

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
  await new Promise((r) => setTimeout(r, 4000));

  // Select LULC
  console.log('Selecting LULC layer...');
  const selectElem = await page.$('#select-land_use');
  if (selectElem) {
    await page.select('#select-land_use', 'lulc');
  }

  await new Promise((r) => setTimeout(r, 3000));

  // Click on the map near parcel centroid to trigger probe
  const mapElement = await page.$('.leaflet-container');
  if (mapElement) {
    const box = await mapElement.boundingBox();
    if (box) {
      console.log('Clicking on map parcel at center...');
      await page.mouse.click(box.x + box.width / 2 + 10, box.y + box.height / 2 - 15);
    }
  }

  await new Promise((r) => setTimeout(r, 2500));

  // Capture full page view
  const fullScreenshotPath = path.join(ARTIFACT_DIR, 'soil_map_lulc_full_view.png');
  await page.screenshot({ path: fullScreenshotPath, fullPage: false });
  console.log('Full screenshot saved to', fullScreenshotPath);

  // Also capture specifically the map element
  if (mapElement) {
    const mapScreenshotPath = path.join(ARTIFACT_DIR, 'soil_map_lulc_infobox_focused.png');
    await mapElement.screenshot({ path: mapScreenshotPath });
    console.log('Map screenshot saved to', mapScreenshotPath);
  }

  await browser.close();
})();
