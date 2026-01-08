/**
 * Test timeline page with Spireon events
 */

import puppeteer from 'puppeteer'

async function main() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()

  // Enable console logging
  page.on('console', msg => console.log('Browser:', msg.text()))
  page.on('pageerror', err => console.error('Page error:', err.message))

  console.log('Navigating to timeline page...')
  await page.goto('https://app.travelautorental.com/mrst/timeline', {
    waitUntil: 'networkidle0',
    timeout: 30000
  })

  // Wait for content to load
  await page.waitForSelector('body', { timeout: 10000 })

  // Take screenshot
  await page.screenshot({ path: '/tmp/timeline-test.png', fullPage: true })
  console.log('Screenshot saved to /tmp/timeline-test.png')

  // Get page title
  const title = await page.title()
  console.log('Page title:', title)

  // Check for timeline content
  const pageContent = await page.evaluate(() => document.body.innerText)

  // Check for Spireon events
  if (pageContent.includes('Spireon') || pageContent.includes('GPS') || pageContent.includes('stopped')) {
    console.log('Spireon events found on timeline page!')
  } else {
    console.log('Spireon events not visible (might need to filter or scroll)')
  }

  // Check for error messages
  if (pageContent.includes('error') || pageContent.includes('Error')) {
    console.log('Warning: Error message found on page')
  }

  // Get timeline stats from the page
  const stats = await page.evaluate(() => {
    const text = document.body.innerText
    const matches = text.match(/(\d+[\d,]*)\s*events?/gi)
    return matches ? matches.slice(0, 5) : []
  })
  console.log('Timeline stats:', stats)

  // Check for source filters
  const sources = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
    return buttons.map(b => b.innerText).filter(t =>
      t.includes('Spireon') || t.includes('Gmail') || t.includes('Monday') || t.includes('HQ')
    ).slice(0, 10)
  })
  console.log('Source filters found:', sources)

  await browser.close()
  console.log('Test complete!')
}

main().catch(console.error)
