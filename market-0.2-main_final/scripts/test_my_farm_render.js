const puppeteer = require('../frontend/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  // 1. Go to page and set auth in localStorage/sessionStorage
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('soilpilot_selected_gat', '22');
    sessionStorage.setItem('soilpilot_token', 'session_gat_22');
  });

  // 2. Navigate directly to /my-farm?gat=22
  console.log('Navigating to /my-farm?gat=22...');
  await page.goto('http://localhost:3000/my-farm?gat=22', { waitUntil: 'networkidle2', timeout: 35000 });
  
  // Wait for map and layers to render
  await new Promise((r) => setTimeout(r, 4000));

  const dest = 'C:/Users/Pranav/.gemini/antigravity-ide/brain/4bf0c8fd-38ae-4128-9be6-bb5e29aea068/my_farm_fixed.png';
  await page.screenshot({ path: dest, fullPage: false });
  console.log('Saved screenshot to:', dest);

  await browser.close();
})();
