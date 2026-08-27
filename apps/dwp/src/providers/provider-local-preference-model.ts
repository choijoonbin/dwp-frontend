import type { PersonalPreference, PersonalPreferenceValues } from '@dwp-frontend/shared-utils';

/**
 * Provider display preferences are personal state in the immutable Provider realm.
 * They are not tenant policy and therefore intentionally have no managed-policy field.
 */
export type ProviderLocalPreferenceState = {
  schemaVersion: 2;
  customized: boolean;
  preferences: PersonalPreferenceValues;
  version: 0;
  updatedAt: string | null;
};

export type PersonalPreferenceView = Omit<PersonalPreference, 'managedPolicy'> & {
  managedPolicy: PersonalPreference['managedPolicy'] | null;
};

/**
 * Adapt Provider-local state to the existing PersonalPreference context contract.
 *
 * Tenant wire responses keep their real managed policy, while Provider-local state explicitly has
 * none. This prevents Provider creation, normalization, and persistence from acquiring tenant-policy
 * meaning merely to satisfy a shared view contract.
 */
export function asPersonalPreferenceView(
  preference: ProviderLocalPreferenceState
): PersonalPreferenceView {
  return {
    ...preference,
    managedPolicy: null,
  };
}
