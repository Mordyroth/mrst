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

// ============================================================
// HQ MIRROR: Additional Tables (Phase 1 - Complete Data Mirror)
// ============================================================

/**
 * HQ Refunds
 */
export const hqRefunds = pgTable('hq_refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalRefundId: text('external_refund_id').notNull(),
  reservationExternalId: text('reservation_external_id'),
  paymentExternalId: text('payment_external_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  reason: text('reason'),
  status: text('status'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_refunds_account_external_id').on(table.integrationAccountId, table.externalRefundId),
  index('hq_refunds_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_refunds_reservation_external_id_idx').on(table.reservationExternalId),
])

/**
 * HQ Vehicle Damages
 */
export const hqDamages = pgTable('hq_damages', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalDamageId: text('external_damage_id').notNull(),
  vehicleExternalId: text('vehicle_external_id'),
  reservationExternalId: text('reservation_external_id'),
  damageType: text('damage_type'),
  description: text('description'),
  locationOnVehicle: text('location_on_vehicle'),
  severity: text('severity'),
  repairCost: decimal('repair_cost', { precision: 10, scale: 2 }),
  reportedAt: timestamp('reported_at', { withTimezone: true }),
  repairedAt: timestamp('repaired_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_damages_account_external_id').on(table.integrationAccountId, table.externalDamageId),
  index('hq_damages_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_damages_vehicle_external_id_idx').on(table.vehicleExternalId),
])

/**
 * HQ Comments/Notes
 */
export const hqComments = pgTable('hq_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalCommentId: text('external_comment_id').notNull(),
  itemType: text('item_type'), // 'reservation', 'vehicle', 'customer'
  itemExternalId: text('item_external_id'),
  body: text('body'),
  authorName: text('author_name'),
  createdAtHq: timestamp('created_at_hq', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_comments_account_external_id').on(table.integrationAccountId, table.externalCommentId),
  index('hq_comments_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_comments_item_type_external_id_idx').on(table.itemType, table.itemExternalId),
])

/**
 * HQ Extensions (rental extensions)
 */
export const hqExtensions = pgTable('hq_extensions', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalExtensionId: text('external_extension_id').notNull(),
  reservationExternalId: text('reservation_external_id'),
  originalReturnDate: timestamp('original_return_date', { withTimezone: true }),
  newReturnDate: timestamp('new_return_date', { withTimezone: true }),
  additionalCharges: decimal('additional_charges', { precision: 10, scale: 2 }),
  createdAtHq: timestamp('created_at_hq', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_extensions_account_external_id').on(table.integrationAccountId, table.externalExtensionId),
  index('hq_extensions_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_extensions_reservation_external_id_idx').on(table.reservationExternalId),
])

/**
 * HQ External Charges (tolls, fines, etc.)
 */
export const hqExternalCharges = pgTable('hq_external_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalChargeId: text('external_charge_id').notNull(),
  reservationExternalId: text('reservation_external_id'),
  chargeType: text('charge_type'),
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_external_charges_account_external_id').on(table.integrationAccountId, table.externalChargeId),
  index('hq_external_charges_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_external_charges_reservation_external_id_idx').on(table.reservationExternalId),
])

/**
 * HQ Adjustments
 */
export const hqAdjustments = pgTable('hq_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalAdjustmentId: text('external_adjustment_id').notNull(),
  reservationExternalId: text('reservation_external_id'),
  adjustmentType: text('adjustment_type'),
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  createdAtHq: timestamp('created_at_hq', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_adjustments_account_external_id').on(table.integrationAccountId, table.externalAdjustmentId),
  index('hq_adjustments_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_adjustments_reservation_external_id_idx').on(table.reservationExternalId),
])

/**
 * HQ Rates
 */
export const hqRates = pgTable('hq_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalRateId: text('external_rate_id').notNull(),
  name: text('name'),
  vehicleClassId: text('vehicle_class_id'),
  rateTypeId: text('rate_type_id'),
  dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),
  weeklyRate: decimal('weekly_rate', { precision: 10, scale: 2 }),
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }),
  mileageLimit: integer('mileage_limit'),
  extraMileageRate: decimal('extra_mileage_rate', { precision: 10, scale: 2 }),
  active: boolean('active'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_rates_account_external_id').on(table.integrationAccountId, table.externalRateId),
  index('hq_rates_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_rates_vehicle_class_id_idx').on(table.vehicleClassId),
])

/**
 * HQ Rate Types
 */
export const hqRateTypes = pgTable('hq_rate_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalRateTypeId: text('external_rate_type_id').notNull(),
  name: text('name'),
  description: text('description'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_rate_types_account_external_id').on(table.integrationAccountId, table.externalRateTypeId),
  index('hq_rate_types_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Additional Charges (insurance, GPS, child seat, etc.)
 */
export const hqAdditionalCharges = pgTable('hq_additional_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalChargeId: text('external_charge_id').notNull(),
  name: text('name'),
  description: text('description'),
  chargeType: text('charge_type'), // 'daily', 'per_rental', 'per_mile'
  amount: decimal('amount', { precision: 10, scale: 2 }),
  taxable: boolean('taxable'),
  active: boolean('active'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_additional_charges_account_external_id').on(table.integrationAccountId, table.externalChargeId),
  index('hq_additional_charges_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Locations
 */
export const hqLocations = pgTable('hq_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalLocationId: text('external_location_id').notNull(),
  name: text('name'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  phone: text('phone'),
  email: text('email'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  active: boolean('active'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_locations_account_external_id').on(table.integrationAccountId, table.externalLocationId),
  index('hq_locations_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Vehicle Classes
 */
export const hqVehicleClasses = pgTable('hq_vehicle_classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalClassId: text('external_class_id').notNull(),
  name: text('name'),
  description: text('description'),
  sortOrder: integer('sort_order'),
  imageUrl: text('image_url'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_vehicle_classes_account_external_id').on(table.integrationAccountId, table.externalClassId),
  index('hq_vehicle_classes_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Vehicle Models
 */
export const hqVehicleModels = pgTable('hq_vehicle_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalModelId: text('external_model_id').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  vehicleClassId: text('vehicle_class_id'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_vehicle_models_account_external_id').on(table.integrationAccountId, table.externalModelId),
  index('hq_vehicle_models_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Blocked Periods (vehicle unavailability)
 */
export const hqBlockedPeriods = pgTable('hq_blocked_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalBlockedId: text('external_blocked_id').notNull(),
  vehicleExternalId: text('vehicle_external_id'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  reason: text('reason'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_blocked_periods_account_external_id').on(table.integrationAccountId, table.externalBlockedId),
  index('hq_blocked_periods_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_blocked_periods_vehicle_external_id_idx').on(table.vehicleExternalId),
])

/**
 * HQ Maintenance/Repair Orders
 */
export const hqRepairOrders = pgTable('hq_repair_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalRepairId: text('external_repair_id').notNull(),
  vehicleExternalId: text('vehicle_external_id'),
  status: text('status'),
  description: text('description'),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  vendor: text('vendor'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_repair_orders_account_external_id').on(table.integrationAccountId, table.externalRepairId),
  index('hq_repair_orders_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_repair_orders_vehicle_external_id_idx').on(table.vehicleExternalId),
])

/**
 * HQ Security Deposits
 */
export const hqSecurityDeposits = pgTable('hq_security_deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalDepositId: text('external_deposit_id').notNull(),
  reservationExternalId: text('reservation_external_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  status: text('status'), // 'held', 'released', 'charged'
  heldAt: timestamp('held_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_security_deposits_account_external_id').on(table.integrationAccountId, table.externalDepositId),
  index('hq_security_deposits_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_security_deposits_reservation_external_id_idx').on(table.reservationExternalId),
])

/**
 * HQ Email Templates
 */
export const hqEmailTemplates = pgTable('hq_email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalTemplateId: text('external_template_id').notNull(),
  name: text('name'),
  subject: text('subject'),
  bodyHtml: text('body_html'),
  triggerEvent: text('trigger_event'),
  active: boolean('active'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_email_templates_account_external_id').on(table.integrationAccountId, table.externalTemplateId),
  index('hq_email_templates_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Fines (tickets, violations)
 */
export const hqFines = pgTable('hq_fines', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalFineId: text('external_fine_id').notNull(),
  vehicleExternalId: text('vehicle_external_id'),
  reservationExternalId: text('reservation_external_id'),
  customerExternalId: text('customer_external_id'),
  fineType: text('fine_type'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  description: text('description'),
  violationDate: timestamp('violation_date', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_fines_account_external_id').on(table.integrationAccountId, table.externalFineId),
  index('hq_fines_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_fines_vehicle_external_id_idx').on(table.vehicleExternalId),
])

/**
 * HQ Payment Methods
 */
export const hqPaymentMethods = pgTable('hq_payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalMethodId: text('external_method_id').notNull(),
  name: text('name'),
  methodType: text('method_type'), // 'cash', 'card', 'online', 'transfer'
  active: boolean('active'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_payment_methods_account_external_id').on(table.integrationAccountId, table.externalMethodId),
  index('hq_payment_methods_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Custom Fields
 */
export const hqCustomFields = pgTable('hq_custom_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalFieldId: text('external_field_id').notNull(),
  name: text('name'),
  fieldType: text('field_type'),
  itemType: text('item_type'), // 'customer', 'vehicle', 'reservation'
  required: boolean('required'),
  options: jsonb('options'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_custom_fields_account_external_id').on(table.integrationAccountId, table.externalFieldId),
  index('hq_custom_fields_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Branches/Brands
 */
export const hqBranches = pgTable('hq_branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalBranchId: text('external_branch_id').notNull(),
  name: text('name'),
  description: text('description'),
  active: boolean('active'),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_branches_account_external_id').on(table.integrationAccountId, table.externalBranchId),
  index('hq_branches_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * HQ Vehicle Replacements
 */
export const hqVehicleReplacements = pgTable('hq_vehicle_replacements', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalReplacementId: text('external_replacement_id').notNull(),
  reservationExternalId: text('reservation_external_id'),
  originalVehicleExternalId: text('original_vehicle_external_id'),
  replacementVehicleExternalId: text('replacement_vehicle_external_id'),
  reason: text('reason'),
  replacedAt: timestamp('replaced_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('hq_vehicle_replacements_account_external_id').on(table.integrationAccountId, table.externalReplacementId),
  index('hq_vehicle_replacements_integration_account_id_idx').on(table.integrationAccountId),
  index('hq_vehicle_replacements_reservation_external_id_idx').on(table.reservationExternalId),
])
