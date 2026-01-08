/**
 * Test map page
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

  console.log('Navigating to map page...')
  await page.goto('https://app.travelautorental.com/mrst/map', {
    waitUntil: 'networkidle0',
    timeout: 30000
  })

  // Wait for content to load
  await page.waitForSelector('body', { timeout: 10000 })
  await new Promise(r => setTimeout(r, 2000)) // Wait for data to load

  // Take screenshot
  await page.screenshot({ path: '/tmp/map-test.png', fullPage: true })
  console.log('Screenshot saved to /tmp/map-test.png')

  // Get page content
  const pageContent = await page.evaluate(() => document.body.innerText)

  // Check for key elements
  if (pageContent.includes('Fleet Map')) {
    console.log('Fleet Map title found!')
  }
  if (pageContent.includes('Total Vehicles')) {
    console.log('Stats cards found!')
  }
  if (pageContent.includes('vehicles with GPS data')) {
    console.log('Vehicle count found!')
  }

  await browser.close()
  console.log('Test complete!')
}

main().catch(console.error)
