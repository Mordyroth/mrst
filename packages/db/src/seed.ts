/**
 * Database seed script
 * Creates initial tenant and admin user for development
 */

import crypto from 'crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema/index'

async function seed() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

  console.log('Connecting to database...')
  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  console.log('Creating initial tenant...')

  // Create tenant
  const [tenant] = await db.insert(schema.tenants).values({
    name: 'Travel Auto Rental',
    slug: 'travel-auto',
    settings: {
      timezone: 'America/New_York',
      shopAddress: '1621 63rd Street, Brooklyn, NY 11204',
      shopLat: 40.622877,
      shopLng: -73.993128,
      shopRadiusMeters: 483,
    },
  }).onConflictDoNothing().returning()

  if (tenant) {
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`)

    // Create admin user
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex')

    const [user] = await db.insert(schema.users).values({
      tenantId: tenant.id,
      email: 'admin@travelautorental.com',
      name: 'Admin',
      passwordHash,
      role: 'owner',
    }).onConflictDoNothing().returning()

    if (user) {
      console.log(`Created admin user: ${user.email}`)
    } else {
      console.log('Admin user already exists')
    }
  } else {
    console.log('Tenant already exists')

    // Get existing tenant
    const existingTenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, 'travel-auto'),
    })

    if (existingTenant) {
      console.log(`Found existing tenant: ${existingTenant.name} (${existingTenant.id})`)
    }
  }

  console.log('Seed complete!')
  await client.end()
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
