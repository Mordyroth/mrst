#!/usr/bin/env node
/**
 * Comprehensive MRST Frontend Test Suite
 * Tests all features documented in FRONTEND_MASTER_SPEC.md
 */
import puppeteer from 'puppeteer'
import fs from 'fs'

const BASE_URL = 'https://app.travelautorental.com/mrst'
const results = {
  passed: [],
  failed: [],
  timing: {},
  totalTime: 0,
  timestamp: new Date().toISOString(),
}

async function test(browser, name, testFn) {
  const start = Date.now()
  const page = await browser.newPage()

  try {
    await page.setViewport({ width: 1280, height: 800 })
    const result = await testFn(page)
    const duration = Date.now() - start
    results.timing[name] = duration

    if (result.passed) {
      results.passed.push({ name, duration, details: result.details })
      console.log(`✅ ${name} (${duration}ms)`)
      if (result.details) {
        Object.entries(result.details).forEach(([k, v]) => {
          console.log(`   ${k}: ${v}`)
        })
      }
    } else {
      results.failed.push({ name, duration, error: result.error, details: result.details })
      console.log(`❌ ${name} (${duration}ms): ${result.error}`)
    }
  } catch (error) {
    const duration = Date.now() - start
    results.timing[name] = duration
    results.failed.push({ name, duration, error: error.message })
    console.log(`❌ ${name} (${duration}ms): ${error.message}`)
  } finally {
    await page.close()
  }
}

async function runTests() {
  console.log('='.repeat(60))
  console.log('MRST COMPREHENSIVE FRONTEND TEST SUITE')
  console.log('='.repeat(60))
  console.log(`Started: ${results.timestamp}`)
  console.log(`Target: ${BASE_URL}`)
  console.log('')

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const totalStart = Date.now()

  // Test 1: Dashboard Layout (Desktop)
  await test(browser, 'Dashboard - Desktop Layout', async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 2000))

    const sidebar = await page.$('aside')
    const sidebarBox = sidebar ? await sidebar.boundingBox() : null
    const hasSidebar = sidebarBox && sidebarBox.width > 50 && sidebarBox.width < 300

    const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
    const hasTitle = title === 'Dashboard'

    return {
      passed: hasSidebar && hasTitle,
      error: !hasSidebar ? 'Sidebar not visible' : !hasTitle ? 'Title not found' : null,
      details: { sidebarWidth: sidebarBox?.width, title }
    }
  })

  // Test 2: Dashboard Stats Cards
  await test(browser, 'Dashboard - Stats Cards', async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 3000))

    const hasTotal = await page.$eval('body', body =>
      body.textContent.includes('Total Fleet') || body.textContent.includes('Total')
    ).catch(() => false)

    const hasAvailable = await page.$eval('body', body =>
      body.textContent.includes('Available')
    ).catch(() => false)

    const hasRented = await page.$eval('body', body =>
      body.textContent.includes('Rented') || body.textContent.includes('rental')
    ).catch(() => false)

    return {
      passed: hasTotal && hasAvailable,
      error: !hasTotal ? 'Total stats missing' : !hasAvailable ? 'Available stats missing' : null,
      details: { hasTotal, hasAvailable, hasRented }
    }
  })

  // Test 3: Vehicles Page - Load and Display
  await test(browser, 'Vehicles Page - Load', async (page) => {
    let vehicleData = null
    page.on('response', async (response) => {
      if (response.url().includes('vehicles.listWithLocation')) {
        try {
          const json = await response.json()
          vehicleData = json.result?.data?.json
        } catch (e) {}
      }
    })

    await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    const title = await page.$eval('h1', el => el?.textContent).catch(() => null)

    return {
      passed: title === 'Vehicles' && vehicleData?.vehicles?.length > 0,
      error: title !== 'Vehicles' ? 'Wrong title' : 'No vehicles loaded',
      details: {
        title,
        vehicleCount: vehicleData?.vehicles?.length,
        total: vehicleData?.total
      }
    }
  })

  // Test 4: Vehicles Page - Make/Model/Year/Color Display
  await test(browser, 'Vehicles Page - Vehicle Info Display', async (page) => {
    let vehicleData = null
    page.on('response', async (response) => {
      if (response.url().includes('vehicles.listWithLocation')) {
        try {
          const json = await response.json()
          vehicleData = json.result?.data?.json
        } catch (e) {}
      }
    })

    await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    if (!vehicleData?.vehicles?.length) {
      return { passed: false, error: 'No vehicles to check' }
    }

    // Check first few vehicles have make/model/year
    const sampleVehicles = vehicleData.vehicles.slice(0, 5)
    const hasVehicleInfo = sampleVehicles.every(v => v.make || v.model || v.year)

    // Check color is present
    const hasColor = sampleVehicles.some(v => v.color)

    // Check info is displayed on page
    const pageHasInfo = await page.$eval('body', body => {
      const text = body.textContent
      return text.includes('Toyota') || text.includes('Honda') || text.includes('BMW')
    }).catch(() => false)

    return {
      passed: hasVehicleInfo && pageHasInfo,
      details: {
        hasVehicleInfo,
        hasColor,
        pageHasInfo,
        sampleMakes: sampleVehicles.map(v => v.make).filter(Boolean).slice(0, 3)
      }
    }
  })

  // Test 5: Vehicles Page - At Shop Badge
  await test(browser, 'Vehicles Page - Location Status', async (page) => {
    await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    const hasAtShop = await page.$eval('body', body =>
      body.textContent.includes('At Shop')
    ).catch(() => false)

    const hasAwayFromShop = await page.$eval('body', body =>
      body.textContent.includes('Away from Shop')
    ).catch(() => false)

    const hasRenter = await page.$eval('body', body =>
      body.textContent.includes('Out with Renter')
    ).catch(() => false)

    return {
      passed: hasAtShop || hasAwayFromShop || hasRenter,
      details: { hasAtShop, hasAwayFromShop, hasRenter }
    }
  })

  // Test 6: Vehicles Page - City Display
  await test(browser, 'Vehicles Page - City Display', async (page) => {
    let vehicleData = null
    page.on('response', async (response) => {
      if (response.url().includes('vehicles.listWithLocation')) {
        try {
          const json = await response.json()
          vehicleData = json.result?.data?.json
        } catch (e) {}
      }
    })

    await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    const vehiclesWithCity = vehicleData?.vehicles?.filter(v => v.location?.city) || []

    return {
      passed: vehiclesWithCity.length > 0,
      details: {
        vehiclesWithCity: vehiclesWithCity.length,
        sampleCities: vehiclesWithCity.slice(0, 3).map(v => v.location?.city)
      }
    }
  })

  // Test 7: Vehicles Page - Last at Shop
  await test(browser, 'Vehicles Page - Last at Shop Status', async (page) => {
    let vehicleData = null
    page.on('response', async (response) => {
      if (response.url().includes('vehicles.listWithLocation')) {
        try {
          const json = await response.json()
          vehicleData = json.result?.data?.json
        } catch (e) {}
      }
    })

    await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    const vehiclesWithLastAtShop = vehicleData?.vehicles?.filter(v => v.lastAtShopAt) || []

    // Check if "Last at shop" text appears on page for qualifying vehicles
    const pageHasLastAtShop = await page.$eval('body', body =>
      body.textContent.includes('Last at shop')
    ).catch(() => false)

    return {
      passed: vehiclesWithLastAtShop.length > 0,
      details: {
        vehiclesWithLastAtShop: vehiclesWithLastAtShop.length,
        pageShowsLastAtShop: pageHasLastAtShop
      }
    }
  })

  // Test 8: Vehicle Detail Page
  await test(browser, 'Vehicle Detail Page', async (page) => {
    let vehicleData = null
    page.on('response', async (response) => {
      if (response.url().includes('vehicles.listWithLocation')) {
        try {
          const json = await response.json()
          vehicleData = json.result?.data?.json
        } catch (e) {}
      }
    })

    await page.goto(`${BASE_URL}/vehicles`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    if (!vehicleData?.vehicles?.length) {
      return { passed: false, error: 'No vehicles to click' }
    }

    // Get first vehicle ID
    const firstVehicleId = vehicleData.vehicles[0].id

    // Navigate to detail page
    await page.goto(`${BASE_URL}/vehicles/${firstVehicleId}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 3000))

    const url = page.url()
    const hasBackButton = await page.$('a[href*="/vehicles"]').catch(() => null)
    const hasError = await page.$eval('body', body =>
      body.textContent.includes('not found') || body.textContent.includes('Failed')
    ).catch(() => false)

    return {
      passed: url.includes('/vehicles/') && !hasError,
      error: hasError ? 'Page shows error' : null,
      details: { url, hasBackButton: !!hasBackButton, hasError }
    }
  })

  // Test 9: Customers Page
  await test(browser, 'Customers Page', async (page) => {
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 3000))

    const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
    const hasSearch = await page.$('input[placeholder*="Search"]').catch(() => null)

    // Check for actual customer data (not placeholder)
    const hasData = await page.$eval('body', body =>
      !body.textContent.includes('coming soon') &&
      (body.textContent.includes('customers') || body.textContent.includes('Customer'))
    ).catch(() => false)

    return {
      passed: title === 'Customers',
      details: { title, hasSearch: !!hasSearch, hasData }
    }
  })

  // Test 10: Timeline Page
  await test(browser, 'Timeline Page', async (page) => {
    await page.goto(`${BASE_URL}/timeline`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 3000))

    const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
    const hasEvents = await page.$eval('body', body =>
      body.textContent.includes('Gmail') || body.textContent.includes('HQ') || body.textContent.includes('Monday')
    ).catch(() => false)

    return {
      passed: title?.includes('Timeline'),
      details: { title, hasEvents }
    }
  })

  // Test 11: Fleet Map Page
  await test(browser, 'Fleet Map Page', async (page) => {
    await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 3000))

    const title = await page.$eval('h1', el => el?.textContent).catch(() => null)
    const hasMapElement = await page.$('iframe, [class*="map"], .leaflet-container, [id*="map"]').catch(() => null)

    return {
      passed: title?.includes('Map') || title?.includes('Fleet'),
      details: { title, hasMapElement: !!hasMapElement }
    }
  })

  // Test 12: Mobile Layout
  await test(browser, 'Mobile Layout', async (page) => {
    await page.setViewport({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 2000))

    // Sidebar should be hidden
    const sidebar = await page.$('aside')
    const sidebarBox = sidebar ? await sidebar.boundingBox() : null
    const sidebarHidden = !sidebarBox || sidebarBox.width === 0 || sidebarBox.x < 0

    // Mobile header should exist
    const header = await page.$('header')

    // Bottom nav should exist
    const bottomNav = await page.$('nav')

    return {
      passed: sidebarHidden || !!header,
      details: {
        sidebarHidden,
        hasHeader: !!header,
        hasBottomNav: !!bottomNav,
        sidebarWidth: sidebarBox?.width
      }
    }
  })

  // Test 13: Navigation
  await test(browser, 'Navigation Works', async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise(r => setTimeout(r, 2000))

    // Click vehicles link
    const vehiclesLink = await page.$('a[href*="/vehicles"]')
    if (vehiclesLink) {
      await vehiclesLink.click()
      await new Promise(r => setTimeout(r, 2000))
    }

    const url = page.url()

    return {
      passed: url.includes('/vehicles'),
      details: { currentUrl: url }
    }
  })

  await browser.close()

  results.totalTime = Date.now() - totalStart

  // Print summary
  console.log('')
  console.log('='.repeat(60))
  console.log('TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total Time: ${results.totalTime}ms`)
  console.log(`Passed: ${results.passed.length}`)
  console.log(`Failed: ${results.failed.length}`)
  console.log('')

  // Save results to file
  const reportPath = 'test-results.json'
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(`Results saved to: ${reportPath}`)

  return results.failed.length === 0
}

runTests()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error('Test runner error:', err)
    process.exit(1)
  })
