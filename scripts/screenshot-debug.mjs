#!/usr/bin/env node
import puppeteer from 'puppeteer'
import fs from 'fs'

const BASE_URL = 'https://app.travelautorental.com/mrst'

async function takeScreenshots() {
  console.log('Taking debug screenshots...')
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  const page = await browser.newPage()
  
  // Desktop Dashboard
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '/tmp/mrst-dashboard-desktop.png', fullPage: true })
  console.log('Saved: /tmp/mrst-dashboard-desktop.png')
  
  // Get sidebar info
  const sidebarInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('aside')
    const main = document.querySelector('main')
    const body = document.body
    return {
      sidebarStyle: sidebar ? window.getComputedStyle(sidebar) : null,
      sidebarWidth: sidebar?.getBoundingClientRect()?.width,
      sidebarDisplay: sidebar ? window.getComputedStyle(sidebar).display : null,
      sidebarPosition: sidebar ? window.getComputedStyle(sidebar).position : null,
      mainWidth: main?.getBoundingClientRect()?.width,
      bodyWidth: body?.getBoundingClientRect()?.width,
      hasFlexLayout: sidebar?.parentElement?.classList?.toString(),
    }
  })
  console.log('Sidebar debug info:', JSON.stringify(sidebarInfo, null, 2))
  
  // Desktop Vehicles
  await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '/tmp/mrst-vehicles-desktop.png', fullPage: true })
  console.log('Saved: /tmp/mrst-vehicles-desktop.png')
  
  // Check for "At Shop" content
  const pageContent = await page.evaluate(() => {
    return {
      hasAtShop: document.body.textContent.includes('At Shop'),
      cardCount: document.querySelectorAll('[class*="Card"]').length,
      linkCount: document.querySelectorAll('a[href*="/vehicles/"]').length,
      bodyText: document.body.textContent.substring(0, 500),
    }
  })
  console.log('Vehicles page debug:', JSON.stringify(pageContent, null, 2))
  
  // Desktop Customers
  await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '/tmp/mrst-customers-desktop.png', fullPage: true })
  console.log('Saved: /tmp/mrst-customers-desktop.png')
  
  // Vehicle Detail test
  await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  const vehicleLinks = await page.$$eval('a[href*="/vehicles/"]', links => links.map(l => l.href))
  console.log('Vehicle links found:', vehicleLinks.slice(0, 5))
  
  if (vehicleLinks.length > 0) {
    await page.goto(vehicleLinks[0], { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise(r => setTimeout(r, 3000))
    await page.screenshot({ path: '/tmp/mrst-vehicle-detail.png', fullPage: true })
    console.log('Saved: /tmp/mrst-vehicle-detail.png')
    
    const detailContent = await page.evaluate(() => ({
      title: document.querySelector('h1')?.textContent,
      hasBackButton: !!document.querySelector('a[href*="/vehicles"]'),
      hasError: document.body.textContent.includes('not found') || document.body.textContent.includes('Failed'),
      url: window.location.href,
    }))
    console.log('Vehicle detail debug:', JSON.stringify(detailContent, null, 2))
  }
  
  // Mobile Dashboard
  await page.setViewport({ width: 375, height: 667 })
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '/tmp/mrst-dashboard-mobile.png', fullPage: true })
  console.log('Saved: /tmp/mrst-dashboard-mobile.png')
  
  const mobileInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('aside')
    return {
      sidebarVisible: sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false,
      sidebarWidth: sidebar?.getBoundingClientRect()?.width,
      viewportWidth: window.innerWidth,
    }
  })
  console.log('Mobile sidebar info:', JSON.stringify(mobileInfo, null, 2))
  
  await browser.close()
  console.log('\nAll screenshots saved to /tmp/')
}

takeScreenshots().catch(console.error)
