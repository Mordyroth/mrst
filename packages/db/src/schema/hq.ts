/**
 * HQ Rental mirror tables
 * Mirrors: customers, vehicles, reservations, contracts, payments, charges, documents
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, decimal, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { integrationAccounts } from './integrations'

/**
 * HQ Customers
 */
export const hqCustomers = pgTable('hq_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalId: text('external_id').notNull(),
  // Core identity fields
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'), // E.164 format
  // Address
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  country: text('country'),
  // ID/License
  licenseNumber: text('license_number'),
  licenseState: text('license_state'),
  licenseExpiry: timestamp('license_expiry', { withTimezone: true }),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  // Business info
  companyName: text('company_name'),
  // Status
  status: text('status'),
  customerType: text('customer_type'),
  notes: text('notes'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_customers_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_customers_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_customers_email_idx').on(table.email),
  index('hq_customers_phone_normalized_idx').on(table.phoneNormalized),
  index('hq_customers_full_name_idx').on(table.fullName),
])

/**
 * HQ Vehicles
 */
export const hqVehicles = pgTable('hq_vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalId: text('external_id').notNull(),
  // Vehicle identity
  vin: text('vin'),
  licensePlate: text('license_plate'),
  unitNumber: text('unit_number'), // Internal fleet number
  // Vehicle details
  year: integer('year'),
  make: text('make'),
  model: text('model'),
  trim: text('trim'),
  color: text('color'),
  vehicleType: text('vehicle_type'), // 'sedan', 'suv', etc.
  // Status
  status: text('status'),
  availability: text('availability'),
  currentMileage: integer('current_mileage'),
  fuelLevel: text('fuel_level'),
  // Location (if stored)
  currentLocation: text('current_location'),
  // Financial
  dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),
  weeklyRate: decimal('weekly_rate', { precision: 10, scale: 2 }),
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }),
  // Metadata
  notes: text('notes'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_vehicles_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_vehicles_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_vehicles_vin_idx').on(table.vin),
  index('hq_vehicles_license_plate_idx').on(table.licensePlate),
  index('hq_vehicles_unit_number_idx').on(table.unitNumber),
  index('hq_vehicles_status_idx').on(table.status),
])

/**
 * HQ Reservations
 */
export const hqReservations = pgTable('hq_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  customerId: uuid('customer_id').references(() => hqCustomers.id),
  vehicleId: uuid('vehicle_id').references(() => hqVehicles.id),
  externalId: text('external_id').notNull(),
  externalCustomerId: text('external_customer_id'),
  externalVehicleId: text('external_vehicle_id'),
  // Reservation details
  reservationNumber: text('reservation_number'),
  status: text('status'),
  // Dates
  pickupDate: timestamp('pickup_date', { withTimezone: true }),
  returnDate: timestamp('return_date', { withTimezone: true }),
  actualPickupDate: timestamp('actual_pickup_date', { withTimezone: true }),
  actualReturnDate: timestamp('actual_return_date', { withTimezone: true }),
  // Location
  pickupLocation: text('pickup_location'),
  returnLocation: text('return_location'),
  // Rates
  dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),
  totalEstimate: decimal('total_estimate', { precision: 10, scale: 2 }),
  // Options
  additionalDriver: boolean('additional_driver').default(false),
  insuranceType: text('insurance_type'),
  // Notes
  notes: text('notes'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_reservations_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_reservations_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_reservations_customer_id_idx').on(table.customerId),
  index('hq_reservations_vehicle_id_idx').on(table.vehicleId),
  index('hq_reservations_status_idx').on(table.status),
  index('hq_reservations_pickup_date_idx').on(table.pickupDate),
])

/**
 * HQ Contracts (active rentals)
 */
export const hqContracts = pgTable('hq_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  customerId: uuid('customer_id').references(() => hqCustomers.id),
  vehicleId: uuid('vehicle_id').references(() => hqVehicles.id),
  reservationId: uuid('reservation_id').references(() => hqReservations.id),
  externalId: text('external_id').notNull(),
  externalCustomerId: text('external_customer_id'),
  externalVehicleId: text('external_vehicle_id'),
  externalReservationId: text('external_reservation_id'),
  // Contract details
  contractNumber: text('contract_number'),
  status: text('status'),
  // Dates
  pickupDate: timestamp('pickup_date', { withTimezone: true }),
  expectedReturnDate: timestamp('expected_return_date', { withTimezone: true }),
  actualReturnDate: timestamp('actual_return_date', { withTimezone: true }),
  // Mileage
  mileageOut: integer('mileage_out'),
  mileageIn: integer('mileage_in'),
  mileageAllowed: integer('mileage_allowed'),
  // Fuel
  fuelOut: text('fuel_out'),
  fuelIn: text('fuel_in'),
  // Rates
  dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),
  totalCharges: decimal('total_charges', { precision: 10, scale: 2 }),
  totalPayments: decimal('total_payments', { precision: 10, scale: 2 }),
  balance: decimal('balance', { precision: 10, scale: 2 }),
  // Notes
  notes: text('notes'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_contracts_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_contracts_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_contracts_customer_id_idx').on(table.customerId),
  index('hq_contracts_vehicle_id_idx').on(table.vehicleId),
  index('hq_contracts_status_idx').on(table.status),
])

/**
 * HQ Payments
 */
export const hqPayments = pgTable('hq_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  customerId: uuid('customer_id').references(() => hqCustomers.id),
  contractId: uuid('contract_id').references(() => hqContracts.id),
  externalId: text('external_id').notNull(),
  externalCustomerId: text('external_customer_id'),
  externalContractId: text('external_contract_id'),
  // Payment details
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentType: text('payment_type'), // 'cash', 'card', 'check', etc.
  paymentDate: timestamp('payment_date', { withTimezone: true }),
  referenceNumber: text('reference_number'),
  cardLast4: text('card_last_4'),
  // Status
  status: text('status'),
  notes: text('notes'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_payments_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_payments_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_payments_customer_id_idx').on(table.customerId),
  index('hq_payments_contract_id_idx').on(table.contractId),
  index('hq_payments_payment_date_idx').on(table.paymentDate),
])

/**
 * HQ Charges (additional fees, damages, etc.)
 */
export const hqCharges = pgTable('hq_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  customerId: uuid('customer_id').references(() => hqCustomers.id),
  contractId: uuid('contract_id').references(() => hqContracts.id),
  externalId: text('external_id').notNull(),
  externalCustomerId: text('external_customer_id'),
  externalContractId: text('external_contract_id'),
  // Charge details
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  chargeType: text('charge_type'), // 'fuel', 'damage', 'late', 'cleaning', etc.
  description: text('description'),
  chargeDate: timestamp('charge_date', { withTimezone: true }),
  // Status
  status: text('status'),
  notes: text('notes'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_charges_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_charges_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_charges_customer_id_idx').on(table.customerId),
  index('hq_charges_contract_id_idx').on(table.contractId),
])

/**
 * HQ Documents (scanned IDs, contracts, etc.)
 */
export const hqDocuments = pgTable('hq_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  customerId: uuid('customer_id').references(() => hqCustomers.id),
  contractId: uuid('contract_id').references(() => hqContracts.id),
  vehicleId: uuid('vehicle_id').references(() => hqVehicles.id),
  externalId: text('external_id').notNull(),
  externalCustomerId: text('external_customer_id'),
  externalContractId: text('external_contract_id'),
  externalVehicleId: text('external_vehicle_id'),
  // Document details
  documentType: text('document_type'), // 'license', 'insurance', 'contract', 'damage_photo', etc.
  filename: text('filename'),
  mimeType: text('mime_type'),
  url: text('url'),
  // S3 storage
  s3Downloaded: boolean('s3_downloaded').default(false),
  s3Bucket: text('s3_bucket'),
  s3Key: text('s3_key'),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  // OCR (if processed)
  ocrText: text('ocr_text'),
  ocrProcessedAt: timestamp('ocr_processed_at', { withTimezone: true }),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('hq_documents_account_external_id').on(table.integrationAccountId, table.externalId),
  index('hq_documents_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_documents_customer_id_idx').on(table.customerId),
  index('hq_documents_contract_id_idx').on(table.contractId),
  index('hq_documents_vehicle_id_idx').on(table.vehicleId),
])

// Relations
export const hqCustomersRelations = relations(hqCustomers, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqCustomers.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  reservations: many(hqReservations),
  contracts: many(hqContracts),
  payments: many(hqPayments),
  charges: many(hqCharges),
  documents: many(hqDocuments),
}))

export const hqVehiclesRelations = relations(hqVehicles, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqVehicles.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  reservations: many(hqReservations),
  contracts: many(hqContracts),
  documents: many(hqDocuments),
}))

export const hqReservationsRelations = relations(hqReservations, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqReservations.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  customer: one(hqCustomers, {
    fields: [hqReservations.customerId],
    references: [hqCustomers.id],
  }),
  vehicle: one(hqVehicles, {
    fields: [hqReservations.vehicleId],
    references: [hqVehicles.id],
  }),
  contracts: many(hqContracts),
}))

export const hqContractsRelations = relations(hqContracts, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqContracts.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  customer: one(hqCustomers, {
    fields: [hqContracts.customerId],
    references: [hqCustomers.id],
  }),
  vehicle: one(hqVehicles, {
    fields: [hqContracts.vehicleId],
    references: [hqVehicles.id],
  }),
  reservation: one(hqReservations, {
    fields: [hqContracts.reservationId],
    references: [hqReservations.id],
  }),
  payments: many(hqPayments),
  charges: many(hqCharges),
  documents: many(hqDocuments),
}))

export const hqPaymentsRelations = relations(hqPayments, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqPayments.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  customer: one(hqCustomers, {
    fields: [hqPayments.customerId],
    references: [hqCustomers.id],
  }),
  contract: one(hqContracts, {
    fields: [hqPayments.contractId],
    references: [hqContracts.id],
  }),
}))

export const hqChargesRelations = relations(hqCharges, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqCharges.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  customer: one(hqCustomers, {
    fields: [hqCharges.customerId],
    references: [hqCustomers.id],
  }),
  contract: one(hqContracts, {
    fields: [hqCharges.contractId],
    references: [hqContracts.id],
  }),
}))

export const hqDocumentsRelations = relations(hqDocuments, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [hqDocuments.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  customer: one(hqCustomers, {
    fields: [hqDocuments.customerId],
    references: [hqCustomers.id],
  }),
  contract: one(hqContracts, {
    fields: [hqDocuments.contractId],
    references: [hqContracts.id],
  }),
  vehicle: one(hqVehicles, {
    fields: [hqDocuments.vehicleId],
    references: [hqVehicles.id],
  }),
}))
