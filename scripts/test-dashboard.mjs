/**
 * Test dashboard page
 */

import puppeteer from 'puppeteer'

async function main() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  page.on('console', msg => console.log('Browser:', msg.text()))

  console.log('Navigating to dashboard page...')
  await page.goto('https://app.travelautorental.com/mrst/dashboard', {
    waitUntil: 'networkidle0',
    timeout: 30000
  })

  // Wait for content to load
  await page.waitForSelector('body', { timeout: 10000 })
  await new Promise(r => setTimeout(r, 3000)) // Wait for data to load

  // Take screenshot
  await page.screenshot({ path: '/tmp/dashboard-test.png', fullPage: true })
  console.log('Screenshot saved to /tmp/dashboard-test.png')

  // Get page content
  const pageContent = await page.evaluate(() => document.body.innerText)

  // Check for key elements
  if (pageContent.includes('Dashboard')) {
    console.log('Dashboard title found!')
  }
  if (pageContent.includes('Fleet Vehicles')) {
    console.log('Fleet Vehicles card found!')
  }
  if (pageContent.includes('Active Rentals')) {
    console.log('Active Rentals card found!')
  }
  if (pageContent.includes('Integration Status')) {
    console.log('Integration Status section found!')
  }
  if (pageContent.includes('Fleet Overview')) {
    console.log('Fleet Overview section found!')
  }

  await browser.close()
  console.log('Test complete!')
}

main().catch(console.error)
