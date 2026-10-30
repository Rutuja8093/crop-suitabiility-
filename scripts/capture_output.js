const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to soil-map...');
  await page.goto('http://localhost:3000/soil-map', { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait 3 seconds for leaflet map and layers to initialize
  await new Promise((r) => setTimeout(r, 3000));

  // Find and click the 'Silt' layer button in the layer list
  const buttons = await page.$$('button');
  let siltClicked = false;
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.innerText, btn);
    if (text && text.includes('Silt')) {
      console.log('Clicking Silt layer button...');
      await btn.click();
      siltClicked = true;
      break;
    }
  }

  // Wait for layer switch and canvas render
  await new Promise((r) => setTimeout(r, 2500));

  // Click on the map near the parcel centroid to trigger probe
  const mapElement = await page.$('.leaflet-container');
  if (mapElement) {
    const box = await mapElement.boundingBox();
    if (box) {
      console.log('Clicking on map parcel at', box.x + box.width / 2 + 30, box.y + box.height / 2 - 20);
      await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2 - 20);
    }
  }

  await new Promise((r) => setTimeout(r, 1500));

  const screenshotPath = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/37d87979-6004-4792-afcf-d7549bf98e1d/soil_map_output.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to', screenshotPath);

  await browser.close();
})();
