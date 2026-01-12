# HQ Rentals API Reference
**Last Updated:** 2025-12-09
**Base URL:** `https://api-america-3.caagcrm.com/api-america-3`
**Auth:** Basic auth with `base64(TENANT_TOKEN:USER_TOKEN)`

## Credentials (from api_proxy.php)
```
TENANT_TOKEN: A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW
USER_TOKEN: jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO
```

---

## Reservation Creation Flow (8 Steps)

### Step 1: Get Form Configuration
```
GET /car-rental/reservations/dates?brand_id=1
```
Returns form details and validations for date selection.

### Step 2: Validate Dates & Get Available Vehicles
```
POST /car-rental/reservations/dates
Body:
  pick_up_date: 2025-02-28
  pick_up_time: 10:00:00
  return_date: 2025-03-01
  return_time: 10:00:00
  pick_up_location: 1
  return_location: 1
  brand_id: 1
```
Returns list of available vehicle classes with prices.

### Step 3: Get Additional Charges
```
GET /car-rental/reservations/additional-charges
Params:
  pick_up_date, pick_up_time, return_date, return_time
  pick_up_location, return_location, brand_id, vehicle_class_id
```
Returns applicable additional charges for the selection.

### Step 4: Calculate Final Price
```
POST /car-rental/reservations/additional-charges
Body:
  pick_up_date, pick_up_time, return_date, return_time
  pick_up_location, return_location, brand_id, vehicle_class_id
  additional_charges[]: [charge_ids]
  coupon_code (optional)
  manual_discount (optional)
  manual_discount_is_percentage (optional)
```
Returns total price and security deposit.

### Step 5: Get Customer Form Fields
```
GET /car-rental/reservations/fields/customer
```
Returns required fields for customer creation.

### Step 6: Create Customer
```
POST /car-rental/reservations/customer
Body:
  pick_up_date, pick_up_time, return_date, return_time
  pick_up_location, return_location, brand_id, vehicle_class_id
  contact_entity: person
  first_name, last_name, full_name
  email, phone_number
  street, street2, city, zip, country, state
  birthdate
  field_254: [DL Number]
  field_256: [DL Expiration Date]
```
Response contains: `data.customer.id`

### Step 7: Upload Driver's License
```
POST /files/upload
Body (multipart/form-data):
  item_type: contacts.3
  item_id: [customer_id from step 6]
  file: [binary data]
  filename: [file name]
  field_id: 252  (default for driver's license)
```

### Step 8: Confirm Reservation
```
POST /car-rental/reservations/confirm
Body:
  customer_id: [from step 6]
  brand_id: 1
  pick_up_date, return_date
  pick_up_time, return_time
  vehicle_class_id
  pick_up_location, return_location

  # Optional - Online Payment:
  return_payment_link: true
  payment_method_id: 5
  payment_external_redirect: https://...
  set_amount_to_pay_online_from_settings: 1
```
Response:
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": 12,
      "amount": {...},
      "payment_link": "https://..."
    }
  }
}
```

---

## Other Useful Endpoints

### Vehicles/Fleet
```
GET /fleets/vehicles?limit=200&page=1
```
Returns full list of fleet vehicles with all details.

### Reservations
```
GET /car-rental/reservations/{id}
GET /car-rental/reservations?status=rental|reservation|completed&limit=100
```

### Contacts
```
GET /contacts?limit=100
POST /contacts (create new contact)
PUT /contacts/{id} (update contact)
```

### Rates
```
GET /car-rental/rates/ (with header Accept: application/vnd.api.v2+json for v2)
```

### Payments
```
GET /car-rental/reservations/{id}/payments
GET /car-rental/reservations/{id}/refunds
```

---

## Official Documentation
- Main Docs: https://api-docs.hqrentalsoftware.com/
- Reservation Flow: https://api-docs.hqrentalsoftware.com/doc-866060
- Alternative: https://api-docs.caagcrm.com/

---

## Integration Notes

### Currently Implemented
- `/car-rental/reservations` - List and detail endpoints
- Vehicles extracted from reservation details

### Missing (Should Add)
- `/fleets/vehicles` - Direct fleet listing (source of truth for ~86-89 vehicles)
- `/contacts` - Direct customer listing

### Why This Matters
The current sync only sees vehicles that have been assigned to reservations. The `/fleets/vehicles` endpoint should return the **actual active fleet** which is 86-89 vehicles - this is the source of truth for what vehicles we should display.
