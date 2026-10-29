type WorkplaceAdminBookingAccessMode =
  'NORMAL' | 'ELEVATED' | 'PROVIDER_SUPPORT' | null | undefined;

export function canExecuteWorkplaceAdminBookingCommand(
  canManageWorkplaceAdmin: boolean,
  activeAccessMode: WorkplaceAdminBookingAccessMode
): boolean {
  return canManageWorkplaceAdmin && activeAccessMode === 'ELEVATED';
}

export const WORKPLACE_ADMIN_BOOKING_COMMAND_OPTIONS = Object.freeze({
  activeAccessMode: 'ELEVATED' as const,
});
