import puppeteer from 'puppeteer';

async function diagnose() {
  console.log('Starting Puppeteer diagnostic...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console logs and errors
  const logs = [];
  const errors = [];
  const networkErrors = [];

  page.on('console', msg => {
    logs.push('[' + msg.type() + '] ' + msg.text());
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  page.on('requestfailed', request => {
    networkErrors.push(request.method() + ' ' + request.url() + ' - ' + request.failure().errorText);
  });

  // Log API requests and responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/trpc/')) {
      console.log('   API Response:', response.status(), url);
      try {
        const text = await response.text();
        console.log('   Response body:', text.substring(0, 300));
      } catch (e) {}
    }
  });

  try {
    // 1. Go to login page
    console.log('\n1. Loading login page...');
    await page.goto('https://app.travelautorental.com/mrst/login', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('   Page loaded, URL:', page.url());

    // Check for login form
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"]');

    console.log('   Email input found:', !!emailInput);
    console.log('   Password input found:', !!passwordInput);
    console.log('   Submit button found:', !!submitButton);

    if (!emailInput || !passwordInput || !submitButton) {
      console.log('\n   Page content (first 500 chars):');
      const content = await page.content();
      console.log(content.substring(0, 500));
      throw new Error('Login form elements not found');
    }

    // Check existing values
    const existingEmail = await page.evaluate(() => document.querySelector('input[type="email"]').value);
    const existingPassword = await page.evaluate(() => document.querySelector('input[type="password"]').value);
    console.log('   Existing email value:', existingEmail);
    console.log('   Existing password value:', existingPassword);

    // 2. Just use existing values (they're pre-filled)
    console.log('\n2. Using pre-filled credentials...');

    // 3. Click login and wait for navigation
    console.log('\n3. Clicking login button...');

    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(e => {
      console.log('   Navigation timeout or no navigation occurred');
      return null;
    });

    await page.click('button[type="submit"]');
    await navigationPromise;

    // Wait a bit more for any redirects
    await new Promise(r => setTimeout(r, 3000));

    console.log('   Current URL:', page.url());

    // 4. Check localStorage for token
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    console.log('   Auth token stored:', token ? 'Yes (length: ' + token.length + ')' : 'No');

    // 5. Check page content
    const pageTitle = await page.title();
    console.log('   Page title:', pageTitle);

    // Check if we're on dashboard
    if (page.url().includes('dashboard')) {
      console.log('\n4. On dashboard, checking for data loading...');
      await new Promise(r => setTimeout(r, 5000)); // Wait for data to load

      // Check for loading state
      const loadingText = await page.evaluate(() => document.body.innerText.includes('Loading'));
      console.log('   Still showing "Loading":', loadingText);

      // Get visible text
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800));
      console.log('   Page text:\n', bodyText);
    } else {
      console.log('\n4. Not on dashboard. Current page content:');
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800));
      console.log(bodyText);
    }

    // Print collected logs
    if (logs.length > 0) {
      console.log('\n=== Console Logs ===');
      logs.forEach(log => console.log(log));
    }

    if (errors.length > 0) {
      console.log('\n=== Page Errors ===');
      errors.forEach(err => console.log(err));
    }

    if (networkErrors.length > 0) {
      console.log('\n=== Network Errors ===');
      networkErrors.forEach(err => console.log(err));
    }

  } catch (error) {
    console.error('Error:', error.message);

    // Take screenshot on error
    await page.screenshot({ path: '/tmp/error-screenshot.png' });
    console.log('Screenshot saved to /tmp/error-screenshot.png');

    console.log('\n=== Collected Logs ===');
    logs.forEach(log => console.log(log));

    if (errors.length > 0) {
      console.log('\n=== Page Errors ===');
      errors.forEach(err => console.log(err));
    }

    if (networkErrors.length > 0) {
      console.log('\n=== Network Errors ===');
      networkErrors.forEach(err => console.log(err));
    }
  }

  await browser.close();
  console.log('\nDiagnostic complete.');
}

diagnose().catch(console.error);
