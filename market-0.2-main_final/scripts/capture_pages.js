const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1080 });

  console.log('1. Loading home page...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));

  // Find the button with "Quick Demo"
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text && text.includes('Quick Demo')) {
      console.log('Found Quick Demo button, clicking...');
      await b.click();
      break;
    }
  }

  // Wait for navigation / state update
  await new Promise((r) => setTimeout(r, 3000));
  console.log('Current URL after quick demo click:', page.url());

  // Screenshot whatever page it went to (e.g. /dashboard or /my-farm)
  await page.screenshot({ 
    path: 'C:/Users/Pranav/.gemini/antigravity-ide/brain/496d648e-dc3d-43d6-87b7-c95d8a7424dc/dashboard_output.png', 
    fullPage: false 
  });

  // Now go to /soil-health-card
  console.log('Navigating to /soil-health-card...');
  await page.goto('http://localhost:3000/soil-health-card', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  await page.screenshot({ 
    path: 'C:/Users/Pranav/.gemini/antigravity-ide/brain/496d648e-dc3d-43d6-87b7-c95d8a7424dc/soil_health_card_web_view.png', 
    fullPage: true 
  });
  console.log('soil_health_card_web_view.png captured successfully.');

  await browser.close();
})();
