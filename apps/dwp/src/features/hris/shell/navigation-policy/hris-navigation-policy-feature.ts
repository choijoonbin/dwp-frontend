export const HRIS_NAVIGATION_POLICY_RUNTIME_STATE =
  import.meta.env.VITE_HRIS_NAVIGATION_POLICY_ENABLED === 'true' ? 'ON' : 'OFF';

export const HRIS_NAVIGATION_POLICY_V3_RUNTIME_STATE =
  import.meta.env.VITE_HRIS_NAVIGATION_POLICY_V3_ENABLED === 'true' ? 'ON' : 'OFF';

export function isHrisNavigationPolicyRuntimeEnabled() {
  return HRIS_NAVIGATION_POLICY_RUNTIME_STATE === 'ON';
}

export function isHrisNavigationPolicyV3RuntimeEnabled() {
  return HRIS_NAVIGATION_POLICY_V3_RUNTIME_STATE === 'ON';
}
