/**
 * Spireon GPS mirror tables
 * Mirrors: devices, locations, diagnostics, geofences
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, decimal, index, unique, doublePrecision } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { integrationAccounts } from './integrations'

/**
 * Spireon devices (GPS units in vehicles)
 */
export const spireonDevices = pgTable('spireon_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalId: text('external_id').notNull(),
  // Device info
  name: text('name'),
  serialNumber: text('serial_number'),
  imei: text('imei'),
  deviceType: text('device_type'),
  // Vehicle association (from Spireon)
  vehicleName: text('vehicle_name'),
  vehicleVin: text('vehicle_vin'),
  vehicleLicensePlate: text('vehicle_license_plate'),
  vehicleYear: integer('vehicle_year'),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  // Current status
  status: text('status'),
  isOnline: boolean('is_online').default(false),
  lastCommunication: timestamp('last_communication', { withTimezone: true }),
  // Current location (cached from latest location record)
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  currentSpeed: decimal('current_speed', { precision: 6, scale: 2 }),
  currentHeading: integer('current_heading'),
  currentAddress: text('current_address'),
  currentLocationAt: timestamp('current_location_at', { withTimezone: true }),
  // Diagnostics (cached)
  currentOdometer: integer('current_odometer'),
  currentBatteryVoltage: decimal('current_battery_voltage', { precision: 5, scale: 2 }),
  currentFuelLevel: integer('current_fuel_level'),
  ignitionOn: boolean('ignition_on').default(false),
  // Shop tracking - when vehicle was last at the shop location
  lastAtShopAt: timestamp('last_at_shop_at', { withTimezone: true }),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('spireon_devices_account_external_id').on(table.integrationAccountId, table.externalId),
  index('spireon_devices_integration_account_id_idx').on(table.integrationAccountId),
  index('spireon_devices_vehicle_vin_idx').on(table.vehicleVin),
  index('spireon_devices_serial_number_idx').on(table.serialNumber),
])

/**
 * Spireon location history
 */
export const spireonLocations = pgTable('spireon_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  deviceId: uuid('device_id').notNull().references(() => spireonDevices.id),
  externalId: text('external_id'), // If Spireon provides one
  // Location
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  altitude: decimal('altitude', { precision: 8, scale: 2 }),
  accuracy: decimal('accuracy', { precision: 8, scale: 2 }),
  // Motion
  speed: decimal('speed', { precision: 6, scale: 2 }),
  heading: integer('heading'),
  // Reverse geocoded address
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  // Event type
  eventType: text('event_type'), // 'periodic', 'ignition_on', 'ignition_off', 'speeding', etc.
  // Timing
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow(),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('spireon_locations_device_id_idx').on(table.deviceId),
  index('spireon_locations_recorded_at_idx').on(table.recordedAt),
  index('spireon_locations_lat_lng_idx').on(table.lat, table.lng),
])

/**
 * Spireon diagnostics (OBD data)
 */
export const spireonDiagnostics = pgTable('spireon_diagnostics', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  deviceId: uuid('device_id').notNull().references(() => spireonDevices.id),
  externalId: text('external_id'),
  // Diagnostic data
  odometer: integer('odometer'),
  batteryVoltage: decimal('battery_voltage', { precision: 5, scale: 2 }),
  fuelLevel: integer('fuel_level'),
  engineRpm: integer('engine_rpm'),
  coolantTemp: integer('coolant_temp'),
  // DTC codes
  dtcCodes: jsonb('dtc_codes').$type<string[]>().default([]),
  checkEngineLight: boolean('check_engine_light').default(false),
  // Timing
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow(),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('spireon_diagnostics_device_id_idx').on(table.deviceId),
  index('spireon_diagnostics_recorded_at_idx').on(table.recordedAt),
])

/**
 * Spireon geofences
 */
export const spireonGeofences = pgTable('spireon_geofences', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalId: text('external_id'),
  // Geofence definition
  name: text('name').notNull(),
  description: text('description'),
  geofenceType: text('geofence_type'), // 'circle', 'polygon'
  // Circle geofence
  centerLat: doublePrecision('center_lat'),
  centerLng: doublePrecision('center_lng'),
  radiusMeters: decimal('radius_meters', { precision: 10, scale: 2 }),
  // Polygon geofence (GeoJSON)
  polygon: jsonb('polygon'),
  // Status
  isActive: boolean('is_active').default(true),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('spireon_geofences_integration_account_id_idx').on(table.integrationAccountId),
  index('spireon_geofences_name_idx').on(table.name),
])

/**
 * Spireon geofence events (enter/exit)
 */
export const spireonGeofenceEvents = pgTable('spireon_geofence_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  deviceId: uuid('device_id').notNull().references(() => spireonDevices.id),
  geofenceId: uuid('geofence_id').references(() => spireonGeofences.id),
  externalId: text('external_id'),
  // Event details
  eventType: text('event_type').notNull(), // 'enter', 'exit'
  geofenceName: text('geofence_name'),
  // Location at event
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  // Timing
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow(),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('spireon_geofence_events_device_id_idx').on(table.deviceId),
  index('spireon_geofence_events_geofence_id_idx').on(table.geofenceId),
  index('spireon_geofence_events_occurred_at_idx').on(table.occurredAt),
])

// Relations
export const spireonDevicesRelations = relations(spireonDevices, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [spireonDevices.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  locations: many(spireonLocations),
  diagnostics: many(spireonDiagnostics),
  geofenceEvents: many(spireonGeofenceEvents),
}))

export const spireonLocationsRelations = relations(spireonLocations, ({ one }) => ({
  device: one(spireonDevices, {
    fields: [spireonLocations.deviceId],
    references: [spireonDevices.id],
  }),
}))

export const spireonDiagnosticsRelations = relations(spireonDiagnostics, ({ one }) => ({
  device: one(spireonDevices, {
    fields: [spireonDiagnostics.deviceId],
    references: [spireonDevices.id],
  }),
}))

export const spireonGeofencesRelations = relations(spireonGeofences, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [spireonGeofences.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  events: many(spireonGeofenceEvents),
}))

export const spireonGeofenceEventsRelations = relations(spireonGeofenceEvents, ({ one }) => ({
  device: one(spireonDevices, {
    fields: [spireonGeofenceEvents.deviceId],
    references: [spireonDevices.id],
  }),
  geofence: one(spireonGeofences, {
    fields: [spireonGeofenceEvents.geofenceId],
    references: [spireonGeofences.id],
  }),
}))
