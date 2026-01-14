#!/usr/bin/env node
import puppeteer from 'puppeteer'

const BASE_URL = 'https://app.travelautorental.com/mrst'
const results = { passed: [], failed: [], skipped: [], timing: {} }
const startTime = Date.now()

async function testPage(browser, name, url, checks) {
  const testStart = Date.now()
  const page = await browser.newPage()
  
  try {
    // Test at desktop viewport
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000)) // Wait for data
    
    const result = await checks(page, 'desktop')
    results.timing[name + '_desktop'] = Date.now() - testStart
    
    if (result.passed) {
      results.passed.push({ name: name + ' (desktop)', ...result })
    } else {
      results.failed.push({ name: name + ' (desktop)', ...result })
    }
    
    // Test at mobile viewport
    const mobileStart = Date.now()
    await page.setViewport({ width: 375, height: 667 })
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))
    
    const mobileResult = await checks(page, 'mobile')
    results.timing[name + '_mobile'] = Date.now() - mobileStart
    
    if (mobileResult.passed) {
      results.passed.push({ name: name + ' (mobile)', ...mobileResult })
    } else {
      results.failed.push({ name: name + ' (mobile)', ...mobileResult })
    }
    
  } catch (error) {
    results.failed.push({ name, error: error.message })
  } finally {
    await page.close()
  }
}

async function runTests() {
  console.log('Starting comprehensive MRST frontend tests...')
  console.log('URL:', BASE_URL)
  console.log('')
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  try {
    // 1. Dashboard Tests
    await testPage(browser, 'Dashboard', `${BASE_URL}/dashboard`, async (page, viewport) => {
      const checks = []
      
      // Check if sidebar is visible on desktop
      if (viewport === 'desktop') {
        const sidebar = await page.$('aside')
        checks.push({ name: 'Sidebar visible', passed: !!sidebar })
      } else {
        // Check for mobile header and bottom nav
        const header = await page.$('header.lg\\:hidden, header')
        const bottomNav = await page.$('nav.lg\\:hidden, nav')
        checks.push({ name: 'Mobile header', passed: !!header })
        checks.push({ name: 'Mobile bottom nav', passed: !!bottomNav })
      }
      
      // Check for main content elements
      const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
      checks.push({ name: 'Dashboard title', passed: title === 'Dashboard' })
      
      // Check for stats cards
      const cards = await page.$$('[class*="CardContent"], .rounded-lg.border')
      checks.push({ name: 'Stats cards present', passed: cards.length >= 4 })
      
      // Check for integration status section
      const integrationSection = await page.$eval('body', body => 
        body.textContent.includes('Integration Status')
      ).catch(() => false)
      checks.push({ name: 'Integration status section', passed: integrationSection })
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
    // 2. Vehicles Page Tests
    await testPage(browser, 'Vehicles', `${BASE_URL}/vehicles`, async (page, viewport) => {
      const checks = []
      
      // Check title
      const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
      checks.push({ name: 'Vehicles title', passed: title === 'Vehicles' })
      
      // Check for vehicle cards
      await new Promise(r => setTimeout(r, 3000)) // Extra wait for API
      const cards = await page.$$('[class*="CardContent"]')
      checks.push({ name: 'Vehicle cards loaded', passed: cards.length > 0, count: cards.length })
      
      // Check for "At Shop" text or badge anywhere on page
      const atShopText = await page.$eval('body', body => 
        body.textContent.includes('At Shop') || body.textContent.includes('at shop')
      ).catch(() => false)
      checks.push({ name: 'At Shop badge/text present', passed: atShopText })
      
      // Check for search input
      const searchInput = await page.$('input[placeholder*="Search"]')
      checks.push({ name: 'Search input present', passed: !!searchInput })
      
      // Check for filter dropdown
      const filterBtn = await page.$('button:has-text("Filter"), [class*="Filter"]')
      checks.push({ name: 'Filter button present', passed: !!filterBtn })
      
      // Check for stats cards at top
      const statsSection = await page.$eval('body', body => 
        body.textContent.includes('Total Fleet') || body.textContent.includes('Available')
      ).catch(() => false)
      checks.push({ name: 'Stats section present', passed: statsSection })
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
    // 3. Vehicle Detail Page Tests
    await testPage(browser, 'Vehicle Detail', `${BASE_URL}/vehicles`, async (page, viewport) => {
      const checks = []
      
      // First find and click a vehicle card
      await new Promise(r => setTimeout(r, 3000))
      const cardLink = await page.$('a[href*="/vehicles/"]')
      
      if (!cardLink) {
        checks.push({ name: 'Vehicle card link found', passed: false })
        return { passed: false, checks }
      }
      checks.push({ name: 'Vehicle card link found', passed: true })
      
      // Click and navigate
      await cardLink.click()
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {})
      await new Promise(r => setTimeout(r, 2000))
      
      // Check for vehicle info sections
      const hasVehicleInfo = await page.$eval('body', body => 
        body.textContent.includes('Vehicle Information') || 
        body.textContent.includes('GPS Location') ||
        body.textContent.includes('Back to Vehicles')
      ).catch(() => false)
      checks.push({ name: 'Vehicle detail content', passed: hasVehicleInfo })
      
      // Check for error state
      const hasError = await page.$eval('body', body => 
        body.textContent.includes('not found') || body.textContent.includes('Failed to load')
      ).catch(() => false)
      checks.push({ name: 'No error state', passed: !hasError })
      
      // Check for back button
      const backBtn = await page.$('a[href*="/vehicles"]:has-text("Back"), button:has-text("Back")')
      checks.push({ name: 'Back button present', passed: !!backBtn })
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
    // 4. Customers Page Tests
    await testPage(browser, 'Customers', `${BASE_URL}/customers`, async (page, viewport) => {
      const checks = []
      
      // Check title
      const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
      checks.push({ name: 'Customers title', passed: title === 'Customers' })
      
      // Check for customer count
      const hasCount = await page.$eval('body', body => 
        body.textContent.includes('customers from HQ') || body.textContent.includes('2,')
      ).catch(() => false)
      checks.push({ name: 'Customer count shown', passed: hasCount })
      
      // Check for search input
      const searchInput = await page.$('input[placeholder*="Search"]')
      checks.push({ name: 'Search input present', passed: !!searchInput })
      
      // Check if showing placeholder or actual data
      const showingData = await page.$eval('body', body => 
        !body.textContent.includes('coming soon')
      ).catch(() => false)
      checks.push({ name: 'Shows actual data (not placeholder)', passed: showingData })
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
    // 5. Timeline Page Tests
    await testPage(browser, 'Timeline', `${BASE_URL}/timeline`, async (page, viewport) => {
      const checks = []
      
      // Check title
      const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
      checks.push({ name: 'Timeline title', passed: title === 'Timeline' || title?.includes('Timeline') })
      
      // Check for filter pills
      const hasFilters = await page.$eval('body', body => 
        body.textContent.includes('Monday') || body.textContent.includes('Gmail') || body.textContent.includes('HQ')
      ).catch(() => false)
      checks.push({ name: 'Source filter pills', passed: hasFilters })
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
    // 6. Fleet Map Page Tests
    await testPage(browser, 'Fleet Map', `${BASE_URL}/map`, async (page, viewport) => {
      const checks = []
      
      // Check title
      const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
      checks.push({ name: 'Map title', passed: title?.includes('Fleet') || title?.includes('Map') })
      
      // Check for map iframe or map container
      const hasMap = await page.$('iframe, [class*="map"], .leaflet-container')
      checks.push({ name: 'Map element present', passed: !!hasMap })
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
    // 7. Layout & Responsiveness Test
    await testPage(browser, 'Layout Check', `${BASE_URL}/dashboard`, async (page, viewport) => {
      const checks = []
      
      if (viewport === 'desktop') {
        // Check desktop sidebar width
        const sidebar = await page.$('aside')
        if (sidebar) {
          const sidebarBox = await sidebar.boundingBox()
          const hasCorrectWidth = sidebarBox && (sidebarBox.width >= 60 && sidebarBox.width <= 280)
          checks.push({ name: 'Sidebar width correct', passed: hasCorrectWidth, width: sidebarBox?.width })
        } else {
          checks.push({ name: 'Sidebar visible on desktop', passed: false })
        }
        
        // Check content not overlapping sidebar
        const main = await page.$('main')
        if (main) {
          const mainBox = await main.boundingBox()
          checks.push({ name: 'Main content positioned', passed: mainBox && mainBox.x >= 0, left: mainBox?.x })
        }
      } else {
        // Mobile checks
        // Sidebar should be hidden
        const sidebar = await page.$('aside')
        if (sidebar) {
          const sidebarBox = await sidebar.boundingBox()
          // On mobile, sidebar should be hidden or off-screen
          const isHidden = !sidebarBox || sidebarBox.width === 0 || sidebarBox.x < 0
          checks.push({ name: 'Sidebar hidden on mobile', passed: isHidden })
        } else {
          checks.push({ name: 'Sidebar not in DOM on mobile', passed: true })
        }
        
        // Check for bottom nav
        const bottomNav = await page.$('nav.lg\\:hidden')
        checks.push({ name: 'Bottom nav on mobile', passed: !!bottomNav })
        
        // Check viewport width
        const pageWidth = await page.evaluate(() => document.documentElement.clientWidth)
        checks.push({ name: 'No horizontal scroll', passed: pageWidth <= 375 })
      }
      
      const allPassed = checks.every(c => c.passed)
      return { passed: allPassed, checks }
    })
    
  } finally {
    await browser.close()
  }
  
  // Print results
  const totalTime = Date.now() - startTime
  console.log('='.repeat(60))
  console.log('TEST RESULTS')
  console.log('='.repeat(60))
  console.log('')
  console.log(`Total time: ${totalTime}ms`)
  console.log(`Passed: ${results.passed.length}`)
  console.log(`Failed: ${results.failed.length}`)
  console.log('')
  
  if (results.passed.length > 0) {
    console.log('PASSED:')
    for (const r of results.passed) {
      console.log(`  ✅ ${r.name}`)
      if (r.checks) {
        for (const c of r.checks) {
          console.log(`      ${c.passed ? '✓' : '✗'} ${c.name}${c.count !== undefined ? ` (${c.count})` : ''}`)
        }
      }
    }
    console.log('')
  }
  
  if (results.failed.length > 0) {
    console.log('FAILED:')
    for (const r of results.failed) {
      console.log(`  ❌ ${r.name}${r.error ? `: ${r.error}` : ''}`)
      if (r.checks) {
        for (const c of r.checks) {
          console.log(`      ${c.passed ? '✓' : '✗'} ${c.name}${c.width !== undefined ? ` (width: ${c.width})` : ''}${c.count !== undefined ? ` (${c.count})` : ''}`)
        }
      }
    }
    console.log('')
  }
  
  console.log('TIMING:')
  for (const [name, time] of Object.entries(results.timing)) {
    console.log(`  ${name}: ${time}ms`)
  }
  
  return results.failed.length === 0
}

runTests()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error('Test runner error:', err)
    process.exit(1)
  })
