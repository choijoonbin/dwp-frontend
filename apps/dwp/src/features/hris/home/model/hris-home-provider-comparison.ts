/**
 * Structural comparison inputs deliberately live here rather than importing the provider contract.
 * The contract consumes these comparisons, so importing its type exports would create a runtime
 * feature-boundary cycle even though TypeScript erases the imports.
 */
type ComparableEntitlementRequirement = Readonly<{
  resourceType: string;
  resourceKey: string;
  permissionCodes: readonly string[];
  match: string;
}>;

type ComparableSensitivity = Readonly<{
  classification: string;
  projection: string;
  exposedFields: readonly string[];
}>;

type ComparablePrimaryAction = Readonly<{
  actionId: string;
  labelKey: string;
}>;

export function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function sameEntitlements(
  left: readonly ComparableEntitlementRequirement[],
  right: readonly ComparableEntitlementRequirement[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => {
      const expected = right[index];
      return (
        value !== null &&
        typeof value === 'object' &&
        expected !== undefined &&
        value.resourceType === expected.resourceType &&
        value.resourceKey === expected.resourceKey &&
        value.match === expected.match &&
        Array.isArray(value.permissionCodes) &&
        sameStrings(value.permissionCodes, expected.permissionCodes)
      );
    })
  );
}

export function sameSensitivity(
  left: ComparableSensitivity,
  right: ComparableSensitivity
): boolean {
  return (
    left.classification === right.classification &&
    left.projection === right.projection &&
    Array.isArray(left.exposedFields) &&
    sameStrings(left.exposedFields, right.exposedFields)
  );
}

export function samePrimaryAction(
  left: ComparablePrimaryAction | null,
  right: ComparablePrimaryAction | null
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.actionId === right.actionId &&
      left.labelKey === right.labelKey)
  );
}
