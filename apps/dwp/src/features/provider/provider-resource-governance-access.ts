/**
 * Every tenant-targeted resource mutation needs both governance-write and estate-read authority.
 * Estate-read is required by the API as well, so the UI never offers a mutation it cannot submit.
 */
export function canManageProviderResourceGovernance(
  canWrite: boolean,
  canReadEstate: boolean
): boolean {
  return canWrite && canReadEstate;
}
