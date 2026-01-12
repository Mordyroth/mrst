/**
 * HQ Rental Software API Types
 * Based on CAAG CRM API
 */

export interface HQApiConfig {
  baseUrl: string
  tenantToken: string
  userToken: string
}

export interface HQApiResponse<T> {
  success: boolean
  status_code: number
  errors: string[]
  data: T
}

export interface HQPaginatedResponse<T> extends HQApiResponse<T[]> {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

// Price object used throughout the API
export interface HQPrice {
  currency: string
  currency_icon: string
  amount: string
  usd_amount: string
  amount_for_display: string
}

// Customer from reservation details
export interface HQCustomer {
  id: number
  label: string
  entity: string // 'person' | 'company'
  first_name: string | null
  last_name: string | null
  gender: string | null
  birthdate: string | null
  birthdate_day: number | null
  birthdate_month: number | null
  birthdate_year: number | null
  birthplace: string | null
  nationality: string | null
  street: string | null
  street2: string | null
  city: string | null
  state: string | null
  zip: string | null
  county: string | null
  country: string | null
  email: string | null
  website: string | null
  phone_number: string | null
  phone_alternative: string | null
  phone_cc: string | null
  phone_country: string | null
  phone_ext: string | null
  email_alternative: string | null
  driver_license: string | null
  identification: string | null
  uuid: string
  created_by: number
  updated_by: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  car_rental_reservation_count: number
  verified: boolean
  language: string
  // Custom fields (f252 is typically files/attachments)
  f252?: HQFile[] | string | null
  f256?: string | null // License expiration
  [key: string]: unknown
}

// File/attachment
export interface HQFile {
  id: number
  label: string
  extension: string
  uuid: string
  public_link: string
  public_download_link: string
  snippet_for_image_preview?: string
  user_can_delete?: boolean
}

// Vehicle from reservation
export interface HQVehicle {
  id: number
  label: string
  plate: string
  color: string | null
  odometer: number
  fuel_level: number
}

/**
 * Fleet vehicle from /fleets/vehicles endpoint
 * This is the full vehicle record with all details
 */
export interface HQFleetVehicle {
  id: number
  label: string
  vehicle_key: string | null
  vehicle_model_id: number | null
  vehicle_class_id: number | null
  vehicle_type_id: number | null
  year: number | null
  color: string | null
  vin: string | null
  plate: string | null
  plate_expiration_date: string | null
  odometer: number
  status: 'available' | 'rental' | 'maintenance' | 'out_of_service' | string
  available_date: string | null
  fuel_level: number
  registration_expiration_date: string | null
  inspection_expiration_date: string | null
  available: boolean
  current_location_id: number | null
  date_of_last_maintenance: string | null
  odometer_at_last_maintenance: number | null
  uuid: string
  latitude: number | null
  longitude: number | null
  hardware_id: string | null
  engine_on: boolean | null
  doors_locked: boolean | null
  speed: number | null
  fuel_type_id: number | null
  tank_size: number | null
  status_since: string | null
  last_location_update_at: string | null
  last_hardware_update_at: string | null
  doors_open: boolean | null
  hardware_provider: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Nested objects
  vehicle_class_label: string | null
  fuel_level_for_display: string | null
  status_color: string | null
  status_label: string | null
  vehicle_model: {
    id: number
    label: string
    make: string
    model: string
  } | null
  vehicle_class: {
    id: number
    label: string
    short_description: string | null
  } | null
  vehicle_type: {
    id: number
    label: string
  } | null
  current_location: {
    id: number
    name: string
  } | null
  fuel_type: {
    id: number
    label: string
  } | null
  // Raw JSON for any additional fields
  [key: string]: unknown
}

// Reservation vehicle assignment
export interface HQReservationVehicle {
  id: number
  active: boolean
  vehicle: HQVehicle
  pick_up_location_id: number
  return_location_id: number
  fuel_level_pick_up: number | null
  fuel_level_return: number | null
  odometer_pick_up: number
  odometer_return: number
  charge_fuel_to_client: boolean
  pick_up_date: string
  return_date: string
  [key: string]: unknown
}

// Location
export interface HQLocation {
  id: number
  name: string
  timezone: string
}

// Vehicle class
export interface HQVehicleClass {
  label: string
  short_description: string
  description: string
  features: string[]
  image: string
  recommended: boolean
}

// Comment
export interface HQComment {
  id: number
  comment: string
  created_by: string
  created_at: string
  created_at_diff_with_now: string
}

// Discount
export interface HQDiscount {
  name: string
  base_price: string
  charge_type: string
  total_amount: HQPrice
}

// Tax
export interface HQTax {
  name: string
  base_price: string
  charge_type: string
  total_amount: HQPrice
}

// Additional charge
export interface HQAdditionalCharge {
  id: number
  name: string
  charge_type: string
  base_price: string
  quantity: number
  total_amount: HQPrice
}

// Reservation list item (from /car-rental/reservations)
export interface HQReservationListItem {
  id: number
  prefixed_id: string
  custom_reservation_number: string | null
  pick_up_date: string
  initial_pick_up_date: string
  return_date: string
  initial_return_date: string
  cancellation_date: string | null
  cancellation_comments: string | null
  cancelled_by: number | null
  cancelled_at: string | null
  brand_id: number
  vehicle_class_id: number
  pick_up_location_id: number
  return_location_id: number
  customer_id: number
  currency: string
  outstanding_balance: string
  status: string // 'rental', 'completed', 'cancelled', 'no_show', 'pending', etc.
  completed_at: string | null
  completed_by: number | null
  created_by: number
  updated_by: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  uuid: string
  uuid_short: string
  security_deposit_paid: boolean
  security_deposit_charged_amount: string
  total_price: string
  total_days: number
  rental_user_id: number | null
  reservation_type: string // 'short', 'long', etc.
  [key: string]: unknown
}

// Full reservation details (from /car-rental/reservations/{id})
export interface HQReservationDetails {
  reservation: HQReservationListItem & {
    pick_up_location_label: string
    return_location_label: string
    reservation_type_label: string
    brand_label: string
    header: string
    pick_up_time: string
    return_time: string
    total_price: HQPrice
    total_price_without_taxes: HQPrice
    pick_up_location: HQLocation
    return_location: HQLocation
    public_link: string
    comments: HQComment[]
    distance_limits: {
      distance_allowed: number
      distance_limit_per_day: number
      distance_unit: string | null
      distance_unlimited: boolean
      distance_extra_price: HQPrice
    }
    distance_driven: number
  }
  tour_operator: unknown[]
  selected_vehicle_class: {
    vehicle_class_id: number
    sipp_code: string | null
    price: {
      total_days: number
      base_price: HQPrice
      base_price_with_taxes: HQPrice
      details: unknown[]
      total_price_with_mandatory_charges_and_taxes: HQPrice
    }
    vehicle_class: HQVehicleClass
    distance_limits: {
      distance_allowed: number
      distance_limit_per_day: number
      distance_unit: string | null
      distance_unlimited: boolean
    }
  }
  selected_additional_charges: HQAdditionalCharge[]
  external_charges: unknown[]
  vehicle_damages: unknown[]
  applicable_discounts: HQDiscount[]
  applicable_taxes: HQTax[]
  total: {
    show_security_deposit: boolean
    show_security_deposit_excess: boolean
    outstanding_balance: HQPrice
    outstanding_security_deposit: HQPrice
    security_deposit: HQPrice
    security_deposit_excess: HQPrice
    total_paid: HQPrice
    total_price: HQPrice
  }
  customer: HQCustomer
  primary_driver: HQCustomer
  different_primary_driver: boolean
  additional_drivers: HQCustomer[]
  vehicles: HQReservationVehicle[]
  replacements: unknown[]
  extensions: unknown[]
}

// Sync result type
export interface HQSyncCounts {
  processed: number
  created: number
  updated: number
  unchanged: number
  errored: number
}

export interface HQSyncResult {
  success: boolean
  counts: HQSyncCounts
  error?: string
}
