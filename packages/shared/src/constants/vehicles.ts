/**
 * Vehicle Constants
 *
 * IMPORTANT: These define which vehicles are "active" and shown in the fleet.
 * This includes vehicles that are part of daily operations - rented, available for rent,
 * complementary (loaner), or temporarily out of service but still in the fleet.
 *
 * New vehicles added to HQ will automatically appear if they have one of these statuses.
 * Only archived/sold vehicles are excluded.
 */

/**
 * Active vehicle statuses - vehicles in these statuses are shown in the fleet
 * - rental: Currently rented out to a customer
 * - available: Available for rent
 * - complementary: Loaner/courtesy vehicles
 * - out_of_service: Temporarily unavailable but still in fleet (maintenance, etc)
 *
 * New vehicles added to HQ will appear automatically as long as they have one of these statuses.
 */
export const ACTIVE_VEHICLE_STATUSES = ['rental', 'available', 'complementary', 'out_of_service'] as const

/**
 * Inactive vehicle statuses - vehicles NOT shown by default
 * These are archived, sold, or otherwise not part of daily operations
 */
export const INACTIVE_VEHICLE_STATUSES = ['active', 'sold', 'archived'] as const

/**
 * Check if a vehicle status is considered "active" (should be shown in fleet)
 */
export function isActiveVehicleStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return ACTIVE_VEHICLE_STATUSES.includes(status.toLowerCase() as any)
}

/**
 * Type for active vehicle statuses
 */
export type ActiveVehicleStatus = typeof ACTIVE_VEHICLE_STATUSES[number]
