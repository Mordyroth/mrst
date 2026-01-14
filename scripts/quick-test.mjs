#!/usr/bin/env node
import puppeteer from 'puppeteer'

async function test() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  
  // Test production
  console.log('Testing production...')
  await page.goto('https://app.travelautorental.com/mrst/dashboard', { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise(r => setTimeout(r, 3000))
  
  // Get sidebar info
  const info = await page.evaluate(() => {
    const sidebar = document.querySelector('aside')
    const sidebarStyles = sidebar ? window.getComputedStyle(sidebar) : {}
    return {
      sidebarWidth: sidebar?.getBoundingClientRect()?.width,
      sidebarDisplay: sidebarStyles.display,
      sidebarPosition: sidebarStyles.position,
      classList: sidebar?.className,
    }
  })
  console.log('Sidebar info:', JSON.stringify(info, null, 2))
  
  // Check for vehicles
  await page.goto('https://app.travelautorental.com/mrst/vehicles', { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise(r => setTimeout(r, 5000))
  
  const vehicleInfo = await page.evaluate(() => {
    return {
      hasAtShop: document.body.textContent.includes('At Shop'),
      cardCount: document.querySelectorAll('a[href*="/vehicles/"]').length,
      pageText: document.body.textContent.substring(0, 800),
    }
  })
  console.log('Vehicles page:', JSON.stringify(vehicleInfo, null, 2))
  
  await page.screenshot({ path: '/tmp/mrst-prod-vehicles.png', fullPage: true })
  console.log('Screenshot saved to /tmp/mrst-prod-vehicles.png')
  
  await browser.close()
}

test().catch(console.error)
