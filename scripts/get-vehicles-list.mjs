import puppeteer from 'puppeteer'

async function getVehicles() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // Intercept API responses
  let vehiclesData = null
  page.on('response', async (response) => {
    if (response.url().includes('vehicles.listWithLocation')) {
      try {
        const json = await response.json()
        vehiclesData = json.result?.data?.json
      } catch (e) {}
    }
  })

  await page.goto('http://localhost:3000/vehicles', { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  if (vehiclesData) {
    console.log('Total vehicles:', vehiclesData.total)
    console.log('Vehicles returned:', vehiclesData.vehicles?.length)
    console.log('')
    console.log('=== Vehicle List ===')
    vehiclesData.vehicles?.forEach((v, i) => {
      const num = (i+1).toString().padStart(3)
      const unit = (v.unitNumber || '???').padEnd(6)
      const year = v.year || '????'
      const make = v.make || 'Unknown'
      const model = v.model || ''
      const trim = v.trim || ''
      const color = v.color || 'No Color'
      console.log(`${num}. ${unit} | ${year} ${make} ${model} ${trim} | ${color}`)
    })
  } else {
    console.log('Could not capture vehicles data')
    // Try to get from page content
    const count = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="CardContent"]')
      return cards.length
    })
    console.log('Cards on page:', count)
  }

  await browser.close()
}

getVehicles().catch(console.error)
