# HQ Rental Software Replacement Specification

> **Goal:** Completely replace HQ Rental Software with MRST's own system.
> **Priority:** HIGH - This is core to the business.

---

## 1. Current State

### What We Have
- Basic mirror of: customers, vehicles, reservations, contracts
- HQ API credentials working
- Base URL: `https://api-america-3.caagcrm.com/api-america-3/`

### What We're Missing
- 80%+ of HQ data is NOT mirrored
- No write operations (create/update/delete)
- No reservation creation flow
- No payment processing
- No document generation
- No email sending

---

## 2. HQ API Credentials

```
Base URL: https://api-america-3.caagcrm.com/api-america-3/
TENANT_TOKEN: A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW
USER_TOKEN: jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO
Auth: Basic base64(TENANT_TOKEN:USER_TOKEN)
```

---

## 3. Complete API Endpoint Inventory

### 3.1 Reservations (24 endpoints) - CRITICAL

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations` | GET | List all reservations | P1 |
| `/car-rental/reservations/{id}` | GET | Get single reservation | P1 |
| `/car-rental/reservations/dates` | GET | Get form config for dates | P1 |
| `/car-rental/reservations/dates` | POST | Validate dates, get available vehicles | P1 |
| `/car-rental/reservations/additional-charges` | GET | Get applicable charges | P1 |
| `/car-rental/reservations/additional-charges` | POST | Calculate final price | P1 |
| `/car-rental/reservations/fields/customer` | GET | Get customer form fields | P1 |
| `/car-rental/reservations/customer` | POST | Create/update customer | P1 |
| `/car-rental/reservations/confirm` | POST | Create reservation | P1 |
| `/car-rental/reservations/{id}` | PUT | Update reservation | P1 |
| `/car-rental/reservations/{id}/open` | POST | Set status to Open | P2 |
| `/car-rental/reservations/{id}/cancel` | POST | Cancel reservation | P2 |
| `/car-rental/reservations/{id}/pending` | POST | Set status to Pending | P2 |
| `/car-rental/reservations/{id}/quote` | POST | Set status to Quote | P2 |
| `/car-rental/reservations/{id}/no-show` | POST | Set status to No Show | P2 |
| `/car-rental/reservations/{id}/ready-for-pickup` | POST | Mark ready for pickup | P2 |
| `/car-rental/reservations/{id}/vehicle-class` | PUT | Update vehicle class | P2 |
| `/car-rental/reservations/{id}/assign-vehicle` | POST | Assign specific vehicle | P1 |
| `/car-rental/reservations/{id}/detach-vehicle` | POST | Remove vehicle | P2 |
| `/car-rental/reservations/{id}/available-vehicles` | GET | Get available vehicles | P1 |
| `/car-rental/reservations/{id}/rental-agreement` | GET | Get contract PDF | P1 |
| `/car-rental/reservations/{id}/sign-date` | POST | Set signature date | P2 |
| `/car-rental/reservations/{id}/signature` | POST | Upload signature | P2 |
| `/car-rental/reservations/{id}/upgrade-classes` | GET | Get free upgrade options | P3 |

### 3.2 Contacts/Customers (6 endpoints) - CRITICAL

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/contacts` | GET | List all contacts | P1 |
| `/contacts/{id}` | GET | Get single contact | P1 |
| `/contacts` | POST | Create contact | P1 |
| `/contacts/{id}` | PUT | Update contact | P1 |
| `/contacts/merge` | POST | Merge duplicate contacts | P3 |
| `/contacts/categories` | GET | List contact categories | P2 |

### 3.3 Vehicles/Fleet (10 endpoints) - CRITICAL

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/vehicles` | GET | List all vehicles | P1 |
| `/fleets/vehicles/{id}` | GET | Get single vehicle | P1 |
| `/fleets/vehicles/{id}` | PUT | Update vehicle | P1 |
| `/fleets/vehicles/{id}/reserve` | POST | Reserve vehicle | P2 |
| `/fleets/vehicles/{id}/cancel-reserve` | POST | Cancel reserve | P2 |
| `/fleets/vehicles/{id}/maintenance` | GET | Get maintenance history | P2 |
| `/fleets/vehicles/models` | GET | List vehicle models | P2 |
| `/fleets/vehicles/models/{id}` | GET | Get single model | P3 |
| `/fleets/vehicles/types` | GET | List vehicle types | P2 |
| `/fleets/vehicles/types/{id}` | GET | Get single type | P3 |

### 3.4 Payments (7 endpoints) - CRITICAL

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations/{id}/payments` | GET | List payments | P1 |
| `/car-rental/reservations/{id}/payments` | POST | Create payment | P1 |
| `/car-rental/reservations/{id}/payments/{pid}` | PUT | Update payment | P2 |
| `/car-rental/reservations/{id}/charge` | POST | Charge credit card | P1 |
| `/car-rental/reservations/{id}/refund-deposit` | POST | Initiate refund | P1 |
| `/car-rental/reservations/{id}/refund-online-deposit` | POST | Refund online deposit | P2 |
| `/payment-transactions` | GET | List all transactions | P2 |

### 3.5 Refunds (4 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations/{id}/refunds` | GET | List refunds | P2 |
| `/car-rental/reservations/{id}/refunds` | POST | Create refund | P2 |
| `/car-rental/reservations/{id}/refunds/{rid}` | PUT | Update refund | P3 |
| `/car-rental/reservations/{id}/refunds/{rid}` | DELETE | Delete refund | P3 |

### 3.6 Extensions (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations/{id}/extensions` | GET | List extensions | P2 |
| `/car-rental/reservations/{id}/extensions` | POST | Create extension | P2 |
| `/car-rental/reservations/{id}/extensions/{eid}` | DELETE | Delete extension | P3 |

### 3.7 External Charges (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations/{id}/external-charges` | GET | List external charges | P2 |
| `/car-rental/reservations/{id}/external-charges` | POST | Create external charge | P2 |
| `/car-rental/reservations/{id}/external-charges/{cid}` | DELETE | Delete external charge | P3 |

### 3.8 Adjustments (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations/{id}/adjustments` | GET | List adjustments | P2 |
| `/car-rental/reservations/{id}/adjustments` | POST | Create adjustment | P2 |
| `/car-rental/reservations/{id}/adjustments/{aid}` | DELETE | Delete adjustment | P3 |

### 3.9 Comments (6 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/comments` | GET | List comments for item | P2 |
| `/comments` | POST | Create comment | P2 |
| `/comments/{id}` | PUT | Update comment | P3 |
| `/comments/{id}` | DELETE | Delete comment | P3 |
| `/car-rental/reservations/{id}/comments` | GET | Get reservation comments | P2 |
| `/car-rental/reservations/{id}/comments/{cid}` | PUT | Update reservation comment | P3 |

### 3.10 Vehicle Damages (4 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/damages` | GET | List all damages | P2 |
| `/fleets/damages` | POST | Create damage | P2 |
| `/fleets/damages/{id}` | GET | Get single damage | P2 |
| `/fleets/damages/{id}` | PUT | Update damage | P3 |

### 3.11 Vehicle Blocked Periods (4 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/vehicles/{id}/blocked-periods` | GET | List blocked periods | P2 |
| `/fleets/vehicles/{id}/blocked-periods` | POST | Create blocked period | P2 |
| `/fleets/vehicles/{id}/blocked-periods/{bid}` | PUT | Update blocked period | P3 |
| `/fleets/vehicles/{id}/blocked-periods/{bid}` | DELETE | Delete blocked period | P3 |

### 3.12 Rates & Rate Types (11 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/rates` | GET | List all rates | P2 |
| `/car-rental/rates` | POST | Create rate | P2 |
| `/car-rental/rates/{id}` | GET | Get single rate | P2 |
| `/car-rental/rates/{id}` | PUT | Update rate | P3 |
| `/car-rental/rates/{id}` | DELETE | Delete rate | P3 |
| `/car-rental/rate-types` | GET | List rate types | P2 |
| `/car-rental/rate-types` | POST | Create rate type | P3 |
| `/car-rental/rate-types/{id}` | GET | Get single rate type | P3 |
| `/car-rental/rate-types/{id}` | PUT | Update rate type | P3 |
| `/car-rental/rate-types/{id}` | DELETE | Delete rate type | P3 |

### 3.13 Additional Charges (2 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/additional-charges` | GET | List all charges | P2 |
| `/fleets/additional-charges/{id}` | GET | Get single charge | P2 |

### 3.14 Locations & Branches (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/locations` | GET | List all locations | P2 |
| `/fleets/branches` | GET | List all branches/brands | P2 |
| `/fleets/branches/{id}` | GET | Get single branch | P3 |

### 3.15 Seasons (5 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/seasons` | GET | List all seasons | P3 |
| `/car-rental/seasons` | POST | Create season | P3 |
| `/car-rental/seasons/{id}` | GET | Get single season | P3 |
| `/car-rental/seasons/{id}` | PUT | Update season | P3 |
| `/car-rental/seasons/{id}` | DELETE | Delete season | P3 |

### 3.16 Security Deposits (2 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/security-deposits` | GET | List all deposits | P2 |
| `/car-rental/security-deposits/{id}` | GET | Get single deposit | P2 |

### 3.17 Emails (7 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/email-templates` | GET | List email templates | P2 |
| `/car-rental/email-templates/{id}/trigger` | POST | Trigger email template | P2 |
| `/car-rental/reservations/{id}/confirmation-email` | POST | Send confirmation | P1 |
| `/car-rental/reservations/{id}/contract-email` | POST | Send contract | P1 |
| `/car-rental/reservations/{id}/email-templates` | GET | Get applicable templates | P2 |
| `/car-rental/reservations/{id}/email-templates/{tid}/trigger` | POST | Trigger for reservation | P2 |
| `/car-rental/quotes` | POST | Store quote & send email | P3 |

### 3.18 Files (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/files` | GET | List files | P1 |
| `/files/upload` | POST | Upload file | P1 |
| `/files/{id}` | DELETE | Delete file | P2 |

### 3.19 Customer Credits (5 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/customer-credits` | GET | List credits | P3 |
| `/car-rental/customer-credits` | POST | Create credit | P3 |
| `/car-rental/customer-credits/{id}` | PUT | Update credit | P3 |
| `/car-rental/customer-credits/{id}` | DELETE | Delete credit | P3 |

### 3.20 Fines (5 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/fines` | GET | List fines | P3 |
| `/car-rental/fines` | POST | Create fine | P3 |
| `/car-rental/fines/{id}` | GET | Get single fine | P3 |
| `/car-rental/fines/{id}` | PUT | Update fine | P3 |
| `/car-rental/fines/{id}` | DELETE | Delete fine | P3 |

### 3.21 Vehicle Replacements (4 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/car-rental/reservations/{id}/vehicle-replacements` | GET | List replacements | P2 |
| `/car-rental/reservations/{id}/vehicle-replacements` | POST | Create replacement | P2 |
| `/car-rental/reservations/{id}/vehicle-replacements/{rid}` | PUT | Update replacement | P3 |
| `/car-rental/reservations/{id}/vehicle-replacements/{rid}` | DELETE | Delete replacement | P3 |

### 3.22 Relocations (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/relocations` | GET | List relocations | P3 |
| `/fleets/relocations` | POST | Create relocation | P3 |
| `/fleets/relocations/{id}` | DELETE | Delete relocation | P3 |

### 3.23 Maintenance (3 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/repair-orders` | GET | List repair orders | P2 |
| `/fleets/repair-orders/{id}` | GET | Get single repair order | P2 |
| `/fleets/maintenance-types` | GET | List maintenance types | P3 |

### 3.24 Telematics (4 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/fleets/vehicles/{id}/obd-history` | GET | Get OBD history | P3 |
| `/fleets/obd-history` | GET | Get all OBD history | P3 |
| `/fleets/vehicles/{id}/alerts` | GET | Get vehicle alerts | P3 |
| `/fleets/vehicles/{id}/trips` | GET | Get vehicle trips | P3 |

### 3.25 Payment Gateways (13 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/payment-gateways/customers/{id}/cards` | GET | List customer cards | P2 |
| `/payment-gateways/{id}` | DELETE | Delete gateway | P3 |
| `/payment-methods` | GET | List payment methods | P2 |
| `/payment-methods/{id}` | GET | Get payment method | P2 |
| `/payment-methods/{id}/button` | GET | Get payment button | P2 |
| `/payment-methods/{id}/form` | GET | Get payment form | P2 |
| `/payment-transactions/{uuid}` | GET | Get transaction by UUID | P2 |
| `/payment-transactions` | GET | List transactions | P2 |
| `/payment-transactions` | POST | Create transaction | P1 |
| `/payment-transactions/{id}/refund` | POST | Refund transaction | P2 |
| `/payment-gateways/{id}/stripe-locations` | GET | Get Stripe locations | P3 |
| `/payment-gateways/{id}/connection-token` | GET | Get connection token | P3 |
| `/payment-gateways/stripe-terminal-token` | GET | Get terminal token | P3 |

### 3.26 Addresses (5 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/addresses` | GET | List addresses | P3 |
| `/addresses` | POST | Create address | P3 |
| `/addresses/{id}` | GET | Get single address | P3 |
| `/addresses/{id}` | PUT | Update address | P3 |
| `/addresses/{id}` | DELETE | Delete address | P3 |

### 3.27 Sheets (Custom Fields) (6 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/sheets` | GET | List all sheets | P3 |
| `/sheets/{id}` | GET | Get single sheet | P3 |
| `/sheets/{id}/items` | GET | List sheet items | P3 |
| `/sheets/{id}/items/{iid}` | GET | Get sheet item | P3 |
| `/sheets/{id}/items` | POST | Create sheet item | P3 |
| `/sheets/{id}/items/{iid}` | PUT | Update sheet item | P3 |

### 3.28 Inventory (11 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/inventory/categories` | GET | List categories | P3 |
| `/inventory/categories/{id}` | GET | Get category | P3 |
| `/inventory/items` | GET | List items | P3 |
| `/inventory/items/{id}` | GET | Get item | P3 |
| `/inventory/prices/{id}` | GET | Get price | P3 |
| `/inventory/purchase-orders` | GET | List POs | P3 |
| `/inventory/purchase-orders` | POST | Create PO | P3 |
| `/inventory/purchase-orders/{id}` | GET | Get PO | P3 |
| `/inventory/purchase-orders/{id}/report` | GET | Get PO report | P3 |
| `/inventory/purchase-orders/{id}/cancel` | POST | Cancel PO | P3 |
| `/inventory/stock/{id}` | GET | Get stock | P3 |

### 3.29 Invoices (10 endpoints)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/invoices` | GET | List invoices | P3 |
| `/invoices` | POST | Create invoice | P3 |
| `/invoices/{id}` | PUT | Update invoice | P3 |
| `/invoices/{id}/send-email` | POST | Send invoice email | P3 |
| `/invoices/{id}/void` | POST | Void invoice | P3 |
| `/invoices/{id}/items` | POST | Create item | P3 |
| `/invoices/{id}/items/{iid}` | PUT | Update item | P3 |
| `/invoices/{id}/payments` | POST | Create payment | P3 |
| `/invoices/{id}/payments/{pid}` | PUT | Update payment | P3 |
| `/invoices/{id}/attach-payment` | POST | Attach payment | P3 |

### 3.30 Other Endpoints

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/currencies` | GET | List currencies | P3 |
| `/car-rental/blocked-days` | GET | List blocked days | P3 |
| `/car-rental/daily-manifest` | GET | Get daily manifest | P3 |
| `/car-rental/packages` | GET | List packages | P3 |
| `/car-rental/packages/{id}` | GET | Get package | P3 |
| `/car-rental/package-items` | GET | List package items | P3 |
| `/car-rental/quotes` | GET | List quotes | P3 |
| `/car-rental/quotes/{id}` | GET | Get quote | P3 |
| `/car-rental/reservation-attempts` | GET | List attempts | P3 |
| `/car-rental/reservation-agents` | GET | List agents | P3 |
| `/fields` | GET | List custom fields | P2 |
| `/fields/{id}` | GET | Get custom field | P2 |
| `/filters` | GET | Get filter examples | P3 |
| `/preferences` | GET | Get preferences | P3 |
| `/fleets/features` | GET | List vehicle features | P3 |
| `/webhooks` | POST | Register webhook | P2 |

---

## 4. Database Schema Additions

### 4.1 New Tables Needed

```sql
-- ============================================================
-- HQ MIRROR: Additional Tables
-- ============================================================

-- Payments
CREATE TABLE hq_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_payment_id TEXT NOT NULL,
  reservation_external_id TEXT,
  customer_external_id TEXT,
  amount DECIMAL(10,2),
  payment_method TEXT,
  payment_type TEXT,
  status TEXT,
  transaction_id TEXT,
  card_last_four TEXT,
  card_brand TEXT,
  occurred_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_payment_id)
);

-- Refunds
CREATE TABLE hq_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_refund_id TEXT NOT NULL,
  reservation_external_id TEXT,
  payment_external_id TEXT,
  amount DECIMAL(10,2),
  reason TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_refund_id)
);

-- Vehicle Damages
CREATE TABLE hq_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_damage_id TEXT NOT NULL,
  vehicle_external_id TEXT,
  reservation_external_id TEXT,
  damage_type TEXT,
  description TEXT,
  location_on_vehicle TEXT,
  severity TEXT,
  repair_cost DECIMAL(10,2),
  reported_at TIMESTAMPTZ,
  repaired_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_damage_id)
);

-- Comments/Notes
CREATE TABLE hq_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_comment_id TEXT NOT NULL,
  item_type TEXT, -- 'reservation', 'vehicle', 'customer'
  item_external_id TEXT,
  body TEXT,
  author_name TEXT,
  created_at_hq TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_comment_id)
);

-- Extensions (rental extensions)
CREATE TABLE hq_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_extension_id TEXT NOT NULL,
  reservation_external_id TEXT,
  original_return_date TIMESTAMPTZ,
  new_return_date TIMESTAMPTZ,
  additional_charges DECIMAL(10,2),
  created_at_hq TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_extension_id)
);

-- External Charges (tolls, fines, etc.)
CREATE TABLE hq_external_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_charge_id TEXT NOT NULL,
  reservation_external_id TEXT,
  charge_type TEXT,
  description TEXT,
  amount DECIMAL(10,2),
  occurred_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_charge_id)
);

-- Adjustments
CREATE TABLE hq_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_adjustment_id TEXT NOT NULL,
  reservation_external_id TEXT,
  adjustment_type TEXT,
  description TEXT,
  amount DECIMAL(10,2),
  created_at_hq TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_adjustment_id)
);

-- Rates
CREATE TABLE hq_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_rate_id TEXT NOT NULL,
  name TEXT,
  vehicle_class_id TEXT,
  rate_type_id TEXT,
  daily_rate DECIMAL(10,2),
  weekly_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),
  mileage_limit INTEGER,
  extra_mileage_rate DECIMAL(10,2),
  active BOOLEAN,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_rate_id)
);

-- Rate Types
CREATE TABLE hq_rate_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_rate_type_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_rate_type_id)
);

-- Additional Charges (insurance, GPS, child seat, etc.)
CREATE TABLE hq_additional_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_charge_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  charge_type TEXT, -- 'daily', 'per_rental', 'per_mile'
  amount DECIMAL(10,2),
  taxable BOOLEAN,
  active BOOLEAN,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_charge_id)
);

-- Locations
CREATE TABLE hq_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_location_id TEXT NOT NULL,
  name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  active BOOLEAN,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_location_id)
);

-- Vehicle Classes
CREATE TABLE hq_vehicle_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_class_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  sort_order INTEGER,
  image_url TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_class_id)
);

-- Vehicle Models
CREATE TABLE hq_vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_model_id TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  vehicle_class_id TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_model_id)
);

-- Blocked Periods (vehicle unavailability)
CREATE TABLE hq_blocked_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_blocked_id TEXT NOT NULL,
  vehicle_external_id TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  reason TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_blocked_id)
);

-- Maintenance/Repair Orders
CREATE TABLE hq_repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_repair_id TEXT NOT NULL,
  vehicle_external_id TEXT,
  status TEXT,
  description TEXT,
  cost DECIMAL(10,2),
  vendor TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_repair_id)
);

-- Security Deposits
CREATE TABLE hq_security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_deposit_id TEXT NOT NULL,
  reservation_external_id TEXT,
  amount DECIMAL(10,2),
  status TEXT, -- 'held', 'released', 'charged'
  held_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_deposit_id)
);

-- Email Templates
CREATE TABLE hq_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_template_id TEXT NOT NULL,
  name TEXT,
  subject TEXT,
  body_html TEXT,
  trigger_event TEXT,
  active BOOLEAN,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_template_id)
);

-- Fines (tickets, violations)
CREATE TABLE hq_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_fine_id TEXT NOT NULL,
  vehicle_external_id TEXT,
  reservation_external_id TEXT,
  customer_external_id TEXT,
  fine_type TEXT,
  amount DECIMAL(10,2),
  description TEXT,
  violation_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  status TEXT,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_fine_id)
);

-- Payment Methods
CREATE TABLE hq_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_method_id TEXT NOT NULL,
  name TEXT,
  method_type TEXT, -- 'cash', 'card', 'online', 'transfer'
  active BOOLEAN,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_method_id)
);

-- Custom Fields
CREATE TABLE hq_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id),
  external_field_id TEXT NOT NULL,
  name TEXT,
  field_type TEXT,
  item_type TEXT, -- 'customer', 'vehicle', 'reservation'
  required BOOLEAN,
  options JSONB,
  raw JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_account_id, external_field_id)
);
```

---

## 5. Reservation Creation Flow (8 Steps)

This is the most critical flow to replicate.

### Step 1: Get Form Configuration
```typescript
GET /car-rental/reservations/dates?brand_id=1

Response: {
  form_fields: [...],
  validations: {...},
  locations: [...],
  min_rental_hours: 24
}
```

### Step 2: Validate Dates & Get Available Vehicles
```typescript
POST /car-rental/reservations/dates
Body: {
  pick_up_date: "2025-02-28",
  pick_up_time: "10:00:00",
  return_date: "2025-03-01",
  return_time: "10:00:00",
  pick_up_location: 1,
  return_location: 1,
  brand_id: 1
}

Response: {
  vehicle_classes: [
    {
      id: 5,
      name: "Economy",
      available_count: 12,
      daily_rate: 45.00,
      total_price: 45.00
    },
    ...
  ]
}
```

### Step 3: Get Additional Charges
```typescript
GET /car-rental/reservations/additional-charges
Params: pick_up_date, pick_up_time, return_date, return_time,
        pick_up_location, return_location, brand_id, vehicle_class_id

Response: {
  charges: [
    { id: 1, name: "Insurance CDW", daily_rate: 15.00 },
    { id: 2, name: "GPS", daily_rate: 10.00 },
    ...
  ]
}
```

### Step 4: Calculate Final Price
```typescript
POST /car-rental/reservations/additional-charges
Body: {
  pick_up_date, pick_up_time, return_date, return_time,
  pick_up_location, return_location, brand_id, vehicle_class_id,
  additional_charges: [1, 2],
  coupon_code: "SAVE10",
  manual_discount: 0
}

Response: {
  subtotal: 70.00,
  taxes: 6.25,
  total: 76.25,
  security_deposit: 200.00
}
```

### Step 5: Get Customer Form Fields
```typescript
GET /car-rental/reservations/fields/customer

Response: {
  fields: [
    { id: "first_name", required: true },
    { id: "last_name", required: true },
    { id: "email", required: true },
    { id: "phone_number", required: true },
    { id: "field_254", label: "Driver License #", required: true },
    { id: "field_256", label: "DL Expiration", required: true },
    ...
  ]
}
```

### Step 6: Create Customer
```typescript
POST /car-rental/reservations/customer
Body: {
  pick_up_date, pick_up_time, return_date, return_time,
  pick_up_location, return_location, brand_id, vehicle_class_id,
  contact_entity: "person",
  first_name: "John",
  last_name: "Doe",
  full_name: "John Doe",
  email: "john@example.com",
  phone_number: "+1234567890",
  street: "123 Main St",
  city: "Brooklyn",
  state: "NY",
  zip: "11204",
  country: "US",
  birthdate: "1985-06-15",
  field_254: "D12345678",
  field_256: "2027-06-15"
}

Response: {
  data: {
    customer: { id: 12345 }
  }
}
```

### Step 7: Upload Driver's License
```typescript
POST /files/upload
Content-Type: multipart/form-data
Body: {
  item_type: "contacts.3",
  item_id: 12345,
  file: [binary],
  filename: "drivers_license.jpg",
  field_id: 252
}
```

### Step 8: Confirm Reservation
```typescript
POST /car-rental/reservations/confirm
Body: {
  customer_id: 12345,
  brand_id: 1,
  pick_up_date: "2025-02-28",
  pick_up_time: "10:00:00",
  return_date: "2025-03-01",
  return_time: "10:00:00",
  vehicle_class_id: 5,
  pick_up_location: 1,
  return_location: 1,
  additional_charges: [1, 2],
  // Optional for online payment:
  return_payment_link: true,
  payment_method_id: 5,
  payment_external_redirect: "https://mysite.com/payment-callback"
}

Response: {
  success: true,
  data: {
    reservation: { id: 67890 },
    transaction: {
      id: 999,
      amount: 276.25,
      payment_link: "https://pay.hqrentalsoftware.com/..."
    }
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Complete Data Mirror (Week 1-2)
- [ ] Create all new database tables
- [ ] Build sync functions for each endpoint
- [ ] Mirror: payments, refunds, damages, comments
- [ ] Mirror: rates, rate_types, additional_charges
- [ ] Mirror: locations, vehicle_classes, vehicle_models
- [ ] Mirror: blocked_periods, repair_orders
- [ ] Mirror: security_deposits, email_templates
- [ ] Mirror: fines, payment_methods, custom_fields
- [ ] Set up incremental sync jobs

### Phase 2: Read Operations (Week 2-3)
- [ ] Build tRPC endpoints for all mirrored data
- [ ] Pagination and filtering
- [ ] Search functionality
- [ ] Dashboard statistics from mirrored data

### Phase 3: Reservation Flow UI (Week 3-4)
- [ ] Date selection step
- [ ] Vehicle class selection step
- [ ] Additional charges step
- [ ] Customer info step
- [ ] Driver license upload step
- [ ] Confirmation step
- [ ] Payment integration

### Phase 4: Write Operations (Week 4-5)
- [ ] Create reservation → HQ API
- [ ] Update reservation → HQ API
- [ ] Create/update customer → HQ API
- [ ] Assign vehicle → HQ API
- [ ] Create payment → HQ API
- [ ] Upload files → HQ API

### Phase 5: Full Independence (Week 5-6)
- [ ] Generate contracts locally (PDF)
- [ ] Send emails locally (SendGrid/SES)
- [ ] Process payments directly (Stripe)
- [ ] Stop needing HQ for daily operations
- [ ] HQ becomes backup sync only

---

## 7. API Wrapper Structure

```typescript
// packages/integrations/src/hq/client.ts

export class HQClient {
  private baseUrl = 'https://api-america-3.caagcrm.com/api-america-3'
  private auth: string
  
  constructor(tenantToken: string, userToken: string) {
    this.auth = Buffer.from(`${tenantToken}:${userToken}`).toString('base64')
  }
  
  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })
    
    if (!response.ok) {
      throw new HQApiError(response.status, await response.text())
    }
    
    return response.json()
  }
  
  // Reservations
  async listReservations(params?: ReservationListParams) { ... }
  async getReservation(id: string) { ... }
  async createReservation(data: CreateReservationData) { ... }
  async updateReservation(id: string, data: UpdateReservationData) { ... }
  async cancelReservation(id: string) { ... }
  async assignVehicle(reservationId: string, vehicleId: string) { ... }
  
  // Customers
  async listCustomers(params?: CustomerListParams) { ... }
  async getCustomer(id: string) { ... }
  async createCustomer(data: CreateCustomerData) { ... }
  async updateCustomer(id: string, data: UpdateCustomerData) { ... }
  
  // Vehicles
  async listVehicles(params?: VehicleListParams) { ... }
  async getVehicle(id: string) { ... }
  async updateVehicle(id: string, data: UpdateVehicleData) { ... }
  
  // Payments
  async listPayments(reservationId: string) { ... }
  async createPayment(reservationId: string, data: CreatePaymentData) { ... }
  async chargeCard(reservationId: string, data: ChargeCardData) { ... }
  async refund(reservationId: string, data: RefundData) { ... }
  
  // ... all other endpoints
}
```

---

## 8. Sync Job Structure

```typescript
// packages/integrations/src/hq/sync/index.ts

export const hqSyncJobs = {
  // Full sync (run daily at 2am)
  'hq-full-sync': async (job) => {
    await syncCustomers(job)
    await syncVehicles(job)
    await syncReservations(job)
    await syncPayments(job)
    await syncRates(job)
    // ... etc
  },
  
  // Incremental sync (run every 5 minutes)
  'hq-incremental-sync': async (job) => {
    const since = await getLastSyncTime('hq')
    await syncReservationsIncremental(since)
    await syncPaymentsIncremental(since)
    await updateLastSyncTime('hq')
  },
  
  // Individual syncs (can be triggered manually)
  'hq-sync-customers': syncCustomers,
  'hq-sync-vehicles': syncVehicles,
  'hq-sync-reservations': syncReservations,
  'hq-sync-payments': syncPayments,
  'hq-sync-rates': syncRates,
  // ... etc
}
```

---

## 9. Testing Checklist

### Data Integrity
- [ ] All reservations match between HQ and MRST
- [ ] All customers match
- [ ] All vehicles match
- [ ] All payments match
- [ ] All documents/files accessible

### Reservation Flow
- [ ] Can create reservation end-to-end
- [ ] Dates validation works
- [ ] Vehicle availability accurate
- [ ] Pricing calculation correct
- [ ] Customer creation works
- [ ] File upload works
- [ ] Payment link generated

### Edge Cases
- [ ] Overlapping reservations blocked
- [ ] Vehicle already reserved handled
- [ ] Payment failures handled
- [ ] Network errors retried
- [ ] Duplicate customers detected

---

## 10. Success Criteria

**Phase 1 Complete When:**
- All HQ data is mirrored in MRST database
- Data matches 100% (spot check 50 records)
- Incremental sync running every 5 minutes

**Phase 2 Complete When:**
- All mirrored data viewable in MRST UI
- Search and filters working
- Performance acceptable (<500ms queries)

**Phase 3 Complete When:**
- Can create reservation through MRST UI
- Reservation appears in HQ
- Customer created correctly
- Payment link works

**Phase 4 Complete When:**
- All write operations work through MRST
- Two-way sync working
- No need to use HQ UI for operations

**Phase 5 Complete When:**
- Can operate fully without HQ
- Contracts generated locally
- Emails sent locally
- Payments processed directly
- HQ is just a backup

---

*End of specification.*
